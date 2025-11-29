"""Agent 业务逻辑管理器"""
import sqlite3
from typing import Dict, Tuple, Optional, Any, List, Union
from pathlib import Path
from langchain.agents import create_agent
from langgraph.checkpoint.sqlite import SqliteSaver
from .store import SqliteStore
from .storage import AppStorage
from .models.factory import ModelFactory
from .tools.manager import ToolManager
from .tools.registry import ToolRegistry
from .middleware.manager import MiddlewareManager
from .asr.factory import ASRFactory
from .tts.factory import TTSFactory


class AgentManager:
    """Agent 业务逻辑管理核心
    
    负责管理 Agent 实例的生命周期、处理消息发送、会话切换等业务逻辑。
    """
    
    def __init__(
        self,
        app_storage: AppStorage,
        store: SqliteStore,
        checkpointer: SqliteSaver,
        tool_registry: Optional[ToolRegistry] = None,
        tts_config_path: str = "config/tts.yaml"
    ):
        """初始化 AgentManager
        
        Args:
            app_storage: 应用存储实例（角色、会话、消息）
            store: 长期记忆存储实例（跨会话数据）
            checkpointer: 检查点存储实例（对话历史）
            tool_registry: 工具注册表实例（可选）
            tts_config_path: TTS配置文件路径
        """
        self.app_storage = app_storage
        self.store = store
        self.checkpointer = checkpointer
        self.model_factory = ModelFactory(app_storage)
        
        # 工具和中间件管理
        self.tool_registry = tool_registry or ToolRegistry()
        self.tool_manager = ToolManager(app_storage, self.tool_registry)
        self.middleware_manager = MiddlewareManager(app_storage)
        
        # ASR和TTS管理
        self.asr_factory = ASRFactory(db_path=app_storage.db_path)
        self.tts_factory = TTSFactory(tts_config_path)
        
        # Agent 实例缓存：{(character_id, model_id, provider_id): agent}
        self._agent_cache: Dict[Tuple[int, str, str], Any] = {}
    
    def get_or_create_agent(
        self,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ) -> Any:
        """获取或创建 Agent 实例
        
        Args:
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            **model_kwargs: 模型动态参数（temperature, max_tokens等）
            
        Returns:
            Agent 实例
            
        Raises:
            ValueError: 当角色或模型不存在时
            
        Note:
            如果传入了 model_kwargs，将不使用缓存，每次都创建新实例
        """
        cache_key = (character_id, model_id, provider_id)
        
        # 如果有动态参数，不使用缓存
        if model_kwargs:
            return self._create_agent(character_id, model_id, provider_id, **model_kwargs)
        
        # 检查缓存
        if cache_key in self._agent_cache:
            return self._agent_cache[cache_key]
        
        # 创建新实例并缓存
        agent = self._create_agent(character_id, model_id, provider_id)
        self._agent_cache[cache_key] = agent
        
        return agent
    
    def _create_agent(
        self,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ) -> Any:
        """创建 Agent 实例
        
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
        try:
            # 1. 获取角色配置（包含 system_prompt）
            character = self.app_storage.get_character(character_id)
            if not character:
                raise ValueError(f"角色 {character_id} 不存在")
            
            # 2. 使用 ModelFactory 创建模型实例（支持动态参数）
            # ModelFactory.create_model 现在会抛出详细的 ValueError
            model = self.model_factory.create_model(provider_id, model_id, **model_kwargs)
            
            # 3. 获取角色的工具列表
            tools = self.tool_manager.get_character_tools(character_id)
            
            # 4. 获取角色的中间件列表
            middlewares = self.middleware_manager.get_character_middleware(character_id)
            
            # 5. 创建 agent（使用角色的 system_prompt、工具和中间件）
            agent = create_agent(
                model=model,
                tools=tools,
                middleware=middlewares,
                system_prompt=character["system_prompt"],
                checkpointer=self.checkpointer,
                store=self.store
            )
            
            return agent
            
        except ValueError:
            # 重新抛出 ValueError（包含详细错误信息）
            raise
        except Exception as e:
            # 捕获其他异常并转换为 ValueError
            raise ValueError(f"创建 Agent 失败: {str(e)}")
    

    async def send_message_stream(
        self,
        user_message: str,
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str
    ):
        """异步流式发送消息并获取响应
        
        Args:
            user_message: 用户消息内容
            conversation_id: 会话ID
            character_id: 角色ID
            model_id: 模型ID
            provider_id: 供应商ID
            
        Yields:
            流式响应的文本块
            
        Raises:
            ValueError: 当会话、角色或模型不存在时
            RuntimeError: 当模型调用失败时
        """
        # 1. 验证会话是否存在
        conversation = self.app_storage.get_conversation(conversation_id)
        if not conversation:
            raise ValueError(f"会话 {conversation_id} 不存在")
        
        try:
            # 2. 获取或创建 agent 实例（启用流式模式）
            agent = self.get_or_create_agent(character_id, model_id, provider_id, streaming=True)
            
            full_response = ""
            
            # 3. 异步流式调用 agent
            async for event in agent.astream(
                {"messages": [{"role": "user", "content": user_message}]},
                config={"configurable": {"thread_id": str(conversation_id)}},
                stream_mode="messages"
            ):
                # event 是 (message, metadata) 元组
                if isinstance(event, tuple) and len(event) == 2:
                    message, metadata = event
                    # 检查是否是 AIMessageChunk（流式块）
                    if hasattr(message, 'content') and message.content:
                        chunk = message.content
                        full_response += chunk
                        yield chunk
            
            # 4. 流结束后保存完整对话
            self.app_storage.add_message(conversation_id, "user", user_message)
            self.app_storage.add_message(conversation_id, "assistant", full_response)
            
            # 5. 如果是新会话，自动生成标题
            if conversation["title"] == "New Chat":
                title = user_message.replace("\n", " ").strip()
                if len(title) > 30:
                    title = title[:30] + "..."
                self.app_storage.update_conversation(conversation_id, title=title)
                
        except ValueError:
            # 重新抛出 ValueError（配置错误）
            raise
        except Exception as e:
            # 捕获模型调用异常
            error_msg = str(e)
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
    
    def clear_agent_cache(self, character_id: Optional[int] = None) -> int:
        """清空 Agent 缓存
        
        用于配置更新后强制重新创建 agent 实例。
        
        Args:
            character_id: 可选，只清空指定角色的缓存
            
        Returns:
            清空的缓存数量
        """
        if character_id is None:
            # 清空所有缓存
            count = len(self._agent_cache)
            self._agent_cache.clear()
            return count
        else:
            # 只清空指定角色的缓存
            keys_to_remove = [
                key for key in self._agent_cache.keys()
                if key[0] == character_id
            ]
            for key in keys_to_remove:
                del self._agent_cache[key]
            return len(keys_to_remove)
    
    def get_cache_info(self) -> Dict[str, Any]:
        """获取缓存信息
        
        Returns:
            包含缓存统计的字典
        """
        return {
            "cached_agents": len(self._agent_cache),
            "cache_keys": [
                {
                    "character_id": key[0],
                    "model_id": key[1],
                    "provider_id": key[2]
                }
                for key in self._agent_cache.keys()
            ]
        }
    

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
