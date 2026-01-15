"""Agent 业务协调器

重构后的核心协调器，负责：
1. 管理单个 Agent 实例
2. 通过中间件实现动态配置
3. 协调各个服务层
4. 统一消息处理入口
"""
import json
from typing import AsyncGenerator
from langchain.agents import create_agent

from .middleware import (
    select_model_and_params,
    build_character_prompt,
    filter_tools_by_mode,
    AgentContext
)
from .services import ConversationService, MessageService, get_output_strategy
from .tools.memory_tools import get_memory_tools
from .models.factory import ModelFactory
from .prompts import PromptManager
from .vrm import VRMService
from .logger import get_logger

logger = get_logger(__name__, category="BUSINESS")


class AgentCoordinator:
    """业务协调器
    
    采用单 Agent 实例 + 动态中间件 + 输出策略的架构：
    - 通过 thread_id 实现会话隔离
    - 通过中间件实现模型、提示词、工具的动态配置
    - 通过策略模式处理不同输出模式
    """
    
    def __init__(self, app_storage, store, checkpointer):
        self.app_storage = app_storage
        self.checkpointer = checkpointer
        self.store = store
        
        # 服务层
        self.conversation_service = ConversationService(app_storage)
        self.message_service = MessageService()
        
        # 工厂
        self.model_factory = ModelFactory(app_storage)
        self.prompt_manager = PromptManager(app_storage)
        
        # VRM 服务（复用 TTSFactory 单例）
        from .dependencies import get_tts_factory
        self.vrm_service = VRMService(app_storage, get_tts_factory())
        
        # 创建单个 Agent 实例
        self.agent = self._create_agent()
        
        logger.info("AgentCoordinator 初始化完成")
    
    def _create_agent(self):
        """创建 Agent（使用动态中间件）
        
        注意：这里使用占位模型，实际模型会在运行时通过中间件动态替换
        """
        all_tools = get_memory_tools()
        
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
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str,
        output_mode: str = "text",
        **model_kwargs
    ) -> AsyncGenerator[str, None]:
        """统一的消息发送接口
        
        Args:
            user_message: 用户消息
            conversation_id: 会话ID
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            output_mode: 输出模式 ("text" | "vrm")
            **model_kwargs: 模型参数
            
        Yields:
            JSON格式的流式事件
        """
        enable_vrm = output_mode == "vrm"
        
        # 1. 验证
        self.conversation_service.validate_conversation(conversation_id)
        if enable_vrm:
            character = self.app_storage.get_character(character_id)
            if not character:
                raise ValueError(f"角色 {character_id} 不存在")
        
        # 2. 构建上下文
        context = AgentContext(
            character_id=character_id,
            enable_vrm=enable_vrm,
            model_id=model_id,
            provider_id=provider_id,
            model_kwargs={**model_kwargs, "streaming": not enable_vrm},
            prompt_manager=self.prompt_manager,
            model_factory=self.model_factory
        )
        
        # 3. 获取输出策略
        strategy = get_output_strategy(
            mode=output_mode,
            message_service=self.message_service,
            vrm_service=self.vrm_service
        )
        
        # 4. 执行处理
        config = {"configurable": {"thread_id": str(conversation_id)}}
        full_response = ""
        
        try:
            async for chunk_json in strategy.process(
                agent=self.agent,
                user_message=user_message,
                config=config,
                context=context
            ):
                chunk_data = json.loads(chunk_json)
                
                # 捕获完整回复
                if chunk_data.get("type") == "complete":
                    full_response = chunk_data.get("full_response", "")
                elif chunk_data.get("type") == "full_response":
                    full_response = chunk_data.get("content", "")
                
                yield chunk_json
            
            # 5. 保存消息
            if full_response:
                clean_response = strategy.clean_response(full_response)
                self.conversation_service.save_message(conversation_id, "user", user_message)
                self.conversation_service.save_message(conversation_id, "assistant", clean_response)
                self.conversation_service.auto_title(conversation_id, user_message)
                
        except Exception as e:
            logger.error(f"消息处理失败: {e}", exc_info=True)
            yield json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
    
    async def start_services(self):
        """启动后台服务"""
        logger.info("启动 AgentCoordinator 后台服务")
    
    async def stop_services(self):
        """停止后台服务"""
        logger.info("停止 AgentCoordinator 后台服务")
