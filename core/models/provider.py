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
        """
        合并配置参数，kwargs 优先级高于 config。
        仅包含在 kwargs 或 config 中显式提供的参数。
        """
        # 先取 config 的副本，再用 kwargs 覆盖
        merged = {k: v for k, v in config.items() if v is not None}
        merged.update({k: v for k, v in kwargs.items() if v is not None})
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
        if model_config.model_type == ModelType.TEXT:
            return self.create_text_model(model_config.model_id, provider_config, **kwargs)
        elif model_config.model_type == ModelType.EMBEDDING:
            return self.create_embedding_model(model_config.model_id, provider_config, **kwargs)
        else:
            raise ValueError(f"不支持的模型类型: {model_config.model_type}")


class OpenAIProvider(BaseProvider):
    """OpenAI 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        from .config import ConfigField
        return ProviderMetadata(
            provider_id="openai",
            name="OpenAI",
            description="OpenAI API provider for GPT models",
            logo="/static/logos/openai.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="OpenAI API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="https://api.openai.com/v1", description="API基础URL"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_openai import ChatOpenAI
        from ..logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
        }
        
        # 添加标准参数
        if "temperature" in merged:
            params["temperature"] = merged["temperature"]
        if "max_tokens" in merged:
            params["max_tokens"] = merged["max_tokens"]
        if "top_p" in merged:
            params["top_p"] = merged["top_p"]
        if "streaming" in merged:
            params["streaming"] = merged["streaming"]
        
        # 处理深度思考参数
        if merged.get("enable_thinking"):
            thinking_config = merged.get("thinking_config", {})
            # OpenAI 的 extended_thinking 参数
            if "budget" in thinking_config:
                params["prediction"] = {"type": "content", "content": [{"type": "extended_thinking", "budget": thinking_config["budget"]}]}
                logger.info(f"启用深度思考 (OpenAI): model={model_id}, budget={thinking_config['budget']}")
            else:
                # 默认启用 extended_thinking
                params["prediction"] = {"type": "content", "content": [{"type": "extended_thinking"}]}
                logger.info(f"启用深度思考 (OpenAI): model={model_id}, budget=auto")
        
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
            logo="/static/logos/anthropic.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Anthropic API密钥"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_anthropic import ChatAnthropic
        from ..logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        # 添加标准参数
        if "temperature" in merged:
            params["temperature"] = merged["temperature"]
        if "max_tokens" in merged:
            params["max_tokens"] = merged["max_tokens"]
        if "top_p" in merged:
            params["top_p"] = merged["top_p"]
        if "streaming" in merged:
            params["streaming"] = merged["streaming"]
        
        # 处理深度思考参数 (Anthropic 使用 thinking 参数)
        if merged.get("enable_thinking"):
            thinking_config = merged.get("thinking_config", {})
            thinking_params = {"type": "enabled"}
            
            # Anthropic 的 budget_tokens 参数（最小1024，最大128000）
            if "budget" in thinking_config and thinking_config["budget"]:
                thinking_params["budget_tokens"] = thinking_config["budget"]
                logger.info(f"启用深度思考 (Anthropic): model={model_id}, budget_tokens={thinking_config['budget']}")
            else:
                logger.info(f"启用深度思考 (Anthropic): model={model_id}, budget_tokens=auto")
            
            params["thinking"] = thinking_params
        
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
            logo="/static/logos/google.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Google API密钥"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from ..logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
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
        
        # 处理深度思考参数 (Google 使用 thinking_level 或 thinking_budget)
        if merged.get("enable_thinking"):
            thinking_config = merged.get("thinking_config", {})
            
            # Gemini 3 使用 thinking_level: "LOW" 或 "HIGH"
            if "level" in thinking_config and thinking_config["level"]:
                params["thinking_level"] = thinking_config["level"].upper()
                logger.info(f"启用深度思考 (Google): model={model_id}, thinking_level={thinking_config['level']}")
            # Gemini 2.5 使用 thinking_budget (token数量)
            elif "budget" in thinking_config and thinking_config["budget"]:
                params["thinking_budget"] = thinking_config["budget"]
                logger.info(f"启用深度思考 (Google): model={model_id}, thinking_budget={thinking_config['budget']}")
            else:
                # 默认使用 HIGH level
                params["thinking_level"] = "HIGH"
                logger.info(f"启用深度思考 (Google): model={model_id}, thinking_level=HIGH")
        
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
            description="阿里旗下的百炼大模型服务平台",
            logo="/static/logos/tongyi.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="通义千问API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, description="API基础URL"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.chat_models.tongyi import ChatTongyi
        from ..logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        # 构建 model_kwargs，用于传递额外参数
        model_kwargs = {}
        
        # 处理深度思考参数 (Tongyi/Qwen 使用 enable_thinking)
        if merged.get("enable_thinking"):
            model_kwargs["enable_thinking"] = True
            # 当启用 enable_thinking 时，流式模式下必须设置 incremental_output=True
            model_kwargs["incremental_output"] = True
            logger.info(f"启用深度思考 (Tongyi): model={model_id}, incremental_output=True")
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
            "model_kwargs": model_kwargs,
        }
        
        # 添加标准参数（直接作为参数，不放在 model_kwargs 中）
        if "temperature" in merged:
            params["temperature"] = merged["temperature"]
        if "max_tokens" in merged:
            params["max_tokens"] = merged["max_tokens"]
        if "top_p" in merged:
            params["top_p"] = merged["top_p"]
        if "streaming" in merged:
            params["streaming"] = merged["streaming"]
        
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
            logo="/static/logos/local.png",
            config_fields=[
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="http://localhost:11434", description="Ollama服务地址"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.chat_models import ChatOllama
        from ..logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
        }
        
        # 添加标准参数
        for key in ["temperature", "max_tokens", "top_p"]:
            if key in merged:
                params[key] = merged[key]
        
        # 处理深度思考参数 (Ollama 支持 enable_thinking，用于 Qwen 等模型)
        # 通过 kwargs 传递给底层 API
        if merged.get("enable_thinking"):
            # Ollama 的某些模型（如 Qwen）支持 enable_thinking
            # 将其作为额外参数传递
            params["enable_thinking"] = True
            logger.info(f"启用深度思考 (Local/Ollama): model={model_id}")
        
        return ChatOllama(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.embeddings import OllamaEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
        }
        
        return OllamaEmbeddings(**params)
