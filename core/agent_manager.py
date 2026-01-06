"""Agent 业务逻辑管理器"""
import json
import asyncio
from typing import Dict, Optional, Any, List, AsyncGenerator, Tuple
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain.messages import AIMessageChunk
from langgraph.checkpoint.sqlite import SqliteSaver

from .store import SqliteStore
from .storage import AppStorage
from .models.factory import ModelFactory
from .tools.memory_tools import get_memory_tools, AgentContext
from .asr.factory import ASRFactory
from .tts.factory import TTSFactory
from .logger import get_logger
from .prompts import PromptManager
from .vrm import VRMService

logger = get_logger(__name__, category="BUSINESS")


class AgentManager:
    """Agent 业务逻辑管理核心
    
    负责管理 Agent 实例的生命周期、处理消息发送、会话切换等业务逻辑。
    """
    
    def __init__(
        self,
        app_storage: AppStorage,
        store: SqliteStore,
        checkpointer: SqliteSaver
    ):
        self.app_storage = app_storage
        self.store = store
        self.checkpointer = checkpointer
        self.model_factory = ModelFactory(app_storage)
        
        # ASR和TTS管理
        self.asr_factory = ASRFactory(db_path=app_storage.db_path)
        self.tts_factory = TTSFactory(db_path=app_storage.db_path)
        
        # 提示词管理器
        self.prompt_manager = PromptManager(app_storage)
        
        # VRM 服务（简化版）
        self.vrm_service = VRMService(app_storage, self.tts_factory)
        
        logger.info("AgentManager 初始化完成")
    
    async def start_services(self):
        """启动后台服务"""
        logger.info("启动 AgentManager 后台服务")
        
        # 启动 VRM 音频清理任务
        from core.vrm.cleanup_task import start_cleanup_task
        asyncio.create_task(start_cleanup_task(interval_seconds=300, max_age_seconds=3600))
    
    async def stop_services(self):
        """停止后台服务"""
        logger.info("停止 AgentManager 后台服务")
    
    def create_agent(
        self,
        character_id: int,
        model_id: str,
        provider_id: str,
        enable_vrm: bool = False,
        **model_kwargs
    ):
        """创建 Agent 实例
        
        Args:
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            enable_vrm: 是否启用VRM模式
            **model_kwargs: 模型动态参数
            
        Returns:
            AgentExecutor 实例
        """
        # 1. 构建系统提示词
        system_prompt = self.prompt_manager.build_character_prompt(
            character_id=character_id,
            include_vrm=enable_vrm,
            include_safety=True
        )
        
        # 2. 创建模型实例
        model = self.model_factory.create_model(provider_id, model_id, **model_kwargs)
        
        # 3. 获取工具和中间件
        tools = get_memory_tools()
        summarization_middleware = SummarizationMiddleware(
            model=model,
            trigger=("tokens", 20000), 
            keep=("tokens", 8000)
        )
        
        # 4. 创建 Agent
        agent = create_agent(
            model=model,
            tools=tools,
            middleware=[summarization_middleware],
            system_prompt=system_prompt,
            checkpointer=self.checkpointer,
            store=self.store
        )
        
        logger.info(
            f"Agent 创建: {provider_id}/{model_id} (VRM: {enable_vrm})",
            extra={
                "character_id": character_id,
                "model": f"{provider_id}/{model_id}",
                "enable_vrm": enable_vrm
            }
        )
        return agent

    async def send_message_stream(
        self,
        user_message: str,
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ) -> AsyncGenerator[str, None]:
        """异步流式发送消息并获取响应（普通文本模式）"""
        
        # 1. 基础验证与上下文准备
        conversation = self._validate_conversation(conversation_id)
        
        try:
            # 2. 创建 Agent（文本模式，不包含VRM提示词）
            agent = self.create_agent(
                character_id, 
                model_id, 
                provider_id, 
                enable_vrm=False,
                streaming=True, 
                **model_kwargs
            )
            
            # 3. 使用普通模式的thread_id（不带后缀）
            thread_id = str(conversation_id)
            
            # 4. 执行流式生成
            full_response = ""
            stats = {}
            
            async for chunk, final_stats in self._run_streaming_loop(
                agent=agent,
                user_message=user_message,
                thread_id=thread_id,
                character_id=character_id
            ):
                if final_stats:
                    # 最后一个 yield 包含统计信息
                    stats = final_stats
                    full_response = final_stats.get("full_response", "")
                else:
                    # 正常的流式输出
                    yield chunk
            
            # 5. 保存对话并生成标题
            if full_response:
                self._save_and_title_conversation(
                    conversation_id, 
                    conversation, 
                    user_message, 
                    full_response
                )
                logger.info(f"[常规]回复: {full_response}")

        except Exception as e:
            self._handle_model_error(e, conversation_id)

    async def send_message_stream_vrm(
        self,
        user_message: str,
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ) -> AsyncGenerator[str, None]:
        """VRM 模式的流式消息处理
        
        流程：
        1. AI 生成带标记的完整文本
        2. 保存纯文本到数据库
        3. 流式生成音频段并返回
        """
        # 1. 基础验证
        conversation = self._validate_conversation(conversation_id)
        character = self.app_storage.get_character(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
        
        try:
            # 2. 创建 Agent（启用 VRM 模式，非流式）
            agent = self.create_agent(
                character_id,
                model_id,
                provider_id,
                enable_vrm=True,
                streaming=False,
                **model_kwargs
            )
            
            # 3. 生成完整消息（使用相同的 thread_id 保持上下文连续性）
            thread_id = str(conversation_id)
            response = await agent.ainvoke(
                {"messages": [{"role": "user", "content": user_message}]},
                config={"configurable": {"thread_id": thread_id}},
                context=AgentContext(character_id=character_id)
            )
            
            # 提取 AI 回复
            full_response = ""
            if hasattr(response, 'content'):
                full_response = response.content
            elif isinstance(response, dict) and 'messages' in response:
                messages = response['messages']
                if messages and hasattr(messages[-1], 'content'):
                    full_response = messages[-1].content
            
            if not full_response:
                logger.warning("AI 生成的回复为空")
                import json
                yield json.dumps({"type": "error", "message": "AI 回复为空"}, ensure_ascii=False)
                return
            
            logger.info(f"[VRM]回复: {full_response}")
            
            # 4. 保存纯文本到数据库（去除标记）
            import re
            clean_response = re.sub(r'\[[^\]]+:[^\]]+\]', '', full_response).strip()
            
            self._save_and_title_conversation(
                conversation_id, 
                conversation, 
                user_message, 
                clean_response
            )
            
            # 5. 流式生成音频段
            import json
            segment_count = 0
            
            async for segment in self.vrm_service.generate_stream(
                full_response, 
                character_id
            ):
                segment_count += 1
                
                # 流式返回
                yield json.dumps({
                    "type": "vrm_segment",
                    "data": segment
                }, ensure_ascii=False)
            
            # 6. 发送完成信号
            yield json.dumps({
                "type": "vrm_complete",
                "total_segments": segment_count
            }, ensure_ascii=False)

        except Exception as e:
            logger.error(
                "VRM 消息处理失败",
                extra={
                    "conversation_id": conversation_id,
                    "error": str(e)
                },
                exc_info=True
            )
            import json
            yield json.dumps({
                "type": "error",
                "message": str(e)
            }, ensure_ascii=False)

    # ================= 核心流式逻辑 =================

    async def _run_streaming_loop(
        self, 
        agent, 
        user_message: str, 
        thread_id: str,
        character_id: int
    ) -> AsyncGenerator[Tuple[str, Optional[Dict[str, Any]]], None]:
        """执行通用的 Agent 流式循环，使用 LangChain 推荐的 astream_events 方法"""
        full_message = None
        chunk_count = 0
        tool_call_count = 0
        
        try:
            # 使用 astream_events 获取更详细的事件信息
            async for event in agent.astream_events(
                {"messages": [{"role": "user", "content": user_message}]},
                config={"configurable": {"thread_id": thread_id}},
                context=AgentContext(character_id=character_id),
                version="v2"
            ):
                event_type = event.get("event")
                
                # 处理工具调用开始事件
                if event_type == "on_tool_start":
                    tool_name = event.get("name", "未知工具")
                    tool_call_count += 1
                    logger.info(f"工具调用: {tool_name}", extra={"tool_name": tool_name})
                    yield json.dumps({
                        "type": "status",
                        "content": f"正在使用工具: {tool_name}..."
                    }, ensure_ascii=False), None
                
                # 处理聊天模型流式输出
                elif event_type == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if not isinstance(chunk, AIMessageChunk):
                        continue
                    
                    # 聚合消息块
                    full_message = chunk if full_message is None else full_message + chunk
                    
                    # 解析并发送内容
                    text_chunk, reasoning_chunk = self._parse_message_content(chunk)
                    
                    if reasoning_chunk:
                        yield json.dumps({
                            "type": "reasoning",
                            "content": reasoning_chunk
                        }, ensure_ascii=False), None
                    
                    if text_chunk:
                        chunk_count += 1
                        yield json.dumps({
                            "type": "text",
                            "content": text_chunk
                        }, ensure_ascii=False), None
                
                # 处理工具调用结束事件（不记录日志，减少噪音）
                elif event_type == "on_tool_end":
                    pass
            
            # 构建最终统计信息
            full_response = full_message.content if full_message else ""
            stats = {
                "thread_id": thread_id,
                "response_length": len(full_response),
                "chunk_count": chunk_count,
                "tool_call_count": tool_call_count,
                "full_response": full_response
            }
            
            yield "", stats
            
        except Exception as e:
            logger.error(
                "流式处理异常",
                extra={
                    "thread_id": thread_id,
                    "character_id": character_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "operation": "stream_error",
                    "tool_call_count": tool_call_count,
                    "chunk_count": chunk_count
                },
                exc_info=True
            )
            raise

    def _parse_message_content(self, message: AIMessageChunk) -> Tuple[str, str]:
        """解析消息内容，分离文本和思维链
        
        使用 LangChain 推荐的方式处理消息内容
        Returns: (text_content, reasoning_content)
        """
        text_content = ""
        reasoning_content = ""
        
        try:
            # 1. 使用 LangChain 内置的 content 属性获取文本
            if hasattr(message, 'content') and message.content:
                if isinstance(message.content, str):
                    text_content = message.content
                elif isinstance(message.content, list):
                    # 处理多模态内容块
                    for block in message.content:
                        if isinstance(block, str):
                            text_content += block
                        elif isinstance(block, dict):
                            block_type = block.get('type', '')
                            if block_type == 'text' and 'text' in block:
                                text_content += block['text']
                            elif block_type == 'reasoning' and 'reasoning' in block:
                                reasoning_content += block['reasoning']
            
            # 2. 检查 additional_kwargs 中的推理内容
            if hasattr(message, 'additional_kwargs') and message.additional_kwargs:
                reasoning_content += message.additional_kwargs.get('reasoning_content', "")
                
        except Exception as e:
            logger.warning(
                f"解析消息内容时出现异常: {e}",
                extra={"message_type": type(message).__name__},
                exc_info=True
            )
            # 降级处理：直接使用字符串表示
            text_content = str(message.content) if message.content else ""
                            
        return text_content, reasoning_content

    # ================= 辅助业务逻辑 =================

    def _validate_conversation(self, conversation_id: int) -> Dict[str, Any]:
        """验证会话是否存在"""
        conversation = self.app_storage.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"会话不存在", extra={"conversation_id": conversation_id})
            raise ValueError(f"会话 {conversation_id} 不存在")
        return conversation

    def _save_and_title_conversation(
        self, 
        conversation_id: int, 
        conversation: Dict, 
        user_msg: str, 
        ai_msg: str
    ):
        """保存消息并处理自动命名"""
        self.app_storage.add_message(conversation_id, "user", user_msg)
        self.app_storage.add_message(conversation_id, "assistant", ai_msg)
        
        if conversation["title"] == "New Chat":
            title = user_msg.replace("\n", " ").strip()
            if len(title) > 30:
                title = title[:30] + "..."
            self.app_storage.update_conversation(conversation_id, title=title)
            logger.debug(f"自动生成会话标题", extra={"conversation_id": conversation_id, "title": title})



    def _handle_model_error(self, e: Exception, conversation_id: int):
        """统一错误处理"""
        error_msg = str(e)
        logger.error(
            f"消息处理失败",
            extra={
                "conversation_id": conversation_id,
                "error": error_msg,
                "error_type": type(e).__name__
            },
            exc_info=True
        )
        
        error_lower = error_msg.lower()
        if "api key" in error_msg or "authentication" in error_lower:
            raise RuntimeError(f"模型认证失败，请检查 API Key 配置: {error_msg}")
        elif "rate limit" in error_lower:
            raise RuntimeError(f"模型调用频率超限，请稍后重试: {error_msg}")
        elif "timeout" in error_lower:
            raise RuntimeError(f"模型调用超时，请检查网络连接: {error_msg}")
        elif "connection" in error_lower:
            raise RuntimeError(f"无法连接到模型服务，请检查网络和配置: {error_msg}")
        else:
            raise RuntimeError(f"模型调用失败: {error_msg}")

