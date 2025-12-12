"""Agent 业务逻辑管理器"""
import json
from typing import Dict, Optional, Any, List
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
        """初始化 AgentManager
        
        Args:
            app_storage: 应用存储实例（角色、会话、消息）
            store: 长期记忆存储实例（跨会话数据）
            checkpointer: 检查点存储实例（对话历史）
        """
        logger.info("初始化 AgentManager", extra={"operation": "init"})
        self.app_storage = app_storage
        self.store = store
        self.checkpointer = checkpointer
        self.model_factory = ModelFactory(app_storage)
        
        # ASR和TTS管理
        self.asr_factory = ASRFactory(db_path=app_storage.db_path)
        self.tts_factory = TTSFactory(db_path=app_storage.db_path)
        
        logger.debug("AgentManager 初始化完成")
    
    def create_agent(
        self,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ) -> Any:
        """创建 Agent 实例（每次都创建新实例）
        
        Args:
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            **model_kwargs: 模型动态参数（temperature, max_tokens等）
            
        Returns:
            Agent 实例
            
        Raises:
            ValueError: 当角色、模型不存在或创建失败时
        """
        # 1. 获取角色配置（包含 system_prompt）
        logger.debug(f"获取角色配置", extra={"character_id": character_id})
        character = self.app_storage.get_character(character_id)
        if not character:
            logger.error(f"角色不存在", extra={"character_id": character_id})
            raise ValueError(f"角色 {character_id} 不存在")
        
        # 2. 使用 ModelFactory 创建模型实例（支持动态参数）
        logger.debug(
            f"创建模型实例",
            extra={"provider_id": provider_id, "model_id": model_id, "kwargs": model_kwargs}
        )
        model = self.model_factory.create_model(provider_id, model_id, **model_kwargs)
        
        # 3. 获取工具列表和创建中间件
        tools = get_memory_tools()
        summarization_middleware = SummarizationMiddleware(
            model=model,
            trigger=("tokens", 20000), 
            keep=("tokens", 8000)
        )
        logger.debug(
            f"加载工具和中间件",
            extra={"character_id": character_id, "tool_count": len(tools)}
        )
        
        # 4. 创建 agent（使用角色的 system_prompt、工具和中间件）
        agent = create_agent(
            model=model,
            tools=tools,
            middleware=[summarization_middleware],
            system_prompt=character["system_prompt"],
            checkpointer=self.checkpointer,
            store=self.store
        )
        
        logger.info(
            f"Agent 创建成功",
            extra={
                "character_id": character_id,
                "character_name": character["name"],
                "model": f"{provider_id}/{model_id}",
                "tool_count": len(tools)
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
    ):
        """异步流式发送消息并获取响应
        
        Args:
            user_message: 用户消息内容
            conversation_id: 会话ID
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            **model_kwargs: 模型动态参数（temperature, max_tokens, top_p等）
            
        Yields:
            JSON格式的流式响应字符串:
            - {"type": "status", "content": "正在使用工具: xxx..."}
            - {"type": "reasoning", "content": "思维链内容"}
            - {"type": "text", "content": "实际回复内容片段"}
            
        Raises:
            ValueError: 当会话、角色或模型不存在时
            RuntimeError: 当模型调用失败时
        """
        logger.info(
            f"开始处理消息",
            extra={
                "conversation_id": conversation_id,
                "character_id": character_id,
                "model": f"{provider_id}/{model_id}",
                "message_length": len(user_message)
            }
        )
        
        # 1. 验证会话是否存在
        conversation = self.app_storage.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"会话不存在", extra={"conversation_id": conversation_id})
            raise ValueError(f"会话 {conversation_id} 不存在")
        
        try:
            # 2. 创建 agent 实例（传递动态参数）
            logger.debug(
                f"创建 Agent 实例",
                extra={"character_id": character_id, "model_kwargs": model_kwargs}
            )
            agent = self.create_agent(
                character_id, model_id, provider_id, 
                streaming=True, 
                **model_kwargs
            )
            
            full_response = ""
            chunk_count = 0
            tool_call_count = 0
            
            # 3. 异步流式调用 agent，注入 runtime context

            logger.debug(f"开始流式调用模型", extra={"conversation_id": conversation_id})
            async for message, metadata in agent.astream(
                {"messages": [{"role": "user", "content": user_message}]},
                config={
                    "configurable": {"thread_id": str(conversation_id)}
                },
                context=AgentContext(character_id=character_id),
                stream_mode="messages"
            ):
                # 过滤：只关注 AI 的输出片段 (忽略 UserMessage 和 ToolMessage)
                if not isinstance(message, AIMessageChunk):
                    continue
                
                
                # --- 分支 A: 处理工具调用状态 (Tool Call) ---
                # 当 AI 决定调用工具时，tool_call_chunks 会包含数据
                if message.tool_call_chunks:
                    chunk = message.tool_call_chunks[0]
                    # 通常只有第一个 chunk 包含工具名称 (name)，后续 chunk 是参数 (args)
                    # 我们只在检测到工具名称时通知前端，避免刷屏
                    if "name" in chunk and chunk["name"]:
                        tool_call_count += 1
                        logger.debug(
                            f"工具调用",
                            extra={"tool_name": chunk["name"], "conversation_id": conversation_id}
                        )
                        yield json.dumps({
                            "type": "status",
                            "content": f"正在使用工具: {chunk['name']}..."
                        }, ensure_ascii=False)

                # --- 分支 B: 处理思维链内容 (Reasoning Content) ---
                if hasattr(message, 'additional_kwargs') and 'reasoning_content' in message.additional_kwargs:
                    reasoning_chunk = message.additional_kwargs['reasoning_content']
                    if reasoning_chunk:
                        # 推送思维链内容给前端
                        yield json.dumps({
                            "type": "reasoning",
                            "content": reasoning_chunk
                        }, ensure_ascii=False)
                
                # --- 分支 C: 处理文本回复内容 (Content) ---
                # 当 AI 生成回答时，content 会包含文本
                if message.content:
                    chunk_text = ""
                    
                    # 兼容性处理：某些模型 content 是字符串，某些是列表
                    if isinstance(message.content, str):
                        chunk_text = message.content
                    elif isinstance(message.content, list):
                        for block in message.content:
                            if isinstance(block, str):
                                chunk_text += block
                            elif isinstance(block, dict):
                                # 处理思维链内容（某些模型可能在 content_blocks 中返回）
                                if block.get('type') == 'reasoning' and 'reasoning' in block:
                                    reasoning_text = block['reasoning']
                                    # 推送思维链内容给前端
                                    yield json.dumps({
                                        "type": "reasoning",
                                        "content": reasoning_text
                                    }, ensure_ascii=False)
                                # 处理普通文本
                                elif 'text' in block:
                                    chunk_text += block['text']
                    
                    # 如果提取到了有效文本，且不为空
                    if chunk_text:
                        # 拼接完整回复（用于后续存库）
                        full_response += chunk_text
                        chunk_count += 1
                        
                        # 推送给前端（类型为 text）
                        yield json.dumps({
                            "type": "text",
                            "content": chunk_text
                        }, ensure_ascii=False)
            
            # 4. 流结束后保存完整对话
            # 仅保存实际的文本对话内容，工具调用的中间状态不存入业务数据库
            if full_response:
                logger.debug(
                    f"保存对话消息",
                    extra={
                        "conversation_id": conversation_id,
                        "response_length": len(full_response),
                        "chunk_count": chunk_count,
                        "tool_call_count": tool_call_count
                    }
                )
                self.app_storage.add_message(conversation_id, "user", user_message)
                self.app_storage.add_message(conversation_id, "assistant", full_response)
                
                # 5. 如果是新会话，自动生成标题
                if conversation["title"] == "New Chat":
                    title = user_message.replace("\n", " ").strip()
                    if len(title) > 30:
                        title = title[:30] + "..."
                    self.app_storage.update_conversation(conversation_id, title=title)
                    logger.debug(f"自动生成会话标题", extra={"conversation_id": conversation_id, "title": title})
                
                logger.info(
                    f"消息处理完成",
                    extra={
                        "conversation_id": conversation_id,
                        "response_length": len(full_response),
                        "chunk_count": chunk_count,
                        "tool_call_count": tool_call_count
                    }
                )

        except Exception as e:
            # 捕获模型调用异常
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
            
            # 常见错误类型识别
            if "API key" in error_msg or "authentication" in error_msg.lower():
                raise RuntimeError(f"模型认证失败，请检查 API Key 配置: {error_msg}")
            elif "rate limit" in error_msg.lower():
                raise RuntimeError(f"模型调用频率超限，请稍后重试: {error_msg}")
            elif "timeout" in error_msg.lower():
                raise RuntimeError(f"模型调用超时，请检查网络连接: {error_msg}")
            elif "connection" in error_msg.lower():
                raise RuntimeError(f"无法连接到模型服务，请检查网络和配置: {error_msg}")
            else:
                raise RuntimeError(f"模型调用失败: {error_msg}")
    
    
    def get_conversation_history(
        self,
        conversation_id: int,
        from_checkpoint: bool = False
    ) -> List[Dict[str, Any]]:
        """获取会话历史
        
        Args:
            conversation_id: 会话ID
            from_checkpoint: 是否从检查点获取（True）还是从 AppStorage 获取（False）
            
        Returns:
            消息列表
        """
        if from_checkpoint:
            # 从检查点获取完整对话历史
            config = {"configurable": {"thread_id": str(conversation_id)}}
            checkpoint_tuple = self.checkpointer.get_tuple(config)
            
            if checkpoint_tuple:
                messages = checkpoint_tuple.checkpoint['channel_values']['messages']
                return [
                    {
                        "type": msg.type,
                        "content": msg.content
                    }
                    for msg in messages
                ]
            return []
        else:
            # 从 AppStorage 获取消息列表（用于 UI 展示）
            return self.app_storage.list_messages(conversation_id)
    
    def clear_conversation_history(
        self,
        conversation_id: int,
        clear_checkpoint: bool = True,
        clear_messages: bool = True
    ) -> Dict[str, int]:
        """清空会话历史
        
        Args:
            conversation_id: 会话ID
            clear_checkpoint: 是否清空检查点
            clear_messages: 是否清空 AppStorage 中的消息
            
        Returns:
            包含删除数量的字典
        """
        result = {
            "checkpoint_cleared": 0,
            "messages_deleted": 0
        }
        
        if clear_checkpoint:
            # 删除检查点
            self.checkpointer.delete_thread(thread_id=str(conversation_id))
            result["checkpoint_cleared"] = 1
        
        if clear_messages:
            # 删除 AppStorage 中的消息
            deleted_count = self.app_storage.delete_messages_by_conversation(conversation_id)
            result["messages_deleted"] = deleted_count
        
        return result
    
    async def send_message_stream_vrm(
        self,
        user_message: str,
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ):
        """VRM模式的流式消息处理（独立方法，不干扰原有逻辑）
        
        Args:
            user_message: 用户消息内容
            conversation_id: 会话ID
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            **model_kwargs: 模型动态参数（temperature, max_tokens, top_p等）
            
        Yields:
            JSON格式的流式响应字符串:
            - {"type": "status", "content": "正在使用工具: xxx..."}
            - {"type": "reasoning", "content": "思维链内容"}
            - {"type": "text", "content": "实际回复内容片段"}
            - {"type": "audio_segments", "segments": [...]}
            
        Raises:
            ValueError: 当会话、角色或模型不存在时
            RuntimeError: 当模型调用失败时
        """
        logger.info(
            f"开始处理VRM消息",
            extra={
                "conversation_id": conversation_id,
                "character_id": character_id,
                "model": f"{provider_id}/{model_id}",
                "message_length": len(user_message)
            }
        )
        
        # 1. 验证会话是否存在
        conversation = self.app_storage.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"会话不存在", extra={"conversation_id": conversation_id})
            raise ValueError(f"会话 {conversation_id} 不存在")
        
        # 2. 获取角色信息（用于获取TTS配置）
        character = self.app_storage.get_character(character_id)
        if not character:
            logger.error(f"角色不存在", extra={"character_id": character_id})
            raise ValueError(f"角色 {character_id} 不存在")
        
        try:
            # 3. 获取角色关联的VRM模型和动作列表
            vrm_model_id = character.get("vrm_model_id")
            
            if not vrm_model_id:
                logger.warning(
                    f"角色未关联VRM模型，使用默认配置",
                    extra={"character_id": character_id}
                )
                # 使用默认表情和动作
                from core.vrm.prompts import DEFAULT_EXPRESSIONS, generate_vrm_instruction
                vrm_instruction = generate_vrm_instruction(DEFAULT_EXPRESSIONS, [])
            else:
                # 从数据库获取该VRM模型的动作列表
                animations = self.app_storage.list_vrm_animations(vrm_model_id)
                
                # 提取动作的中文名
                action_names = [anim["name_cn"] for anim in animations]
                
                # 使用默认表情列表（表情是VRM规范定义的，不需要从数据库获取）
                from core.vrm.prompts import DEFAULT_EXPRESSIONS, generate_vrm_instruction
                vrm_instruction = generate_vrm_instruction(DEFAULT_EXPRESSIONS, action_names)
                
                logger.debug(
                    f"生成VRM标记指令",
                    extra={
                        "character_id": character_id,
                        "vrm_model_id": vrm_model_id,
                        "action_count": len(action_names)
                    }
                )
            
            # 4. 准备带VRM指令的system_prompt（不修改数据库）
            original_prompt = character["system_prompt"]
            modified_prompt = original_prompt + vrm_instruction
            
            logger.debug(f"已添加VRM标记生成指令", extra={"character_id": character_id})
            
            # 5. 创建临时角色配置（内存中）
            # 不修改数据库，避免并发问题
            temp_character = character.copy()
            temp_character["system_prompt"] = modified_prompt
            
            # 6. 使用临时配置创建 agent 实例
            logger.debug(
                f"创建 Agent 实例",
                extra={"character_id": character_id, "model_kwargs": model_kwargs}
            )
            
            # 直接创建模型和agent，不调用create_agent（避免重新读取数据库）
            model = self.model_factory.create_model(provider_id, model_id, streaming=True, **model_kwargs)
            tools = get_memory_tools()
            from langchain.agents.middleware import SummarizationMiddleware
            summarization_middleware = SummarizationMiddleware(
                model=model,
                trigger=("tokens", 20000), 
                keep=("tokens", 8000)
            )
            
            from langchain.agents import create_agent
            agent = create_agent(
                model=model,
                tools=tools,
                middleware=[summarization_middleware],
                system_prompt=modified_prompt,  # 使用修改后的prompt
                checkpointer=self.checkpointer,
                store=self.store
            )
            
            full_response = ""
            chunk_count = 0
            tool_call_count = 0
            
            # 6. 异步流式调用 agent
            logger.debug(f"开始流式调用模型", extra={"conversation_id": conversation_id})
            async for message, metadata in agent.astream(
                {"messages": [{"role": "user", "content": user_message}]},
                config={
                    "configurable": {"thread_id": str(conversation_id)}
                },
                context=AgentContext(character_id=character_id),
                stream_mode="messages"
            ):
                # 过滤：只关注 AI 的输出片段
                if not isinstance(message, AIMessageChunk):
                    continue
                
                # 处理工具调用状态
                if message.tool_call_chunks:
                    chunk = message.tool_call_chunks[0]
                    if "name" in chunk and chunk["name"]:
                        tool_call_count += 1
                        logger.debug(
                            f"工具调用",
                            extra={"tool_name": chunk["name"], "conversation_id": conversation_id}
                        )
                        yield json.dumps({
                            "type": "status",
                            "content": f"正在使用工具: {chunk['name']}..."
                        }, ensure_ascii=False)

                # 处理思维链内容
                if hasattr(message, 'additional_kwargs') and 'reasoning_content' in message.additional_kwargs:
                    reasoning_chunk = message.additional_kwargs['reasoning_content']
                    if reasoning_chunk:
                        yield json.dumps({
                            "type": "reasoning",
                            "content": reasoning_chunk
                        }, ensure_ascii=False)
                
                # 处理文本回复内容
                if message.content:
                    chunk_text = ""
                    
                    if isinstance(message.content, str):
                        chunk_text = message.content
                    elif isinstance(message.content, list):
                        for block in message.content:
                            if isinstance(block, str):
                                chunk_text += block
                            elif isinstance(block, dict):
                                if block.get('type') == 'reasoning' and 'reasoning' in block:
                                    reasoning_text = block['reasoning']
                                    yield json.dumps({
                                        "type": "reasoning",
                                        "content": reasoning_text
                                    }, ensure_ascii=False)
                                elif 'text' in block:
                                    chunk_text += block['text']
                    
                    if chunk_text:
                        full_response += chunk_text
                        chunk_count += 1
                        
                        yield json.dumps({
                            "type": "text",
                            "content": chunk_text
                        }, ensure_ascii=False)
            
            # 7. 流结束后处理
            if full_response:
                # 移除标记后保存到数据库
                from core.vrm.markup_filter import MarkupFilter
                clean_response = MarkupFilter.remove_markup(full_response)
                
                logger.debug(
                    f"保存对话消息",
                    extra={
                        "conversation_id": conversation_id,
                        "original_length": len(full_response),
                        "clean_length": len(clean_response),
                        "chunk_count": chunk_count,
                        "tool_call_count": tool_call_count
                    }
                )
                
                self.app_storage.add_message(conversation_id, "user", user_message)
                self.app_storage.add_message(conversation_id, "assistant", clean_response)
                
                # 8. 生成VRM音频（按句分割）
                logger.info(f"开始生成VRM音频", extra={"conversation_id": conversation_id})
                try:
                    from core.vrm.audio_generator import AudioGenerator
                    
                    # 使用角色绑定的TTS配置
                    tts_id = character.get("tts_id", "default")
                    logger.debug(f"使用角色TTS配置", extra={"tts_id": tts_id})
                    
                    # 构建动作映射（从数据库获取）
                    action_mapping = {}
                    if vrm_model_id:
                        animations = self.app_storage.list_vrm_animations(vrm_model_id)
                        action_mapping = {anim["name_cn"]: anim["name"] for anim in animations}
                        logger.debug(
                            f"加载动作映射",
                            extra={"vrm_model_id": vrm_model_id, "action_count": len(action_mapping)}
                        )
                    
                    audio_gen = AudioGenerator(self.tts_factory, action_mapping=action_mapping)
                    segments = await audio_gen.generate_by_sentence(
                        full_response,
                        tts_provider=tts_id  # 使用角色绑定的TTS
                    )
                    
                    # 发送音频片段
                    segments_dict = audio_gen.to_dict_list(segments)
                    yield json.dumps({
                        "type": "audio_segments",
                        "segments": segments_dict
                    }, ensure_ascii=False)
                    
                    logger.info(
                        f"VRM音频生成完成",
                        extra={
                            "conversation_id": conversation_id,
                            "segment_count": len(segments),
                            "total_duration": segments[-1].end_time if segments else 0
                        }
                    )
                except Exception as e:
                    logger.error(
                        f"VRM音频生成失败",
                        extra={"conversation_id": conversation_id, "error": str(e)},
                        exc_info=True
                    )
                    # 音频生成失败不影响文本返回
                    yield json.dumps({
                        "type": "error",
                        "content": f"音频生成失败: {str(e)}"
                    }, ensure_ascii=False)
                
                # 9. 如果是新会话，自动生成标题
                if conversation["title"] == "New Chat":
                    title = user_message.replace("\n", " ").strip()
                    if len(title) > 30:
                        title = title[:30] + "..."
                    self.app_storage.update_conversation(conversation_id, title=title)
                    logger.debug(f"自动生成会话标题", extra={"conversation_id": conversation_id, "title": title})
                
                logger.info(
                    f"VRM消息处理完成",
                    extra={
                        "conversation_id": conversation_id,
                        "response_length": len(full_response),
                        "chunk_count": chunk_count,
                        "tool_call_count": tool_call_count
                    }
                )

        except Exception as e:
            
            # 捕获模型调用异常
            error_msg = str(e)
            logger.error(
                f"VRM消息处理失败",
                extra={
                    "conversation_id": conversation_id,
                    "error": error_msg,
                    "error_type": type(e).__name__
                },
                exc_info=True
            )
            
            # 常见错误类型识别
            if "API key" in error_msg or "authentication" in error_msg.lower():
                raise RuntimeError(f"模型认证失败，请检查 API Key 配置: {error_msg}")
            elif "rate limit" in error_msg.lower():
                raise RuntimeError(f"模型调用频率超限，请稍后重试: {error_msg}")
            elif "timeout" in error_msg.lower():
                raise RuntimeError(f"模型调用超时，请检查网络连接: {error_msg}")
            elif "connection" in error_msg.lower():
                raise RuntimeError(f"无法连接到模型服务，请检查网络和配置: {error_msg}")
            else:
                raise RuntimeError(f"模型调用失败: {error_msg}")
    

    

    async def text_to_speech_async(
        self,
        text: str,
        tts_provider: Optional[str] = None,
        language: Optional[str] = None
    ) -> bytes:
        """异步文本转语音
        
        Args:
            text: 要转换的文本
            tts_provider: TTS提供商，不指定则使用默认
            language: 语言代码，不指定则使用TTS配置的默认值
            
        Returns:
            音频数据（bytes）
        """
        tts = self.tts_factory.create_tts(tts_provider)
        return await tts.synthesize_async(text, language)
