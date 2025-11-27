"""供应商抽象基类和具体实现"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List
from .config import ModelConfig, ProviderConfig, ModelType, ProviderMetadata


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
            **kwargs: 动态参数（temperature, max_tokens等）
        """
        pass
    
    @abstractmethod
    def create_embedding_model(
        self, 
        model_id: str, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Any:
        """创建嵌入模型
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            **kwargs: 动态参数
        """
        pass
    
    def _merge_params(self, config: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """合并配置参数，kwargs 优先级高于 config
        
        仅合并显式提供的参数，未提供的参数由模型实例化方法使用自己的默认值
        
        Args:
            config: 供应商配置字典
            **kwargs: 运行时参数
            
        Returns:
            合并后的参数字典（仅包含显式提供的参数）
        """
        merged = {}
        
        # temperature: kwargs > config
        if "temperature" in kwargs:
            merged["temperature"] = kwargs["temperature"]
        elif "temperature" in config:
            merged["temperature"] = config["temperature"]
        
        # max_tokens: kwargs > config
        if "max_tokens" in kwargs:
            merged["max_tokens"] = kwargs["max_tokens"]
        elif "max_tokens" in config:
            merged["max_tokens"] = config["max_tokens"]
        
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
        """
        try:
            if model_config.model_type == ModelType.TEXT:
                return self.create_text_model(model_config.model_id, provider_config, **kwargs)
            elif model_config.model_type == ModelType.EMBEDDING:
                return self.create_embedding_model(model_config.model_id, provider_config, **kwargs)
        except Exception as e:
            print(f"创建模型失败 ({self.metadata.provider_id}/{model_config.model_id}): {e}")
        return None


class OpenAIProvider(BaseProvider):
    """OpenAI 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        from .config import ConfigField
        return ProviderMetadata(
            provider_id="openai",
            name="OpenAI",
            description="OpenAI API provider for GPT models",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="OpenAI API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="https://api.openai.com/v1", description="API基础URL"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_openai import ChatOpenAI
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
            **merged,
        }
        
        return ChatOpenAI(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_openai import OpenAIEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
        }
        
        return OpenAIEmbeddings(**params)


class AnthropicProvider(BaseProvider):
    """Anthropic 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        from .config import ConfigField
        return ProviderMetadata(
            provider_id="anthropic",
            name="Anthropic",
            description="Anthropic Claude API provider",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Anthropic API密钥"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_anthropic import ChatAnthropic
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            **merged,
        }
        
        return ChatAnthropic(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        raise NotImplementedError("Anthropic 不支持嵌入模型")


class GoogleProvider(BaseProvider):
    """Google 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        from .config import ConfigField
        return ProviderMetadata(
            provider_id="google",
            name="Google",
            description="Google Generative AI provider",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Google API密钥"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_google_genai import ChatGoogleGenerativeAI
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        # Google 使用 max_output_tokens 而不是 max_tokens
        if "temperature" in merged:
            params["temperature"] = merged["temperature"]
        if "max_tokens" in merged:
            params["max_output_tokens"] = merged["max_tokens"]
        
        return ChatGoogleGenerativeAI(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        return GoogleGenerativeAIEmbeddings(**params)


class TongyiProvider(BaseProvider):
    """通义千问供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        from .config import ConfigField
        return ProviderMetadata(
            provider_id="tongyi",
            name="Tongyi",
            description="Alibaba Tongyi Qianwen API provider",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="通义千问API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, description="API基础URL"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.chat_models.tongyi import ChatTongyi
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
            **merged,
        }
        
        return ChatTongyi(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        raise NotImplementedError("通义千问暂不支持嵌入模型")


class LocalProvider(BaseProvider):
    """本地模型供应商（Ollama）"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        from .config import ConfigField
        return ProviderMetadata(
            provider_id="local",
            name="Local Model",
            description="Local model provider (Ollama, vLLM, etc.)",
            config_fields=[
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="http://localhost:11434", description="Ollama服务地址"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.chat_models import ChatOllama
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
            **merged,
        }
        
        return ChatOllama(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.embeddings import OllamaEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
        }
        
        return OllamaEmbeddings(**params)
