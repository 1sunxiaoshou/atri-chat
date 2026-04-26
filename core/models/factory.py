"""模型工厂

提供模型创建和供应商模板管理功能。
职责：
1. 注册和管理供应商模板（Provider 实现类）
2. 根据配置创建模型实例
3. 提供模板元数据查询

注意：不再负责数据访问，配置由 ModelService 通过 Repository 获取。
"""

from typing import Any

from ..logger import get_logger
from .config import ModelConfig, ModelType, ProviderConfig, ProviderMetadata
from .providers.base import BaseProvider

logger = get_logger(__name__)


class ModelFactory:
    """模型工厂

    职责：
    1. 统一使用 LangChain 的 init_chat_model 创建 Chat 实例
    2. 提供 ParameterAdapter 功能，自动适配跨供应商参数（如“思考模式”）
    3. 管理 Provider 模板，用于模型列表同步和发现逻辑
    """

    def __init__(self):
        """初始化模型工厂"""
        self._provider_templates: dict[str, BaseProvider] = {}
        self._register_provider_templates()

    def _register_provider_templates(self):
        """从 providers.yaml 加载供应商配置"""
        import os

        import yaml

        yaml_path = os.path.join(os.path.dirname(__file__), "providers.yaml")
        try:
            with open(yaml_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
                for p_data in data.get("providers", []):
                    # 转换字典到 ProviderMetadata 对象
                    metadata = ProviderMetadata(**p_data)
                    # 创建通用的 BaseProvider 实例
                    self.register_provider_template(BaseProvider(metadata))
            logger.info(
                f"成功从 YAML 加载了 {len(self._provider_templates)} 个供应商模板"
            )
        except Exception as e:
            logger.error(f"加载 providers.yaml 失败: {e}")
            # Fallback (可选，这里我们可以留空让系统报错，或者加个最基础的 OpenAI)

    def register_provider_template(self, provider: BaseProvider) -> None:
        self._provider_templates[provider.metadata.provider_id] = provider

    def get_provider_template(self, provider_type: str) -> BaseProvider | None:
        return self._provider_templates.get(provider_type)

    def get_all_template_metadata(self) -> dict[str, ProviderMetadata]:
        return {tid: p.metadata for tid, p in self._provider_templates.items()}

    def get_available_templates(self) -> list[str]:
        """返回当前已注册的模板类型列表。"""
        return sorted(self._provider_templates.keys())

    def create_model(
        self,
        model_config: ModelConfig,
        provider_config: ProviderConfig,
        provider_type: str,
        **kwargs,
    ) -> Any | None:
        """
        统一模型创建逻辑
        """
        # 1. 只有 CHAT 类型走 init_chat_model
        if model_config.model_type != ModelType.CHAT:
            provider_template = self.get_provider_template(provider_type)
            if provider_template:
                return provider_template.create_model(
                    model_config, provider_config, **kwargs
                )
            raise ValueError(f"暂不支持的模型类型: {model_config.model_type}")

        # 2. 标准化参数适配
        final_params = self._standardize_parameters(
            model_config=model_config,
            provider_config=provider_config,
            provider_type=provider_type,
            run_kwargs=kwargs,
        )

        # 3. 确定供应商标识
        provider_template = self.get_provider_template(provider_type)
        lc_provider = (
            provider_template.metadata.lc_id if provider_template else provider_type
        )

        try:
            # 4. 特殊供应商手动实例化 (init_chat_model 不支持或需要原生支持的)
            if provider_type == "qwen":
                from langchain_qwq import ChatQwen

                model = ChatQwen(model=model_config.model_id, **final_params)
                return model

            # 5. 使用 LangChain 万能工厂实例化其他模型
            # 开启 output_version="v1" 以便统一流式思考内容的输出格式
            from langchain.chat_models import init_chat_model

            model = init_chat_model(
                model=model_config.model_id,
                model_provider=lc_provider,
                output_version="v1",
                **final_params,
            )

            return model
        except Exception as e:
            logger.error(
                f"init_chat_model 创建失败: {provider_type}/{model_config.model_id}: {e}"
            )
            # 回退到 Provider 模板尝试创建（兼容 init_chat_model 不支持的供应商）
            provider_template = self.get_provider_template(provider_type)
            if provider_template:
                return provider_template.create_model(
                    model_config, provider_config, **kwargs
                )
            raise e

    def _standardize_parameters(
        self,
        model_config: ModelConfig,
        provider_config: ProviderConfig,
        provider_type: str,
        run_kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        """参数适配器：将 UI/DB 参数映射到供应商特定的参数"""
        # 基础连接配置 (api_key, base_url 等)
        params = provider_config.config_payload.copy()

        # 合理合并：运行参数 > 模型默认参数
        combined_params = {**model_config.parameters, **run_kwargs}

        # 处理通用参数
        for k in ["temperature", "max_tokens", "top_p", "stream"]:
            if k in combined_params:
                params[k] = combined_params[k]

        # 核心：跨厂商“思考能力 (Reasoning/Thinking)”适配
        thinking = combined_params.get("thinking")
        if (thinking and thinking.get("enabled")) or model_config.has_reasoning:
            # 如果配置开启了思考，或者模型本身就是强推理模型
            provider_template = self.get_provider_template(provider_type)
            provider_id = (
                provider_template.metadata.provider_id
                if provider_template
                else provider_type
            )
            budget = thinking.get("budget", 16000) if thinking else 16000

            if provider_id == "anthropic":
                # Anthropic 官方支持格式 (2024-10+)
                params["thinking"] = {"type": "enabled", "budget_tokens": budget}
            elif "openai" in provider_id or "o1" in model_config.model_id:
                # OpenAI o1 格式 (或兼容的提供商)
                params["reasoning_effort"] = combined_params.get(
                    "reasoning_effort", "high"
                )
            elif provider_id == "google":
                # Google Thinking 格式
                params["thinking_config"] = {
                    "include_thoughts": True,
                    "thinking_budget": budget,
                }
            elif any(p in provider_id for p in ["qwen", "deepseek"]):
                # 国内厂商通常兼容 OpenAI 但带私有字段（如 enable_thinking）
                params["enable_thinking"] = True

        return params

    def validate_provider_type(self, provider_type: str) -> bool:
        return provider_type in self._provider_templates
