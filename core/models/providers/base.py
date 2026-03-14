"""供应商抽象基类"""
from typing import Any, Dict, Optional, List
from ..config import ModelConfig, ProviderConfig, ModelType, ProviderMetadata, ProviderModelInfo


class BaseProvider:
    """通用供应商实现类，基于 YAML 配置驱动"""
    
    def __init__(self, metadata: ProviderMetadata):
        self._metadata = metadata
    
    @property
    def metadata(self) -> ProviderMetadata:
        """供应商元数据"""
        return self._metadata
    
    def get_common_parameters_schema(self) -> Dict[str, Any]:
        """获取通用参数 Schema"""
        if self._metadata.common_parameters_schema:
            return self._metadata.common_parameters_schema
        return ProviderMetadata.get_default_common_params()

    def get_parameters_schema(self, model_id: str, has_reasoning: bool) -> Dict[str, Any]:
        """获取适用于特定模型的参数 Schema"""
        schema = self.get_common_parameters_schema().copy()
        
        # 如果模型支持推理，增加推理相关参数
        if has_reasoning:
            schema["thinking"] = {
                "type": "group",
                "label": "思考模式 (Reasoning)",
                "children": {
                    "enabled": {"type": "switch", "label": "开启思考", "default": False},
                    "budget": {"type": "number", "label": "思考预算 (Tokens)", "default": 16000, "min": 1024, "max": 64000}
                },
                "order": 10
            }
        
        # 允许通过元数据扩展供应商特定参数
        if self._metadata.provider_options_schema:
            schema.update(self._metadata.provider_options_schema)
            
        return schema

    def list_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """根据协议自动发现模型"""
        protocol = self._metadata.discovery
        if protocol == "openai":
            return self._list_openai_models(provider_config)
        elif protocol == "ollama":
            return self._list_ollama_models(provider_config)
        elif protocol == "google":
            return self._list_google_models(provider_config)
        return []

    def _list_openai_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """OpenAI 兼容协议模型发现"""
        from openai import OpenAI
        config = provider_config.config_payload
        try:
            client = OpenAI(
                api_key=config.get("api_key"),
                base_url=config.get("base_url")
            )
            models = client.models.list()
            return [self.get_model_info(m.id, provider_config) for m in models.data]
        except Exception:
            return []

    def _list_ollama_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """Ollama 协议模型发现"""
        import requests
        config = provider_config.config_payload
        base_url = config.get("base_url", "http://localhost:11434")
        api_key = config.get("api_key") # Ollama 现在也支持 API Key
        
        try:
            headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
            resp = requests.get(f"{base_url}/api/tags", headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                return [self.get_model_info(m["name"], provider_config) for m in data.get("models", [])]
        except Exception:
            pass
        return []

    def _list_google_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """Google Gemini 协议模型发现"""
        try:
            import google.generativeai as genai
            api_key = provider_config.config_payload.get("api_key")
            genai.configure(api_key=api_key)
            models = genai.list_models()
            return [self.get_model_info(m.name, provider_config) for m in models]
        except Exception:
            return []

    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """模型探测逻辑：基于 init_chat_model(...).profile 获取模型能力"""
        from langchain.chat_models import init_chat_model
        
        info = ProviderModelInfo(
            model_id=model_id,
            type=ModelType.CHAT,
            parameters={},
            meta={}
        )

        try:
            # 尝试初始化模型以获取其 profile
            m = init_chat_model(
                model=model_id, 
                model_provider=self._metadata.lc_id,
                api_key="sk-probing-key" 
            )
            if hasattr(m, "profile") and m.profile:
                profile = m.profile
                info.meta = profile  # 存储完整的 Profile 元数据
                
                # 精确映射能力到布尔值
                info.has_tool_use = bool(profile.get("tool_calling"))
                info.has_vision = bool(profile.get("image_inputs"))
                info.has_reasoning = bool(profile.get("reasoning_output"))
                info.has_audio = bool(profile.get("audio_inputs"))
                info.has_video = bool(profile.get("video_inputs"))
                info.has_document = bool(profile.get("pdf_inputs"))
                info.has_structured_output = bool(profile.get("structured_output"))
                
                # 同步回 capabilities 列表（用于兼容性）已删除
                
                # 记录核心限制
                info.context_window = profile.get("max_input_tokens")
                info.max_output = profile.get("max_output_tokens")
        except Exception:
            # 推测逻辑 (Fallback) - 仅做基础识别
            mid = model_id.lower()
            if any(x in mid for x in ["vision", "vl", "multimodal"]): info.has_vision = True
            if any(x in mid for x in ["o1", "qwq", "deepseek-r1", "thought"]): info.has_reasoning = True
            
        return info

    def create_model(self, model_config: ModelConfig, provider_config: ProviderConfig, **kwargs) -> Optional[Any]:
        """回退路径：如果 init_chat_model 不支持，可以使用自定义逻辑 (此处暂不实现，优先走 Factory)"""
        return None
