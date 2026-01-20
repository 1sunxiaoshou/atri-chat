"""供应商抽象基类"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List
from ..config import ModelConfig, ProviderConfig, ModelType, ProviderMetadata, ProviderModelInfo


class BaseProvider(ABC):
    """供应商基类"""
    
    @property
    @abstractmethod
    def metadata(self) -> ProviderMetadata:
        """供应商元数据"""
        pass
    
    @abstractmethod
    def create_text_model(
        self, 
        model_id: str, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Any:
        """创建文本模型
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            **kwargs: 动态参数（temperature, max_tokens, provider_options等）
        """
        pass
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取供应商特定参数
        
        子类可以覆盖此方法来处理供应商特定的参数，例如：
        - Claude: thinking (type, budgetTokens)
        - OpenAI: reasoningEffort (low, medium, high)
        - Google: thinkingConfig (thinkingBudget, includeThoughts)
        
        Args:
            **kwargs: 包含 provider_options 的参数
            
        Returns:
            供应商特定参数字典
            
        注意：
            - provider_options 应该是一个嵌套字典，格式为：
              {"provider_name": {"param1": value1, "param2": value2}}
            - 子类应该只提取自己供应商的参数
        """
        return kwargs.get("provider_options", {})
    
    def _merge_params(self, config: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        合并配置参数，优先级：kwargs > config
        
        Args:
            config: 供应商配置
            **kwargs: 动态参数
            
        Returns:
            合并后的参数字典
        """
        # 先取 config 的副本
        merged = {k: v for k, v in config.items() if v is not None}
        
        # 过滤掉 None 值
        filtered_kwargs = {k: v for k, v in kwargs.items() if v is not None}
        
        # kwargs 覆盖 config
        merged.update(filtered_kwargs)
        
        return merged
    
    def create_model(
        self, 
        model_config: ModelConfig, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Optional[Any]:
        """根据模型类型创建模型
        
        Args:
            model_config: 模型配置
            provider_config: 供应商配置
            **kwargs: 动态参数（会覆盖 provider_config 中的默认值）
            
        Raises:
            ValueError: 当模型类型不支持或创建失败时
        """
        if model_config.model_type == ModelType.CHAT:
            return self.create_text_model(model_config.model_id, provider_config, **kwargs)
        elif model_config.model_type == ModelType.EMBEDDING:
            return self.create_embedding_model(model_config.model_id, provider_config, **kwargs)
        else:
            raise ValueError(f"不支持的模型类型: {model_config.model_type}")
    
    def create_embedding_model(
        self, 
        model_id: str, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Any:
        """创建嵌入模型（通用实现，使用 OpenAI 兼容接口）
        
        子类可以重写此方法以支持特定的嵌入模型创建逻辑。
        默认实现使用 langchain_openai.OpenAIEmbeddings。
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            **kwargs: 动态参数
        """
        from langchain_openai import OpenAIEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        # 如果有 base_url，添加它
        if "base_url" in config:
            params["base_url"] = config["base_url"]
        
        return OpenAIEmbeddings(**params)
    
    def list_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """获取模型列表 - 从 API 动态获取
        
        子类可以重写此方法以支持特定的模型列表获取逻辑。
        默认实现使用 OpenAI 兼容接口。
        
        Args:
            provider_config: 供应商配置
            
        Returns:
            ProviderModelInfo 列表
            
        Raises:
            Exception: 当 API 调用失败时抛出异常
        """
        from openai import OpenAI
        config = provider_config.config_json
        
        client = OpenAI(
            api_key=config.get("api_key"),
            base_url=config.get("base_url", "https://api.openai.com/v1")
        )
        
        models = client.models.list()
        result = []
        
        for model in models.data:
            # 调用子类的 get_model_info 获取详细信息
            model_info = self.get_model_info(model.id, provider_config)
            result.append(model_info)
        
        return result
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取模型信息
        
        子类应该重写此方法以提供准确的模型类型和能力信息。
        默认实现根据模型ID的命名规则推断。
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            
        Returns:
            ProviderModelInfo 对象
        """
        from ..config import ModelCapability
        
        # 默认实现：根据模型名称推断
        model_id_lower = model_id.lower()
        
        if "embed" in model_id_lower:
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.EMBEDDING,
                capabilities=[],
            )
        elif "rerank" in model_id_lower:
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.RERANK,
                capabilities=[],
            )
        else:
            # 默认为聊天模型
            capabilities = []
            if "vision" in model_id_lower or "vl" in model_id_lower:
                capabilities.extend([ModelCapability.VISION, ModelCapability.DOCUMENT])
            if "audio" in model_id_lower:
                capabilities.append(ModelCapability.AUDIO)
            if "video" in model_id_lower:
                capabilities.append(ModelCapability.VIDEO)
            if "function" in model_id_lower or "tool" in model_id_lower:
                capabilities.append(ModelCapability.TOOL_USE)
            
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.CHAT,
                capabilities=capabilities,
            )
