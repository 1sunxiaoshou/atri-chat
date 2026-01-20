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
            logo="/static/logos/google.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Google API密钥"),
            ],
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
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
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
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        return GoogleGenerativeAIEmbeddings(**params)
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取 Google 模型信息 - 从 API 获取"""
        from google import genai
        from ...logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        
        try:
            # 使用 Google GenAI API 获取模型信息
            client = genai.Client(api_key=config.get("api_key"))
            
            # 处理模型名称格式（可能需要添加 "models/" 前缀）
            model_name = model_id if model_id.startswith("models/") else f"models/{model_id}"
            model = client.models.get(model=model_name)
            
            logger.debug(f"从 API 获取模型信息: {model_id}, "
                        f"input_limit: {model.input_token_limit}, "
                        f"output_limit: {model.output_token_limit}")
            
            # 根据模型 ID 推断类型和能力
            model_id_lower = model_id.lower()
            
            # 嵌入模型
            if "embed" in model_id_lower or "embedding" in model_id_lower:
                return ProviderModelInfo(
                    model_id=model_id,
                    type=ModelType.EMBEDDING,
                    capabilities=[],
                    context_window=model.input_token_limit,
                    max_output=model.output_token_limit,
                )
            
            # 聊天模型
            capabilities = []
            
            # Gemini 系列支持多模态
            if "gemini" in model_id_lower:
                capabilities.extend([
                    ModelCapability.VISION,
                    ModelCapability.DOCUMENT,
                    ModelCapability.VIDEO,
                    ModelCapability.AUDIO,
                    ModelCapability.TOOL_USE
                ])
            
            # 推理能力（从 API 返回的 thinking 字段判断）
            if hasattr(model, 'thinking') and model.thinking:
                capabilities.append(ModelCapability.REASONING)
            elif "thinking" in model_id_lower or "2.5" in model_id_lower or "3" in model_id_lower:
                capabilities.append(ModelCapability.REASONING)
            
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.CHAT,
                capabilities=capabilities,
                context_window=model.input_token_limit,
                max_output=model.output_token_limit,
            )
            
        except Exception as e:
            logger.warning(f"无法从 API 获取模型信息 {model_id}: {e}，使用默认推断")
            # 降级到基于名称的推断
            return super().get_model_info(model_id, provider_config)
