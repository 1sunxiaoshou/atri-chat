"""TTS 工厂类"""
import json
from typing import Optional, Dict, Any

from core.logger import get_logger
from .base import TTSBase
from .registry import TTSRegistry
from .service import TTSConfigService

logger = get_logger(__name__)


class TTSFactory:
    """TTS 工厂类，负责创建和管理 TTS 实例"""
    
    def __init__(self, db_path: str = "data/app.db"):
        self.db_path = db_path
        self.config_service = TTSConfigService(db_path)
        self._instances: Dict[str, TTSBase] = {}
        self._config_versions: Dict[str, str] = {}
        self._ensure_providers_registered()
    
    def _ensure_providers_registered(self):
        """确保所有已注册的服务商都在数据库中初始化"""
        for provider_id, (provider_class, name) in TTSRegistry.get_all_providers().items():
            try:
                self.config_service.init_provider(
                    provider_id, 
                    name, 
                    provider_class.get_config_template()
                )
            except Exception as e:
                logger.error(f"初始化 TTS 服务商失败", extra={"provider": provider_id, "error": str(e)})
    
    def create_tts(self, provider: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> TTSBase:
        """创建 TTS 实例
        
        Args:
            provider: 服务商ID，None 则使用当前激活的服务商
            config: 自定义配置（用于测试连接），None 则从数据库加载
            
        Returns:
            TTS 实例
        """
        # 场景1：测试连接（临时实例，不缓存）
        if config is not None:
            if not provider:
                raise ValueError("使用自定义配置时必须指定 provider")
            return TTSRegistry.get_provider_class(provider)(config)
        
        # 场景2：从数据库加载配置
        if not provider:
            active = self.config_service.get_active_provider()
            if not active:
                raise ValueError("未设置活动的 TTS 服务商，请先配置")
            provider, config = active
        else:
            config = self.config_service.get_provider_config(provider)
            if not config:
                raise ValueError(f"TTS 服务商 {provider} 未配置")
        
        # 检查缓存
        config_version = json.dumps(config, sort_keys=True)
        if provider in self._instances and self._config_versions.get(provider) == config_version:
            return self._instances[provider]
        
        # 创建新实例
        if provider in self._instances:
            logger.info(f"TTS 配置变更，重新创建实例: {provider}")
        else:
            logger.info(f"首次创建 TTS 实例: {provider}")
        
        instance = TTSRegistry.get_provider_class(provider)(config)
        self._instances[provider] = instance
        self._config_versions[provider] = config_version
        return instance
    
    def get_default_tts(self) -> TTSBase:
        """获取默认（当前激活的）TTS 实例"""
        return self.create_tts()
    
    def clear_cache(self, provider: Optional[str] = None):
        """清除实例缓存
        
        Args:
            provider: 指定服务商ID，None 则清除所有
        """
        if provider:
            self._instances.pop(provider, None)
            self._config_versions.pop(provider, None)
        else:
            self._instances.clear()
            self._config_versions.clear()
