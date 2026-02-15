"""本地模型供应商（Ollama）"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class LocalProvider(BaseProvider):
    """本地模型供应商（Ollama）"""
    
    @property
    def metadata(self) -> ProviderMetadata:
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
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "top_p": merged.get("top_p"),
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        # 处理 provider_options
        provider_opts = self.get_provider_options(**kwargs)
        if provider_opts.get("enable_thinking"):
            params["enable_thinking"] = True
            logger.info(f"启用深度思考 (Local/Ollama): model={model_id}")
        
        return ChatOllama(**params)
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取本地模型特定参数"""
        provider_options = kwargs.get("provider_options", {})
        local_options = provider_options.get("local", {})
        
        result = {}
        
        # 本地模型的 enable_thinking（用于 Qwen 等模型）
        if "enable_thinking" in local_options:
            result["enable_thinking"] = local_options["enable_thinking"]
        
        return result
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.embeddings import OllamaEmbeddings
        config = provider_config.config_json
        
        params = {
            "model": model_id,
            "base_url": config.get("base_url", "http://localhost:11434"),
        }
        
        return OllamaEmbeddings(**params)
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取本地模型信息 - 从 Ollama API 获取"""
        import requests
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_json
        base_url = config.get("base_url", "http://localhost:11434")
        
        try:
            # 使用 Ollama API 获取模型详细信息
            response = requests.post(
                f"{base_url}/api/show",
                json={"name": model_id},
                timeout=5
            )
            response.raise_for_status()
            model_data = response.json()
            
            # 从 API 响应中提取能力信息
            capabilities_list = model_data.get("capabilities", [])
            context_length = None
            
            # 从 model_info 中提取上下文长度
            if "model_info" in model_data:
                model_info = model_data["model_info"]
                # 尝试多种可能的键名
                for key in model_info:
                    if "context_length" in key:
                        context_length = model_info[key]
                        break
            
            logger.debug(f"从 API 获取模型信息: {model_id}, "
                        f"capabilities: {capabilities_list}, context: {context_length}")
            
            # 转换能力列表
            capabilities = []
            if "vision" in capabilities_list:
                capabilities.extend([ModelCapability.VISION, ModelCapability.DOCUMENT])
            if "tools" in capabilities_list or "function_calling" in capabilities_list:
                capabilities.append(ModelCapability.TOOL_USE)
            
            # 判断模型类型
            model_id_lower = model_id.lower()
            if "embed" in model_id_lower or "nomic" in model_id_lower or "mxbai" in model_id_lower:
                model_type = ModelType.EMBEDDING
                capabilities = []
            else:
                model_type = ModelType.CHAT
                # 补充基于名称的推断
                if not capabilities:
                    if "vision" in model_id_lower or "llava" in model_id_lower or "minicpm-v" in model_id_lower:
                        capabilities.extend([ModelCapability.VISION, ModelCapability.DOCUMENT])
                    if "qwen" in model_id_lower or "llama3" in model_id_lower or "llama-3" in model_id_lower:
                        capabilities.append(ModelCapability.TOOL_USE)
            
            return ProviderModelInfo(
                model_id=model_id,
                type=model_type,
                capabilities=capabilities,
                context_window=context_length,
            )
            
        except Exception as e:
            logger.warning(f"无法从 API 获取模型信息 {model_id}: {e}，使用默认推断")
            # 降级到基于名称的推断
            model_id_lower = model_id.lower()
            
            # 嵌入模型
            if "embed" in model_id_lower or "nomic" in model_id_lower or "mxbai" in model_id_lower:
                return ProviderModelInfo(
                    model_id=model_id,
                    type=ModelType.EMBEDDING,
                    capabilities=[],
                )
            
            # 聊天模型
            capabilities = []
            
            # 视觉模型
            if "vision" in model_id_lower or "llava" in model_id_lower or "minicpm-v" in model_id_lower:
                capabilities.extend([
                    ModelCapability.VISION,
                    ModelCapability.DOCUMENT
                ])
            
            # 工具调用能力
            if "qwen" in model_id_lower or "llama3" in model_id_lower or "llama-3" in model_id_lower:
                capabilities.append(ModelCapability.TOOL_USE)
            
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.CHAT,
                capabilities=capabilities,
            )
