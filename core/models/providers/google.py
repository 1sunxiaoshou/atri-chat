"""Google 供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class GoogleProvider(BaseProvider):
    """Google 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="google",
            name="Google",
            description="Google Gemini - 多模态 AI 模型,支持文本、代码、图像、音频和视频",

            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, sensitive=True, description="Google AI API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="https://generativelanguage.googleapis.com", description="API基础URL（用于代理或自定义端点）"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={
                "thinking_config": {
                    "type": "object",
                    "label": "思考配置",
                    "description": "控制 Gemini 的思考功能",
                    "fields": {
                        "thinking_budget": {
                            "type": "number",
                            "label": "思考预算 (tokens)",
                            "description": "分配给思考过程的 token 数量",
                            "min": 1024,
                            "default": 8192
                        },
                        "include_thoughts": {
                            "type": "boolean",
                            "label": "包含思考过程",
                            "description": "是否在响应中包含思考过程",
                            "default": True
                        }
                    },
                    "applicable_capabilities": ["reasoning"]
                }
            }
        )
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取 Google 特定参数"""
        provider_options = kwargs.get("provider_options", {})
        google_options = provider_options.get("google", {})
        
        result = {}
        
        # Google 的 thinkingConfig: { thinkingBudget: number, includeThoughts: boolean }
        if "thinking_config" in google_options:
            result["thinking_config"] = google_options["thinking_config"]
        
        return result
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_payload
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
            "temperature": merged.get("temperature"),
            "max_output_tokens": merged.get("max_tokens"),  # Google 使用 max_output_tokens
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        # 处理 provider_options
        provider_opts = self.get_provider_options(**kwargs)
        if provider_opts.get("thinking_config"):
            thinking_config = provider_opts["thinking_config"]
            if "thinking_budget" in thinking_config:
                params["thinking_budget"] = thinking_config["thinking_budget"]
            if "include_thoughts" in thinking_config:
                params["include_thoughts"] = thinking_config["include_thoughts"]
            logger.debug(f"Google thinkingConfig: {thinking_config}")
        
        return ChatGoogleGenerativeAI(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        config = provider_config.config_payload
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        return GoogleGenerativeAIEmbeddings(**params)
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取 Google 模型信息 - 使用 LangChain profile"""
        # 直接使用 BaseProvider 的 profile 功能
        return super().get_model_info(model_id, provider_config)
