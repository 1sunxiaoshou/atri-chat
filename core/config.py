"""系统配置与路径管理中枢"""
import os
import sys
from enum import Enum
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator


class Environment(str, Enum):
    """环境枚举"""
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    STAGING = "staging"


def get_base_dir() -> Path:
    """获取应用根目录（绝对路径）
    
    兼容 PyInstaller 打包后的路径定位。
    """
    if getattr(sys, 'frozen', False):
        # 打包后，返回 .exe 所在的目录
        return Path(sys.executable).parent.resolve()
    # 开发环境，返回项目源码根目录
    return Path(__file__).parent.parent.resolve()


class AppSettings(BaseSettings):
    """应用全局配置（单点事实源）"""
    
    # 1. 基础环境配置
    env: str = Field(default=Environment.DEVELOPMENT.value, alias="ENV")
    backend_port: int = Field(default=9099, alias="BACKEND_PORT")
    
    # 2. 根目录（自动计算，支持通过 BASE_DIR 环境变量注入）
    base_dir: Path = Field(default_factory=get_base_dir, alias="BASE_DIR")
    
    # 3. 日志与调试
    log_level: str | None = Field(default=None, alias="LOG_LEVEL")
    enable_http_logging: bool = Field(default=True, alias="ENABLE_HTTP_LOGGING")
    enable_llm_call_logger: bool = Field(default=False, alias="ENABLE_LLM_CALL_LOGGER")

    # 4. 路径计算属性 (分层结构优化)
    
    @property
    def data_dir(self) -> Path:
        """数据存放根目录"""
        return self.base_dir / "data"

    @property
    def logs_dir(self) -> Path:
        """日志存放目录"""
        return self.base_dir / "logs"

    @property
    def db_dir(self) -> Path:
        """数据库存放目录"""
        return self.data_dir / "sqlite"

    @property
    def models_dir(self) -> Path:
        """AI 模型根目录"""
        return self.data_dir / "models"
    
    @property
    def memory_dir(self) -> Path:
        """长期记忆存储目录"""
        return self.data_dir / "memory"
    
    @property
    def asr_models_dir(self) -> Path:
        """SenseVoice ASR 模型存放目录"""
        return self.models_dir / "asr"

    @property
    def assets_dir(self) -> Path:
        """应用资产根目录 (原 uploads)"""
        return self.data_dir / "assets"

    @property
    def images_dir(self) -> Path:
        """图片资产 (包括头像/立绘)"""
        return self.assets_dir / "images"

    @property
    def avatars_dir(self) -> Path:
        """兼容性别名"""
        return self.images_dir

    @property
    def vrm_dir(self) -> Path:
        """VRM 相关资产根目录"""
        return self.assets_dir / "vrm"

    @property
    def vrm_models_dir(self) -> Path:
        return self.vrm_dir / "models"

    @property
    def vrm_motions_dir(self) -> Path:
        """VRM 动作/动画文件"""
        return self.vrm_dir / "motions"

    @property
    def vrm_thumbnails_dir(self) -> Path:
        return self.vrm_dir / "thumbnails"

    # 5. 数据库连接字符串与路径
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

    # 6. 配置加载规则
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore'
    )

    @model_validator(mode='after')
    def set_default_log_level(self) -> 'AppSettings':
        """根据环境设置默认日志级别"""
        if not self.log_level:
            if self.env.lower() == Environment.PRODUCTION.value:
                self.log_level = "WARNING"
            elif self.env.lower() == Environment.STAGING.value:
                self.log_level = "INFO"
            else:
                self.log_level = "DEBUG"
        else:
            self.log_level = self.log_level.upper()
        return self

    # 7. 显式初始化辅助方法
    def ensure_directories(self):
        """显式创建所有必要的系统目录"""
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
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> AppSettings:
    """获取全站唯一的配置单例"""
    return AppSettings()
