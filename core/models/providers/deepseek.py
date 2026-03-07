"""DeepSeek 供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField


class DeepSeekProvider(BaseProvider):
    """DeepSeek 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="deepseek",
            name="DeepSeek",
            description="DeepSeek - 高性能开源 AI 模型",

            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="DeepSeek API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="https://api.deepseek.com", description="API基础URL（用于代理或自定义端点）"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={}
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_openai import ChatOpenAI
        
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url", "https://api.deepseek.com"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "top_p": merged.get("top_p"),
            "streaming": merged.get("streaming"),
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        return ChatOpenAI(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        raise NotImplementedError("DeepSeek 不支持嵌入模型")
