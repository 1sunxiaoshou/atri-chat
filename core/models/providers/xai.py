"""xAI (Grok) 供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField


class XAIProvider(BaseProvider):
    """xAI (Grok) 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="xai",
            name="xAI",
            description="xAI - Grok 系列模型",
            logo="/static/logos/xai.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="xAI API密钥"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={}
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_xai import ChatXAI
        
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "streaming": merged.get("streaming"),
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        return ChatXAI(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        raise NotImplementedError("xAI 不支持嵌入模型")
