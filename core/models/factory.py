"""模型工厂"""
from typing import Optional, Any, TYPE_CHECKING
from .config import ModelConfig, ModelType, TextMode

if TYPE_CHECKING:
    from ..storage import AppStorage


class ModelFactory:
    """模型工厂"""
    
    def __init__(self, storage: "AppStorage"):
        self.storage = storage
    
    def create_model(self, provider_id: str, model_id: str) -> Optional[Any]:
        """根据provider_id和model_id创建模型实例"""
        model_config = self.storage.get_model(provider_id, model_id)
        if not model_config or not model_config.enabled:
            return None
        
        if model_config.provider_id != provider_id:
            return None
        
        provider_config = self.storage.get_provider(provider_id)
        if not provider_config:
            return None
        
        # 根据供应商和模型类型创建实例
        if model_config.model_type == ModelType.TEXT:
            return self._create_text_model(provider_id, model_config, provider_config)
        elif model_config.model_type == ModelType.EMBEDDING:
            return self._create_embedding_model(provider_id, model_config, provider_config)
        
        return None
    
    def _create_text_model(self, provider_id: str, model_config: ModelConfig, provider_config) -> Optional[Any]:
        """创建文本模型"""
        config = provider_config.config_json
        model_id = model_config.model_id
        
        if provider_id == "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=model_id,
                api_key=config.get("api_key"),
                base_url=config.get("base_url"),
                temperature=config.get("temperature", 0.7),
                max_tokens=config.get("max_tokens")
            )
        
        elif provider_id == "tongyi":
            from langchain_community.chat_models.tongyi import ChatTongyi
            return ChatTongyi(
                model=model_id,
                api_key=config.get("api_key"),
                base_url=config.get("base_url"),
                temperature=config.get("temperature", 0.7),
                max_tokens=config.get("max_tokens")
            )
        
        elif provider_id == "anthropic":
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model=model_id,
                api_key=config.get("api_key"),
                temperature=config.get("temperature", 0.7),
                max_tokens=config.get("max_tokens")
            )
        
        elif provider_id == "google":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=model_id,
                api_key=config.get("api_key"),
                temperature=config.get("temperature", 0.7),
                max_output_tokens=config.get("max_tokens")
            )
        
        return None
    
    def _create_embedding_model(self, provider_name: str, model_config: ModelConfig, provider_config) -> Optional[Any]:
        """创建嵌入模型"""
        config = provider_config.config_json
        
        if provider_name == "openai":
            from langchain_openai import OpenAIEmbeddings
            return OpenAIEmbeddings(
                model=model_config.model_name,
                api_key=config.get("api_key"),
                base_url=config.get("base_url")
            )

        elif provider_name == "google":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            return GoogleGenerativeAIEmbeddings(
                model=model_config.model_name,
                api_key=config.get("api_key")
            )
        
        return None
