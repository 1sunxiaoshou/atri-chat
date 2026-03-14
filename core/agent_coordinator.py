"""Agent 业务协调器

重构后的核心协调器，负责：
1. 管理单个 Agent 实例
2. 通过中间件实现动态配置
3. 协调各个服务层
4. 统一消息处理入口

"""
import json
from typing import AsyncGenerator
from sqlalchemy.orm import Session
from langchain.agents import create_agent

from .middleware import (
    select_model_and_params,
    build_character_prompt,
    filter_tools_by_mode,
    AgentContext
)
from .callbacks import LLMCallLogger, TokenUsageCallback
from .config import get_settings
from .services import ConversationService, MessageService, get_output_strategy
from .services.model_service import ModelService
from .repositories import CharacterRepository
from .tools.memory_tools_v3 import get_memory_tools_v3
from .models.factory import ModelFactory
from .prompts import PromptManager
from .vrm import VRMService
from .logger import get_logger

logger = get_logger(__name__)


class AgentCoordinator:
    """业务协调器
    
    采用单 Agent 实例 + 动态中间件 + 输出策略的架构：
    - 通过 thread_id 实现会话隔离
    - 通过中间件实现模型、提示词、工具的动态配置
    - 通过策略模式处理不同输出模式
    - 使用 Repository 模式进行数据访问
    """
    
    def __init__(self, store, checkpointer):
        """初始化协调器
        
        Args:
            store: SqliteStore 实例
            checkpointer: AsyncSqliteSaver 实例
        """
        self.checkpointer = checkpointer
        self.store = store
        
        # 无状态服务（可共享）
        self.message_service = MessageService()
        self.model_factory = ModelFactory()
        self.prompt_manager = PromptManager() 
        
        # VRM 服务（复用 TTSFactory 单例）
        from .dependencies import get_tts_factory
        self.vrm_service = VRMService(get_tts_factory())
        
        # 创建单个 Agent 实例
        self.agent = self._create_agent()
    
    def _create_agent(self):
        """创建 Agent（使用动态中间件）
        
        注意：
        1. 使用占位模型，实际模型会在运行时通过中间件动态替换
        2. callbacks 在运行时通过 config 传递，而不是在创建时固定
        """
        all_tools = get_memory_tools_v3()
        
        # 使用占位模型，实际模型由 select_model_and_params 中间件动态提供
        # 这样可以避免启动时依赖特定模型配置
        from langchain_openai import ChatOpenAI
        placeholder_model = ChatOpenAI(model="gpt-4o", api_key="placeholder")
        
        return create_agent(
            model=placeholder_model,
            tools=all_tools,
            middleware=[
                select_model_and_params,
                build_character_prompt,
                filter_tools_by_mode,
            ],
            context_schema=AgentContext,
            checkpointer=self.checkpointer,
            store=self.store
        )
    
    async def send_message(
        self,
        user_message: str,
        conversation_id: str,
        character_id: str,
        model_id: str,
        provider_config_id: int,
        db_session: Session,
        output_mode: str = "text",
        **model_kwargs
    ) -> AsyncGenerator[str, None]:
        """统一的消息发送接口
        
        Args:
            user_message: 用户消息
            conversation_id: 会话ID (UUID)
            character_id: 角色ID (UUID)
            model_id: 模型ID
            provider_id: 供应商ID
            db_session: 数据库会话（用于保存消息和创建模型）
            output_mode: 输出模式 ("text" | "vrm")
            **model_kwargs: 模型参数
            
        Yields:
            JSON格式的流式事件
        """
        enable_vrm = output_mode == "vrm"
        
        # 创建请求级别的服务
        conversation_service = ConversationService(db_session)
        model_service = ModelService(db_session, self.model_factory)
        character_repo = CharacterRepository(db_session)
        
        # 1. 验证
        conversation_service.validate_conversation(conversation_id)
        if enable_vrm:
            # 使用 CharacterRepository 验证角色
            character = character_repo.get(character_id)
            if not character:
                raise ValueError(f"角色 {character_id} 不存在")
        
        # 2. 构建上下文
        context = AgentContext(
            character_id=character_id,
            enable_vrm=enable_vrm,
            model_id=model_id,
            provider_config_id=provider_config_id,
            model_kwargs={**model_kwargs, "streaming": not enable_vrm},
            db_session=db_session,
            model_service=model_service,
            prompt_manager=self.prompt_manager
        )
        
        # 统一日志输出：模型、模式、工具数量
        all_tools = get_memory_tools_v3()
        tool_count = len([t for t in all_tools if not t.name.startswith("vrm_") or enable_vrm])
        logger.info(
            f"Agent配置: 模型={provider_config_id}/{model_id}, 模式={'VRM' if enable_vrm else '文本'}, 工具数={tool_count}",
            extra={
                "character_id": character_id,
                "conversation_id": conversation_id,
                "model_kwargs": model_kwargs
            }
        )
        
        # 3. 获取输出策略
        strategy = get_output_strategy(
            mode=output_mode,
            message_service=self.message_service,
            vrm_service=self.vrm_service
        )
        
        # 4. 执行处理
        config = {"configurable": {"thread_id": str(conversation_id)}}
        
        # 启用 Token 统计回调
        token_callback = TokenUsageCallback()
        config["callbacks"] = [token_callback]
        
        # 根据配置决定是否启用 LLM 调用日志记录器
        settings = get_settings()
        if settings.enable_llm_call_logger:
            llm_logger = LLMCallLogger()
            config["callbacks"].append(llm_logger)
            logger.debug("LLM 调用日志记录器已启用")
        
        full_response = ""
        full_reasoning = ""
        tool_calls = []
        
        # 1. 保存用户消息（提前保存，确保即便 LLM 失败也能留存记录）
        try:
            conversation_service.save_message(
                conversation_id=conversation_id, 
                role="user", 
                content=user_message
            )
            # 2. 自动更新标题并实时通知前端
            new_title = conversation_service.auto_title(conversation_id, user_message)
            if new_title:
                yield json.dumps({"type": "title_update", "title": new_title}, ensure_ascii=False)
        except Exception as e:
            logger.error(f"前期消息处理失败: {e}")

        try:
            async for chunk_json in strategy.process(
                agent=self.agent,
                user_message=user_message,
                config=config,
                context=context
            ):
                chunk_data = json.loads(chunk_json)
                
                # 累积内容
                if chunk_data.get("type") == "text":
                    full_response += chunk_data.get("content", "")
                elif chunk_data.get("type") == "reasoning":
                    full_reasoning += chunk_data.get("content", "")
                elif chunk_data.get("type") == "tool_start":
                    tool_calls.append({
                        "run_id": chunk_data.get("run_id"),
                        "tool": chunk_data.get("tool"),
                        "input": chunk_data.get("input"),
                        "status": "running"
                    })
                elif chunk_data.get("type") == "tool_result":
                    # 查找并更新匹配的 run_id
                    run_id = chunk_data.get("run_id")
                    for tc in tool_calls:
                        if tc.get("run_id") == run_id:
                            tc["output"] = chunk_data.get("content")
                            tc["status"] = "completed"
                            break

                # 捕获完整回复 (对于某些策略可能直接返回 complete)
                if chunk_data.get("type") == "complete":
                    # 如果 payload 没带 full_response，就用我们累积的
                    if not chunk_data.get("full_response") and full_response:
                        chunk_data["full_response"] = full_response
                    
                    # 注入累计 Token 信息
                    chunk_data["usage"] = token_callback.get_summary()
                    chunk_json = json.dumps(chunk_data, ensure_ascii=False)
                
                yield chunk_json
            
            # 5. 保存助手消息
            if full_response:
                clean_response = strategy.clean_response(full_response)
                conversation_service.save_message(
                    conversation_id=conversation_id, 
                    role="assistant", 
                    content=clean_response
                )
                
        except Exception as e:
            logger.error(f"消息处理失败: {e}")
            error_msg = f"{type(e).__name__}: {str(e)}".strip(": ")
            yield json.dumps({"type": "error", "message": error_msg}, ensure_ascii=False)
    
    async def start_services(self):
        """启动后台服务"""
        pass
    
    async def stop_services(self):
        """停止后台服务"""
        pass
