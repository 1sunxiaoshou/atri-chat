"""通义千问供应商"""
from typing import Any, Dict
from .base import BaseProvider
from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class TongyiProvider(BaseProvider):
    """通义千问供应商"""
    
    @property
    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id="tongyi",
            name="Tongyi",
            description="阿里旗下的百炼大模型服务平台",
            logo="/static/logos/tongyi.png",
            config_fields=[
                ConfigField(field_name="api_key", field_type="string", required=True, description="通义千问API密钥"),
                ConfigField(field_name="base_url", field_type="string", required=False, description="API基础URL"),
            ]
        )
    
    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        from langchain_community.chat_models.tongyi import ChatTongyi
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_json
        merged = self._merge_params(config, **kwargs)
        
        # 构建 model_kwargs
        model_kwargs = {}
        provider_opts = self.get_provider_options(**kwargs)
        if provider_opts.get("enable_thinking"):
            model_kwargs["enable_thinking"] = True
            model_kwargs["incremental_output"] = True
            logger.info(f"启用深度思考 (Tongyi): model={model_id}, incremental_output=True")
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
            "base_url": config.get("base_url"),
            "temperature": merged.get("temperature"),
            "max_tokens": merged.get("max_tokens"),
            "top_p": merged.get("top_p"),
            "streaming": merged.get("streaming"),
            "model_kwargs": model_kwargs if model_kwargs else None,
        }
        
        # 移除 None 值
        params = {k: v for k, v in params.items() if v is not None}
        
        return ChatTongyi(**params)
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取通义千问特定参数"""
        provider_options = kwargs.get("provider_options", {})
        tongyi_options = provider_options.get("tongyi", {})
        
        result = {}
        
        # 通义千问的 enable_thinking
        if "enable_thinking" in tongyi_options:
            result["enable_thinking"] = tongyi_options["enable_thinking"]
        
        return result
    
    async def _fetch_models_concurrent(self, models: list, provider_config: ProviderConfig) -> list[ProviderModelInfo]:
        """并发获取模型详细信息"""
        import httpx
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_json
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
                        
                        # 提取上下文窗口信息
                        context_window = None
                        max_output = None
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
                        # API 调用失败，使用默认推断
                        return self._infer_model_info(model_id, None, None)
                        
            except Exception as e:
                logger.debug(f"获取模型 {model_id} 信息失败: {e}，使用默认推断")
                return self._infer_model_info(model_id, None, None)
        
        # 并发获取所有模型信息（限制并发数为 20）
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
        
        # 嵌入模型
        if "embed" in model_id_lower or "embedding" in model_id_lower:
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.EMBEDDING,
                capabilities=[],
                context_window=context_window,
                max_output=max_output,
            )
        
        # 聊天模型
        capabilities = []
        
        # VL 系列支持多模态
        if "vl" in model_id_lower or "vision" in model_id_lower:
            capabilities.extend([
                ModelCapability.VISION,
                ModelCapability.DOCUMENT
            ])
        
        # Audio 系列
        if "audio" in model_id_lower:
            capabilities.append(ModelCapability.AUDIO)
        
        # 工具调用能力
        if "plus" in model_id_lower or "max" in model_id_lower or "turbo" in model_id_lower:
            capabilities.append(ModelCapability.TOOL_USE)
        
        return ProviderModelInfo(
            model_id=model_id,
            type=ModelType.CHAT,
            capabilities=capabilities,
            context_window=context_window,
            max_output=max_output,
        )
    
    def create_embedding_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:
        """通义千问支持嵌入模型，使用 OpenAI 兼容接口"""
        return super().create_embedding_model(model_id, provider_config, **kwargs)
    
    def list_models(self, provider_config: ProviderConfig) -> list[ProviderModelInfo]:
        """获取通义千问模型列表 - 使用 OpenAI 兼容接口（并发获取）"""
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        from openai import OpenAI
        from typing import List
        
        config = provider_config.config_json
        api_key = config.get("api_key")
        
        if not api_key:
            raise ValueError("缺少 API Key")
        
        # 使用 OpenAI 兼容接口
        client = OpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        
        # 获取模型列表
        models = client.models.list()
        
        # 在新线程中运行异步任务，避免事件循环冲突
        def run_async_in_thread():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(
                    self._fetch_models_concurrent(models.data, provider_config)
                )
            finally:
                loop.close()
        
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(run_async_in_thread)
            result = future.result()
        
        return result
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取通义千问模型信息 - 从 API 获取（使用 OpenAI 兼容接口）"""
        from openai import OpenAI
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        config = provider_config.config_json
        
        try:
            # 使用 OpenAI 兼容接口获取模型信息
            client = OpenAI(
                api_key=config.get("api_key"),
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
            )
            
            model_detail = client.models.retrieve(model_id)
            
            # 提取上下文窗口信息
            context_window = None
            max_output = None
            if hasattr(model_detail, 'extra_info') and model_detail.extra_info:
                extra_info = model_detail.extra_info
                if isinstance(extra_info, dict):
                    default_envs = extra_info.get('default_envs', {})
                    context_window = default_envs.get('max_input_tokens')
                    max_output = default_envs.get('max_output_tokens')
            
            logger.debug(f"从 API 获取模型信息: {model_id}, "
                        f"context_window: {context_window}, max_output: {max_output}")
            
            return self._infer_model_info(model_id, context_window, max_output)
            
        except Exception as e:
            logger.warning(f"无法从 API 获取模型信息 {model_id}: {e}，使用默认推断")
            return self._infer_model_info(model_id, None, None)
