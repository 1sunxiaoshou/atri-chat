"""TTS 工厂类"""
import importlib
from typing import Optional, Dict, Any

from core.logger import get_logger
from .base import TTSBase
from .service import TTSConfigService

logger = get_logger(__name__)


class TTSFactory:
    """TTS 工厂类，负责创建和管理 TTS 实例（从数据库读取配置）"""
    
    _PROVIDERS = {
        "gpt_sovits": ("gpt_sovits.GPTSoVITSTTS", "GPT-SoVITS"),
    }
    
    def __init__(self, db_path: str = "data/app.db"):
        self.db_path = db_path
        self.config_service = TTSConfigService(db_path, template_loader=self._load_template)
        self._instances: Dict[str, TTSBase] = {}
        self._config_versions: Dict[str, str] = {}
        self._init_providers()
    
    def _load_template(self, provider_id: str) -> Dict[str, Any]:
        """加载服务商配置模板"""
        provider_class = self._get_provider_class(provider_id)
        return provider_class.get_config_template()
    
    def _get_provider_class(self, provider: str):
        """动态加载提供商类"""
        if provider not in self._PROVIDERS:
            raise ValueError(f"未知的TTS提供商: {provider}")
        
        module_path, _ = self._PROVIDERS[provider]
        module_name, class_name = module_path.rsplit(".", 1)
        
        try:
            module = importlib.import_module(f".{module_name}", package="core.tts")
            return getattr(module, class_name)
        except (ImportError, AttributeError) as e:
            raise ValueError(f"无法加载TTS提供商 {provider}: {e}")
    
    def _init_providers(self):
        """注册所有已知服务商到数据库"""
        for pid, (_, name) in self._PROVIDERS.items():
            try:
                cls = self._get_provider_class(pid)
                self.config_service.init_provider(pid, name, cls.get_config_template())
                logger.debug(f"TTS提供商 {pid} 已注册")
            except Exception as e:
                logger.error(f"初始化TTS提供商 {pid} 失败: {e}")
    
    def create_tts(self, provider: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> TTSBase:
        """创建 TTS 实例"""
        # 场景1：测试连接（显式传入配置，不走缓存）
        if config is not None:
            if not provider:
                raise ValueError("使用自定义配置时必须指定provider")
            return self._get_provider_class(provider)(config)
        
        # 场景2：从数据库加载配置
        if provider:
            config = self.config_service.get_provider_config(provider)
            if not config:
                raise ValueError(f"TTS提供商 {provider} 未配置")
        else:
            # 未指定则获取当前 Active 的提供商
            active = self.config_service.get_active_provider()
            if not active:
                raise ValueError("未设置活动的TTS提供商，请先配置")
            provider, config = active
        
        # 生成配置版本标识
        import json
        config_version = json.dumps(config, sort_keys=True)
        
        # 检查缓存是否有效
        if provider in self._instances:
            if self._config_versions.get(provider) == config_version:
                return self._instances[provider]
            else:
                logger.info(f"检测到 {provider} 配置变化，重新创建实例")
                del self._instances[provider]
                del self._config_versions[provider]

        # 实例化并缓存
        instance = self._get_provider_class(provider)(config)
        self._instances[provider] = instance
        self._config_versions[provider] = config_version
        return instance
    
    def get_default_tts(self) -> TTSBase:
        return self.create_tts()
    
    def clear_cache(self, provider: Optional[str] = None):
        """清除缓存
        
        Args:
            provider: 指定清除某个服务商的缓存，None则清除所有
        """
        if provider:
            self._instances.pop(provider, None)
            self._config_versions.pop(provider, None)
            logger.info(f"已清除 {provider} 的缓存")
        else:
            self._instances.clear()
            self._config_versions.clear()
            logger.info("已清除所有TTS实例缓存")
