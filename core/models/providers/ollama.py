"""Ollama 供应商"""
from typing import Any, Dict, List
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class OllamaProvider(BaseProvider):
    """Ollama 供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="ollama",
            name="Ollama",
            description="Ollama - 本地运行大语言模型",
            config_fields=[
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="http://localhost:11434", description="Ollama服务地址"),
                ConfigField(field_name="api_key", field_type="string", required=False, sensitive=True, description="Ollama API密钥 (可选)"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={}
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.chat_models import ChatOllama
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_payload
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "top_p": merged.get("top_p"),
        }
        
        api_key = config.get("api_key")
        if api_key:
            params["headers"] = {"Authorization": f"Bearer {api_key}"}
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        # 处理 provider_options
        provider_opts = self.get_provider_options(**kwargs)
        if provider_opts.get("enable_thinking"):
            params["enable_thinking"] = True
            logger.info(f"启用深度思考 (Ollama): model={model_id}")
        
        return ChatOllama(**params)
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取 Ollama 特定参数"""
        provider_options = kwargs.get("provider_options", {})
        local_options = provider_options.get("ollama", {})
        
        result = {}
        
        # Ollama 的 enable_thinking（用于 Qwen 等模型）
        if "enable_thinking" in local_options:
            result["enable_thinking"] = local_options["enable_thinking"]
        
        return result
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.embeddings import OllamaEmbeddings
        config = provider_config.config_payload
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
        }
        
        api_key = config.get("api_key")
        if api_key:
            params["headers"] = {"Authorization": f"Bearer {api_key}"}
        
        return OllamaEmbeddings(**params)
    
    def list_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """获取模型列表 - 使用 Ollama 原生接口"""
        import requests
        config = provider_config.config_payload
        base_url = config.get("base_url", "http://localhost:11434")
        api_key = config.get("api_key")
        
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        
        resp = requests.get(f"{base_url}/api/tags", headers=headers, timeout=5)
        resp.raise_for_status()
        models_data = resp.json().get("models", [])
        
        # 使用列表推导式获取详细信息
        return [self.get_model_info(m["name"], provider_config) for m in models_data]
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取 Ollama 模型信息 - 简化版"""
        import requests
        from ...logger import get_logger
        logger = get_logger(__name__)
        config = provider_config.config_payload
        base_url = config.get("base_url", "http://localhost:11434")
        api_key = config.get("api_key")
        
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        
        try:
            resp = requests.post(f"{base_url}/api/show", json={"name": model_id}, headers=headers, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            
            # 直接通过字典映射能力 (不依赖名称判断)
            CAP_MAP = {
                "vision": [ModelCapability.VISION, ModelCapability.DOCUMENT],
                "tools": [ModelCapability.TOOL_USE],
                "function_calling": [ModelCapability.TOOL_USE]
            }
            capabilities = []
            for c in data.get("capabilities", []):
                capabilities.extend(CAP_MAP.get(c, []))
            
            # 提取上下文长度 & 类型判断
            info = data.get("model_info", {})
            ctx = next((v for k, v in info.items() if "context_length" in k), None)
            
            families = data.get("details", {}).get("families") or []
            is_embed = any(f in families for f in ["bert", "nomic", "mxbai"])
            
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.EMBEDDING if is_embed else ModelType.CHAT,
                capabilities=[] if is_embed else capabilities,
                context_window=ctx,
            )
        except Exception:
            logger.exception(f"获取 {model_id} 信息失败")
            return ProviderModelInfo(model_id=model_id, type=ModelType.CHAT, capabilities=[])
