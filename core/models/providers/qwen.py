"""通义千问供应商"""

from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability

class QwenProvider(BaseProvider):
    """通义千问供应商 (OpenAI 兼容协议)"""

    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="qwen",
            name="Qwen",
            description="阿里旗下的百炼大模型服务平台 - 推荐使用 OpenAI 兼容协议",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, sensitive=True, description="百炼 API Key"),
                ConfigField(field_name="base_url", field_type="string", required=False, default_value="https://dashscope.aliyuncs.com/compatible-mode/v1", description="API基础URL"),
            ],
            common_parameters_schema=self.get_common_parameters_schema(),
            provider_options_schema={
                "enable_thinking": {
                    "type": "boolean",
                    "label": "深度思考",
                    "description": "开启后支持 QwQ/Qwen3.5 等模型的思维链输出",
                    "default": False,
                    "applicable_capabilities": ["reasoning"],
                    "order": 1
                }
            }
        )

    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        # 阿里百炼现在全面推荐使用为 Qwen 优化过的 langchain-qwq
        from langchain_qwq import ChatQwen
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_payload
        merged = self._merge_params(config, **kwargs)
        
        # 处理 base_url：如果为空，使用默认值
        base_url = merged.get("base_url")
        if not base_url:  # 空字符串或 None
            base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        
        # 构建最终参数
        params = {
            "model": model_id,
            "api_key": merged.get("api_key"),
            "base_url": base_url,
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens") if merged.get("max_tokens") and merged.get("max_tokens") > 0 else None,
            "top_p": merged.get("top_p"),
            "streaming": merged.get("streaming"),
            "enable_thinking": merged.get("enable_thinking") or False
        }
        
        # 移除 None 和空字符串，确保不传未设置的参数
        params = {k: v for k, v in params.items() if v is not None and v != ""}

        return ChatQwen(**params)

    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取通义千问特定参数"""
        provider_options = kwargs.get("provider_options", {})
        qwen_options = provider_options.get("qwen", {})
        
        result = {}
        
        # 通义千问的 enable_thinking
        if "enable_thinking" in qwen_options:
            result["enable_thinking"] = qwen_options["enable_thinking"]
        
        return result

    async def _fetch_models_concurrent(self, models: list, provider_config: ProviderConfig) -> list[ProviderModelInfo]:
        """并发获取模型详细信息"""
        import httpx
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_payload
        api_key = config.get("api_key")
        base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        
        async def fetch_model_info(model_id: str) -> ProviderModelInfo:
            """异步获取单个模型信息"""
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        f"{base_url}/models/{model_id}",
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        if 'extra_info' in data:
                            extra_info = data['extra_info']
                            if isinstance(extra_info, dict):
                                default_envs = extra_info.get('default_envs', {})
                                context_window = default_envs.get('max_input_tokens')
                                max_output = default_envs.get('max_output_tokens')
                        
                        # 根据模型 ID 推断类型和能力
                        model_info = self._infer_model_info(model_id, context_window, max_output)
                        return model_info
                    else:
                        return self._infer_model_info(model_id, None, None)
            except Exception as e:
                logger.debug("获取模型 {model_id} 信息失败: {}，使用默认推断", str(e))
                return self._infer_model_info(model_id, None, None)
        
        import asyncio
        semaphore = asyncio.Semaphore(20)
        
        async def fetch_with_semaphore(model_id: str):
            async with semaphore:
                return await fetch_model_info(model_id)
        
        tasks = [fetch_with_semaphore(model.id) for model in models]
        results = await asyncio.gather(*tasks)
        return results

    def _infer_model_info(self, model_id: str, context_window: int = None, max_output: int = None) -> ProviderModelInfo:
        """根据模型 ID 推断模型信息"""
        model_id_lower = model_id.lower()
        
        if "embed" in model_id_lower or "embedding" in model_id_lower:
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.EMBEDDING,
                capabilities=[],
                context_window=context_window,
                max_output=max_output,
            )
        
        capabilities = []
        is_specialized = any(keyword in model_id_lower for keyword in [
            "-vl-", "-asr-", "-tts-", "-omni-", "-s2s-", "livetranslate"
        ])
        
        if not is_specialized:
            if any(keyword in model_id_lower for keyword in [
                "qwq-", "qvq-", "deepseek-r1", "k2-thinking", "-thinking",
                "qwen3.5-", "glm-", "qwen-plus", "qwen-max", "qwen-flash", "qwen-turbo", "deepseek-v3"
            ]):
                capabilities.append(ModelCapability.REASONING)
            elif "qwen3-" in model_id_lower:
                import re
                if re.search(r'qwen3-\d+', model_id_lower):
                    capabilities.append(ModelCapability.REASONING)
        
        if "-vl-" in model_id_lower or "vision" in model_id_lower or "qvq-" in model_id_lower:
            capabilities.extend([ModelCapability.VISION, ModelCapability.DOCUMENT])
        
        if any(keyword in model_id_lower for keyword in ["audio", "-asr-", "-tts-", "-omni-", "-s2s-", "livetranslate"]):
            capabilities.append(ModelCapability.AUDIO)
        
        is_opensource = any(keyword in model_id_lower for keyword in ["-a17b", "-a22b", "-a10b", "-a3b", "-instruct"])
        if not is_opensource:
            if any(keyword in model_id_lower for keyword in ["-plus", "-max", "-turbo", "-flash", "qwen3-", "qwen2.5-", "qwen-coder"]):
                capabilities.append(ModelCapability.TOOL_USE)
        
        # 处理 max_output 标志位: 如果是 0, 则转换为 None 以避免传参
        final_max_output = max_output if max_output and max_output > 0 else None

        return ProviderModelInfo(
            model_id=model_id,
            type=ModelType.CHAT,
            capabilities=capabilities,
            context_window=context_window,
            max_output=final_max_output,
        )

    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        return super().create_embedding_model(model_id, provider_config, **kwargs)

    def list_models(self, provider_config: ProviderConfig) -> list[ProviderModelInfo]:
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        from openai import OpenAI
        
        config = provider_config.config_payload
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError("缺少 API Key")
        
        client = OpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        models = client.models.list()
        
        def run_async_in_thread():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(self._fetch_models_concurrent(models.data, provider_config))
            finally:
                loop.close()
        
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(run_async_in_thread)
            return future.result()

    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        from openai import OpenAI
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_payload
        try:
            client = OpenAI(
                api_key=config.get("api_key"),
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
            )
            model_detail = client.models.retrieve(model_id)
            context_window = None
            max_output = None
            if hasattr(model_detail, 'extra_info') and model_detail.extra_info:
                extra_info = model_detail.extra_info
                if isinstance(extra_info, dict):
                    default_envs = extra_info.get('default_envs', {})
                    context_window = default_envs.get('max_input_tokens')
                    max_output = default_envs.get('max_output_tokens')
            
            logger.debug(f"从 API 获取模型信息: {model_id}, context_window: {context_window}, max_output: {max_output}")
            return self._infer_model_info(model_id, context_window, max_output)
        except Exception as e:
            logger.warning("无法从 API 获取模型信息 {model_id}: {}，使用默认推断", str(e))
            return self._infer_model_info(model_id, None, None)
