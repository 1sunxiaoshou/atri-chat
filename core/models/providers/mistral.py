"""Mistral AI 供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField


class MistralProvider(BaseProvider):
    """Mistral AI 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="mistral",
            name="Mistral AI",
            description="Mistral AI - 欧洲领先的开源 AI 模型提供商",
            logo="/static/logos/mistral.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Mistral API密钥"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={}
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_mistralai import ChatMistralAI
        
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "top_p": merged.get("top_p"),
            "streaming": merged.get("streaming"),
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        return ChatMistralAI(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_mistralai import MistralAIEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        return MistralAIEmbeddings(**params)
