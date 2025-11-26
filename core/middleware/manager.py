"""中间件管理器"""
from typing import List, Optional, Any
from .config import MiddlewareConfig, SummarizationConfig


class MiddlewareManager:
    """中间件管理器
    
    负责：
    - 管理角色的中间件配置
    - 创建中间件实例
    - 配置的持久化
    """
    
    def __init__(self, app_storage):
        """初始化中间件管理器
        
        Args:
            app_storage: 应用存储实例
        """
        self.app_storage = app_storage
    
    def get_character_middleware(self, character_id: int) -> List[Any]:
        """获取角色的中间件列表
        
        Args:
            character_id: 角色ID
            
        Returns:
            中间件实例列表
        """
        # 从数据库获取配置
        config_dict = self.app_storage.get_middleware_config(character_id)
        if not config_dict:
            return []
        
        # 确保 config_dict 包含 character_id
        if "character_id" not in config_dict:
            config_dict["character_id"] = character_id
        
        middleware_config = MiddlewareConfig.from_dict(config_dict)
        middlewares = []
        
        # 创建摘要中间件
        if middleware_config.summarization and middleware_config.summarization.enabled:
            summarization_mw = self._create_summarization_middleware(
                middleware_config.summarization
            )
            if summarization_mw:
                middlewares.append(summarization_mw)
        
        return middlewares
    
    def _create_summarization_middleware(
        self,
        config: SummarizationConfig
    ) -> Optional[Any]:
        """创建摘要中间件实例
        
        Args:
            config: 摘要配置
            
        Returns:
            中间件实例或 None
        """
        try:
            from langchain.agents.middleware import SummarizationMiddleware
            
            # 构建 trigger 配置
            trigger = {}
            if config.trigger_tokens:
                trigger["tokens"] = config.trigger_tokens
            if config.trigger_messages:
                trigger["messages"] = config.trigger_messages
            
            # 构建 keep 配置
            keep = {"messages": config.keep_messages}
            
            return SummarizationMiddleware(
                model=config.model,
                trigger=trigger,
                keep=keep
            )
        except ImportError:
            print("警告: SummarizationMiddleware 不可用")
            return None
    
    def save_middleware_config(
        self,
        character_id: int,
        config: MiddlewareConfig
    ) -> bool:
        """保存中间件配置
        
        Args:
            character_id: 角色ID
            config: 中间件配置
            
        Returns:
            是否成功保存
        """
        return self.app_storage.save_middleware_config(
            character_id,
            config.to_dict()
        )
    
    def update_summarization_config(
        self,
        character_id: int,
        enabled: Optional[bool] = None,
        model: Optional[str] = None,
        trigger_tokens: Optional[int] = None,
        trigger_messages: Optional[int] = None,
        keep_messages: Optional[int] = None
    ) -> bool:
        """更新摘要中间件配置
        
        Args:
            character_id: 角色ID
            enabled: 是否启用
            model: 摘要模型
            trigger_tokens: 触发 token 数
            trigger_messages: 触发消息数
            keep_messages: 保留消息数
            
        Returns:
            是否成功更新
        """
        # 获取现有配置
        existing = self.app_storage.get_middleware_config(character_id)
        if existing:
            config = MiddlewareConfig.from_dict(existing)
        else:
            config = MiddlewareConfig(
                character_id=character_id,
                summarization=SummarizationConfig()
            )
        
        # 更新摘要配置
        if config.summarization is None:
            config.summarization = SummarizationConfig()
        
        if enabled is not None:
            config.summarization.enabled = enabled
        if model is not None:
            config.summarization.model = model
        if trigger_tokens is not None:
            config.summarization.trigger_tokens = trigger_tokens
        if trigger_messages is not None:
            config.summarization.trigger_messages = trigger_messages
        if keep_messages is not None:
            config.summarization.keep_messages = keep_messages
        
        return self.save_middleware_config(character_id, config)
