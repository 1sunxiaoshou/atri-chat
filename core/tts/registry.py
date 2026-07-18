"""TTS 服务商注册中心。"""

from __future__ import annotations

import importlib

from core.logger import get_logger

logger = get_logger(__name__)


class TTSRegistry:
    """TTS 服务商注册中心（单例模式）"""

    _providers: dict[str, tuple[type, str]] = {}  # {provider_id: (class, display_name)}
    _provider_modules: dict[str, str] = {
        "gpt_sovits": "core.tts.gpt_sovits",
        "genie": "core.tts.genie_tts",
        "qwen_tts": "core.tts.qwen_tts",
    }

    @classmethod
    def register(cls, provider_id: str, name: str):
        """装饰器：自动注册服务商

        Args:
            provider_id: 服务商唯一标识
            name: 显示名称

        Example:
            @TTSRegistry.register("gpt_sovits", "GPT-SoVITS")
            class GPTSoVITSTTS(TTSBase):
                ...
        """

        def decorator(provider_class):
            cls._providers[provider_id] = (provider_class, name)
            return provider_class

        return decorator

    @classmethod
    def get_provider_class(cls, provider_id: str) -> type:
        """获取服务商类

        Args:
            provider_id: 服务商ID

        Returns:
            服务商类

        Raises:
            ValueError: 未知的服务商
        """
        cls._ensure_provider_loaded(provider_id)
        if provider_id not in cls._providers:
            raise ValueError(f"未知的 TTS 服务商: {provider_id}")
        return cls._providers[provider_id][0]

    @classmethod
    def get_all_providers(cls) -> dict[str, tuple[type, str]]:
        """获取所有已注册的服务商

        Returns:
            {provider_id: (class, display_name)}
        """
        cls._ensure_all_providers_loaded()
        return cls._providers.copy()

    @classmethod
    def get_provider_name(cls, provider_id: str) -> str:
        """获取服务商显示名称"""
        cls._ensure_provider_loaded(provider_id)
        if provider_id not in cls._providers:
            return provider_id
        return cls._providers[provider_id][1]

    @classmethod
    def _ensure_provider_loaded(cls, provider_id: str) -> None:
        module_name = cls._provider_modules.get(provider_id)
        if module_name is None or provider_id in cls._providers:
            return
        importlib.import_module(module_name)

    @classmethod
    def _ensure_all_providers_loaded(cls) -> None:
        for provider_id in cls._provider_modules:
            cls._ensure_provider_loaded(provider_id)
