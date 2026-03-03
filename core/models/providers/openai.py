"""OpenAI 供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class OpenAIProvider(BaseProvider):
    """OpenAI 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="openai",
            name="OpenAI",
            description="OpenAI API provider for GPT models",
            logo="/static/logos/openai.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="OpenAI API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="https://api.openai.com/v1", description="API基础URL"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={
                "reasoning_effort": {
                    "type": "segmented",  # 使用 segmented 类型
                    "label": "深度思考",
                    "description": "控制 o1/o3 系列模型的推理强度",
                    "options": [
                        {"value": "low", "label": "低"},
                        {"value": "medium", "label": "中"},
                        {"value": "high", "label": "高"}
                    ],
                    "default": "medium",
                    "applicable_capabilities": ["reasoning"],
                    "order": 1  # 排在最前面
                }
            }
        )
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取 OpenAI 特定参数"""
        provider_options = kwargs.get("provider_options", {})
        openai_options = provider_options.get("openai", {})
        
        result = {}
        
        # OpenAI 的 reasoningEffort: 'low' | 'medium' | 'high'
        if "reasoning_effort" in openai_options:
            result["reasoning_effort"] = openai_options["reasoning_effort"]
        
        return result
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_openai import ChatOpenAI
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "top_p": merged.get("top_p"),
            "streaming": merged.get("streaming"),
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        # 处理 provider_options
        provider_opts = self.get_provider_options(**kwargs)
        if provider_opts.get("reasoning_effort"):
            params["model_kwargs"] = params.get("model_kwargs", {})
            params["model_kwargs"]["reasoning_effort"] = provider_opts["reasoning_effort"]
            logger.debug(f"OpenAI reasoning_effort: {provider_opts['reasoning_effort']}")
        
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
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取 OpenAI 模型信息 - 使用 LangChain profile"""
        # 直接使用 BaseProvider 的 profile 功能
        return super().get_model_info(model_id, provider_config)
