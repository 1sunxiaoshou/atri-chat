"""通义千问供应商"""

from typing import Any, Dict

from .base import BaseProvider

from ..config import ProviderConfig, ProviderMetadata, ConfigField, ProviderModelInfo, ModelType, ModelCapability


class QwenProvider(BaseProvider):

    """通义千问供应商"""
    

    @property

    def metadata(self) -> ProviderMetadata:

        return ProviderMetadata(

            provider_id="qwen",

            name="Qwen",

            description="阿里旗下的百炼大模型服务平台",



            config_fields=[

                ConfigField(field_name="api_key", field_type="string", required=True, sensitive=True, description="通义千问API密钥"),

                ConfigField(field_name="base_url", field_type="string", required=False, description="API基础URL"),

            ],

            common_parameters_schema=self.get_common_parameters_schema(),

            provider_options_schema={

                "enable_thinking": {

                    "type": "boolean",

                    "label": "深度思考",

                    "description": "启用 QwQ 系列模型的深度思考能力",

                    "default": False,

                    "applicable_capabilities": ["reasoning"],

                    "order": 1  # 排在最前面

                }

            }

        )
    

    def create_text_model(self, model_id: str, provider_config: ProviderConfig, **kwargs) -> Any:

        from langchain_community.chat_models.tongyi import ChatTongyi

        from ...logger import get_logger
        

        logger = get_logger(__name__)

        config = provider_config.config_payload

        merged = self._merge_params(config, **kwargs)
        

        # 构建 model_kwargs

        model_kwargs = {}

        provider_opts = self.get_provider_options(**kwargs)

        if provider_opts.get("enable_thinking"):

            model_kwargs["enable_thinking"] = True

            model_kwargs["incremental_output"] = True

            logger.info(f"启用深度思考 (Qwen): model={model_id}, incremental_output=True")
        

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

        """根据模型 ID 推断模型信息
        

        注意：通义千问的 OpenAI 兼容接口不提供模型能力信息，

        因此需要根据模型名称进行推断。这是目前唯一可行的方案。
        

        思考模式分类：

        1. 仅思考模式：qwq-*, deepseek-r1*, kimi-k2-thinking, *-thinking

        2. 混合思考模式（默认开启）：qwen3.5-*, qwen3-[0-9], glm-*

        3. 混合思考模式（默认不开启）：qwen-plus, qwen-max, qwen-flash, qwen-turbo, deepseek-v3.*
        """

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
        

        # 深度思考模型（reasoning）

        # 注意：专用模型（vl, asr, tts, omni）不算思考模型

        is_specialized = any(keyword in model_id_lower for keyword in [

            "-vl-", "-asr-", "-tts-", "-omni-", "-s2s-", "livetranslate"

        ])
        

        if not is_specialized:

            # 1. 仅思考模式：qwq-*, qvq-*, deepseek-r1*, kimi-k2-thinking, *-thinking

            # 2. 混合思考模式（默认开启）：qwen3.5-*, qwen3-[数字], glm-*

            # 3. 混合思考模式（默认不开启）：qwen-plus, qwen-max, qwen-flash, qwen-turbo, deepseek-v3.*

            if any(keyword in model_id_lower for keyword in [

                # 仅思考模式

                "qwq-", "qvq-", "deepseek-r1", "k2-thinking", "-thinking",

                # 混合思考模式（默认开启）

                "qwen3.5-", "glm-",

                # 混合思考模式（默认不开启）

                "qwen-plus", "qwen-max", "qwen-flash", "qwen-turbo", "deepseek-v3"

            ]):

                capabilities.append(ModelCapability.REASONING)

            # qwen3-[数字] 系列（如 qwen3-32b, qwen3-8b）

            elif "qwen3-" in model_id_lower:

                # 检查是否是数字开头的模型（如 qwen3-32b, qwen3-8b）
                import re

                if re.search(r'qwen3-\d+', model_id_lower):

                    capabilities.append(ModelCapability.REASONING)
        

        # 视觉模型（vision + document）

        # 包括：*-vl-*, qvq-*（视觉推理）

        if "-vl-" in model_id_lower or "vision" in model_id_lower or "qvq-" in model_id_lower:

            capabilities.extend([

                ModelCapability.VISION,

                ModelCapability.DOCUMENT

            ])
        

        # 音频模型

        # 包括：*-asr-*, *-tts-*, *-omni-*, *-s2s-*

        if any(keyword in model_id_lower for keyword in [

            "audio", "-asr-", "-tts-", "-omni-", "-s2s-", "livetranslate"

        ]):

            capabilities.append(ModelCapability.AUDIO)
        

        # 工具调用能力（大部分主流模型都支持，但开源版本除外）

        # 排除：开源版本（如 qwen3.5-397b-a17b）

        is_opensource = any(keyword in model_id_lower for keyword in [

            "-a17b", "-a22b", "-a10b", "-a3b", "-instruct"

        ])
        

        if not is_opensource:

            # 包括：*-plus, *-max, *-turbo, *-flash, qwen3-*, qwen2.5-*, qwen-coder

            if any(keyword in model_id_lower for keyword in [

                "-plus", "-max", "-turbo", "-flash", "qwen3-", "qwen2.5-", "qwen-coder"

            ]):

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
        

        config = provider_config.config_payload

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

        config = provider_config.config_payload
        

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

