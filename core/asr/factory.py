"""ASR 工厂类"""
import yaml
from pathlib import Path
from typing import Optional

from .base import ASRBase


class ASRFactory:
    """ASR 工厂类，负责创建和管理 ASR 实例"""
    
    # 提供商映射表（懒加载）
    _PROVIDERS = {
        "openai": "openai_whisper.OpenAIWhisperASR",
        "funasr": "funasr.FunASR",
    }
    
    def __init__(self, config_path: str = "config/asr.yaml"):
        """初始化
        
        Args:
            config_path: 配置文件路径
        """
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self._instances = {}
    
    def _load_config(self) -> dict:
        """加载配置文件"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"ASR配置文件不存在: {self.config_path}")
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    
    def _get_provider_class(self, provider: str):
        """动态导入提供商类（懒加载）"""
        if provider not in self._PROVIDERS:
            raise ValueError(f"未知的ASR提供商: {provider}")
        
        module_path = self._PROVIDERS[provider]
        module_name, class_name = module_path.rsplit(".", 1)
        
        try:
            # 使用相对导入
            import importlib
            module = importlib.import_module(f".{module_name}", package="core.asr")
            return getattr(module, class_name)
        except (ImportError, AttributeError) as e:
            raise ValueError(f"无法加载ASR提供商 {provider}: {e}")
    
    def create_asr(self, provider: Optional[str] = None) -> ASRBase:
        """创建 ASR 实例
        
        Args:
            provider: 提供商名称，不指定则使用默认提供商
            
        Returns:
            ASR 实例
            
        Raises:
            ValueError: 当提供商不存在或未启用时
        """
        provider = provider or self.config.get("default_provider", "openai")
        
        # 检查缓存
        if provider in self._instances:
            return self._instances[provider]
        
        # 获取提供商配置
        provider_config = self.config.get("providers", {}).get(provider)
        if not provider_config:
            raise ValueError(f"ASR提供商 {provider} 不存在")
        
        if not provider_config.get("enabled", False):
            raise ValueError(f"ASR提供商 {provider} 未启用")
        
        # 动态导入并创建实例
        provider_class = self._get_provider_class(provider)
        instance = provider_class(provider_config)
        
        # 缓存实例
        self._instances[provider] = instance
        return instance
    
    def get_default_asr(self) -> ASRBase:
        """获取默认 ASR 实例"""
        return self.create_asr()
    
    def reload_config(self):
        """重新加载配置文件"""
        self.config = self._load_config()
        self._instances.clear()