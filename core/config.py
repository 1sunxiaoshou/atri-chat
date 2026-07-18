"""系统配置与路径管理中枢。"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .runtime_layout import (
    AppEnv,
    RuntimeLayout,
    resolve_runtime_layout,
)


class AppSettings(BaseSettings):
    """应用全局配置（单点事实源）。"""

    app_env: str = Field(default=AppEnv.DEVELOPMENT.value)
    runtime_mode: str = Field(default="development")
    backend_port: int = Field(
        default=9099,
        validation_alias="ATRI_BACKEND_PORT",
    )

    app_root: Path | None = None
    data_root: Path | None = None

    log_level: str | None = Field(
        default=None,
        validation_alias="LOG_LEVEL",
    )
    enable_http_logging: bool = Field(
        default=True,
        validation_alias="ENABLE_HTTP_LOGGING",
    )
    enable_llm_call_logger: bool = Field(
        default=False,
        validation_alias="ENABLE_LLM_CALL_LOGGER",
    )

    @property
    def data_dir(self) -> Path:
        """数据存放根目录。"""
        return self.data_root

    @property
    def logs_dir(self) -> Path:
        """日志存放目录。"""
        return self.data_dir / "logs"

    @property
    def db_dir(self) -> Path:
        """数据库存放目录。"""
        return self.data_dir / "sqlite"

    @property
    def models_dir(self) -> Path:
        """AI 模型根目录。"""
        return self.data_dir / "models"

    @property
    def memory_dir(self) -> Path:
        """长期记忆存储目录。"""
        return self.data_dir / "memory"

    @property
    def asr_models_dir(self) -> Path:
        """SenseVoice ASR 模型存放目录。"""
        return self.models_dir / "asr"

    @property
    def assets_dir(self) -> Path:
        """应用资产根目录 (原 uploads)。"""
        return self.data_dir / "assets"

    @property
    def images_dir(self) -> Path:
        """图片资产 (包括头像/立绘)。"""
        return self.assets_dir / "images"

    @property
    def vrm_dir(self) -> Path:
        """VRM 相关资产根目录。"""
        return self.assets_dir / "vrm"

    @property
    def vrm_models_dir(self) -> Path:
        return self.vrm_dir / "models"

    @property
    def vrm_motions_dir(self) -> Path:
        """VRM 动作/动画文件。"""
        return self.vrm_dir / "motions"

    @property
    def vrm_thumbnails_dir(self) -> Path:
        return self.vrm_dir / "thumbnails"

    @property
    def tts_dir(self) -> Path:
        """TTS audio cache files served under /static/tts."""
        return self.assets_dir / "tts"

    @property
    def app_db_url(self) -> str:
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            return db_url
        return f"sqlite:///{self.db_dir / 'app.db'}"

    @property
    def store_db_path(self) -> str:
        return str(self.db_dir / "store.db")

    @property
    def checkpoints_db_path(self) -> str:
        return str(self.db_dir / "checkpoints.db")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def finalize_settings(self) -> AppSettings:
        """规范化环境并补齐派生路径。"""
        layout: RuntimeLayout = resolve_runtime_layout()
        self.runtime_mode = layout.mode.value
        self.app_env = (
            AppEnv.DEVELOPMENT.value
            if layout.mode.value == "development"
            else AppEnv.PRODUCTION.value
        )
        self.app_root = layout.app_root
        self.data_root = layout.data_root

        if not self.log_level:
            if self.app_env == AppEnv.PRODUCTION.value:
                self.log_level = "WARNING"
            else:
                self.log_level = "DEBUG"
        else:
            self.log_level = self.log_level.upper()
        return self

    def ensure_directories(self):
        """显式创建所有必要的系统目录。"""
        dirs = [
            self.data_dir,
            self.db_dir,
            self.logs_dir,
            self.models_dir,
            self.memory_dir,
            self.asr_models_dir,
            self.assets_dir,
            self.images_dir,
            self.vrm_dir,
            self.vrm_models_dir,
            self.vrm_motions_dir,
            self.vrm_thumbnails_dir,
            self.tts_dir,
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> AppSettings:
    """获取全站唯一的配置单例。"""
    return AppSettings()
