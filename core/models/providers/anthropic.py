"""Anthropic 供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class AnthropicProvider(BaseProvider):
    """Anthropic 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="anthropic",
            name="Anthropic",
            description="Anthropic Claude API provider",
            logo="/static/logos/anthropic.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="Anthropic API密钥"),
            ],
            provider_options_schema={
                "thinking": {
                    "type": "object",
                    "label": "深度思考配置",
                    "description": "控制 Claude 的深度思考功能",
                    "fields": {
                        "type": {
                            "type": "select",
                            "label": "启用状态",
                            "options": [
                                {"value": "enabled", "label": "启用"},
                                {"value": "disabled", "label": "禁用"}
                            ],
                            "default": "enabled"
                        },
                        "budget_tokens": {
                            "type": "number",
                            "label": "思考预算 (tokens)",
                            "description": "最小 1024，最大 128000",
                            "min": 1024,
                            "max": 128000,
                            "default": 10000
                        }
                    },
                    "applicable_capabilities": ["reasoning"]
                }
            }
        )
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取 Claude 特定参数"""
        provider_options = kwargs.get("provider_options", {})
        claude_options = provider_options.get("claude", {})
        
        result = {}
        
        # Claude 的 thinking: { type: 'enabled' | 'disabled', budgetTokens: number }
        if "thinking" in claude_options:
            result["thinking"] = claude_options["thinking"]
        
        return result
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_anthropic import ChatAnthropic
        from ...logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
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
        
        # 处理 provider_options
        provider_opts = self.get_provider_options(**kwargs)
        if provider_opts.get("thinking"):
            params["thinking"] = provider_opts["thinking"]
            logger.debug(f"Claude thinking: {provider_opts['thinking']}")
        
        return ChatAnthropic(**params)
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        raise NotImplementedError("Anthropic 不支持嵌入模型")
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取 Claude 模型信息 - 从 API 获取"""
        from anthropic import Anthropic
        from ...logger import get_logger
        
        logger = get_logger(__name__, category="MODEL")
        config = provider_config.config_json
        
        try:
            # 使用 Anthropic API 获取模型信息
            client = Anthropic(api_key=config.get("api_key"))
            model = client.models.retrieve(model_id)
            
            logger.debug(f"从 API 获取模型信息: {model_id}, display_name: {model.display_name}")
            
            # 根据模型 ID 推断能力
            capabilities = []
            model_id_lower = model_id.lower()
            
            # Claude 3/4 系列支持多模态
            if "claude-3" in model_id_lower or "claude-4" in model_id_lower:
                capabilities.extend([
                    ModelCapability.VISION,
                    ModelCapability.DOCUMENT,
                ])
            
            # 工具调用能力
            if "sonnet" in model_id_lower or "opus" in model_id_lower or "haiku" in model_id_lower:
                capabilities.append(ModelCapability.TOOL_USE)
            
            # 推理能力
            if "4" in model_id_lower:
                capabilities.append(ModelCapability.REASONING)
            
            return ProviderModelInfo(
                model_id=model.id,
                type=ModelType.CHAT,
                capabilities=capabilities,
            )
            
        except Exception as e:
            logger.warning(f"无法从 API 获取模型信息 {model_id}: {e}，使用默认推断")
            # 降级到基于名称的推断
            return super().get_model_info(model_id, provider_config)
