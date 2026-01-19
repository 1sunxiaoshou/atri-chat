"""系统配置管理"""
import os
from enum import Enum
from typing import Literal


class Environment(str, Enum):
    """环境枚举"""
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    STAGING = "staging"


class Config:
    """系统配置类"""
    
    def __init__(self):
        # 环境配置
        self._env = os.getenv("ENV", "development").lower()
        if self._env not in [e.value for e in Environment]:
            self._env = Environment.DEVELOPMENT.value
        
        # 日志配置
        self._log_level = os.getenv("LOG_LEVEL", self._default_log_level()).upper()
    
    @property
    def env(self) -> str:
        """获取当前环境"""
        return self._env
    
    @property
    def is_development(self) -> bool:
        """是否为开发环境"""
        return self._env == Environment.DEVELOPMENT.value
    
    @property
    def is_production(self) -> bool:
        """是否为生产环境"""
        return self._env == Environment.PRODUCTION.value
    
    @property
    def is_staging(self) -> bool:
        """是否为测试环境"""
        return self._env == Environment.STAGING.value
    
    @property
    def log_level(self) -> str:
        """获取日志级别"""
        return self._log_level
    
    def _default_log_level(self) -> str:
        """根据环境返回默认日志级别"""
        if self.is_production:
            return "WARNING"
        elif self.is_staging:
            return "INFO"
        else:
            return "DEBUG"


# 全局配置实例
_config: Config | None = None


def get_config() -> Config:
    """获取配置实例（单例）"""
    global _config
    if _config is None:
        _config = Config()
    return _config
