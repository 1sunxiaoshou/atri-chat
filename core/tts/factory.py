"""TTS 工厂类"""

import json
from typing import Any

from sqlalchemy.orm import Session

from core.logger import get_logger

from .base import TTSBase
from .registry import TTSRegistry

logger = get_logger(__name__)


class TTSFactory:
    """TTS 工厂类，负责创建和管理 TTS 实例

    重构说明：
    - 移除了对 TTSConfigService 的依赖
    - 改为从 ORM 模型加载配置
    - 支持传入 db_session 或使用默认会话
    """

    def __init__(self):
        self._instances: dict[str, TTSBase] = {}
        self._config_versions: dict[str, str] = {}

    def create_tts(
        self,
        provider_type: str | None = None,
        config: dict[str, Any] | None = None,
        db_session: Session | None = None,
    ) -> TTSBase:
        """创建 TTS 实例

        Args:
            provider_type: 服务商类型（openai/gpt_sovits等），None 则使用启用的供应商
            config: 自定义配置（用于测试连接），None 则从数据库加载
            db_session: 数据库会话（用于加载配置）

        Returns:
            TTS 实例
        """
        # 场景1：测试连接（临时实例，不缓存）
        if config is not None:
            if not provider_type:
                raise ValueError("使用自定义配置时必须指定 provider_type")
            return TTSRegistry.get_provider_class(provider_type)(config)

        # 场景2：从数据库加载配置
        if db_session is None:
            # 如果没有传入会话，创建临时会话
            from core.db.base import get_session

            db_session = next(get_session())

        from core.db import TTSProvider

        if not provider_type:
            provider = db_session.query(TTSProvider).first()

            if not provider:
                raise ValueError("未找到启用的 TTS 供应商，请先配置")

            provider_type = provider.provider_type
            config = provider.config_payload
        else:
            provider = (
                db_session.query(TTSProvider)
                .filter(TTSProvider.provider_type == provider_type)
                .first()
            )

            if not provider:
                raise ValueError(f"TTS 供应商 {provider_type} 未配置或未启用")

            config = provider.config_payload

        # 检查缓存
        cache_key = f"{provider_type}:{provider.id}"
        config_version = json.dumps(config, sort_keys=True)

        if (
            cache_key in self._instances
            and self._config_versions.get(cache_key) == config_version
        ):
            return self._instances[cache_key]

        # 创建新实例
        if cache_key in self._instances:
            logger.info(f"TTS 配置变更，重新创建实例: {provider_type}")
        else:
            logger.info(f"首次创建 TTS 实例: {provider_type}")

        instance = TTSRegistry.get_provider_class(provider_type)(config)
        self._instances[cache_key] = instance
        self._config_versions[cache_key] = config_version
        return instance

    def get_default_tts(self, db_session: Session | None = None) -> TTSBase:
        """获取默认（启用的）TTS 实例

        Args:
            db_session: 数据库会话

        Returns:
            TTS 实例
        """
        return self.create_tts(db_session=db_session)

    def clear_cache(self, provider_type: str | None = None):
        """清除实例缓存

        Args:
            provider_type: 指定服务商类型，None 则清除所有
        """
        if provider_type:
            # 清除特定类型的所有缓存
            keys_to_remove = [
                k for k in self._instances.keys() if k.startswith(f"{provider_type}:")
            ]
            for key in keys_to_remove:
                self._instances.pop(key, None)
                self._config_versions.pop(key, None)
        else:
            self._instances.clear()
            self._config_versions.clear()
