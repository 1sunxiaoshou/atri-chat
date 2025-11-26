"""TTS 工厂类"""
import yaml
from pathlib import Path
from typing import Optional

from .base import TTSBase
from .gpt_sovits import GPTSoVITSTTS


class TTSFactory:
    """TTS 工厂类，负责创建和管理 TTS 实例"""
    
    def __init__(self, config_path: str = "config/tts.yaml"):
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
            raise FileNotFoundError(f"TTS配置文件不存在: {self.config_path}")
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    
    def create_tts(self, provider: Optional[str] = None) -> TTSBase:
        """创建 TTS 实例
        
        Args:
            provider: 提供商名称，不指定则使用默认提供商
            
        Returns:
            TTS 实例
            
        Raises:
            ValueError: 当提供商不存在或未启用时
        """
        provider = provider or self.config.get("default_provider", "gpt_sovits")
        
        # 检查缓存
        if provider in self._instances:
            return self._instances[provider]
        
        # 获取提供商配置
        provider_config = self.config.get("providers", {}).get(provider)
        if not provider_config:
            raise ValueError(f"TTS提供商 {provider} 不存在")
        
        if not provider_config.get("enabled", False):
            raise ValueError(f"TTS提供商 {provider} 未启用")
        
        # 创建实例
        if provider == "gpt_sovits":
            instance = GPTSoVITSTTS(provider_config)
        elif provider == "openai":
            raise NotImplementedError("OpenAI TTS 尚未实现")
        else:
            raise ValueError(f"未知的TTS提供商: {provider}")
        
        # 缓存实例
        self._instances[provider] = instance
        return instance
    
    def get_default_tts(self) -> TTSBase:
        """获取默认 TTS 实例"""
        return self.create_tts()
    
    def reload_config(self):
        """重新加载配置文件"""
        self.config = self._load_config()
        self._instances.clear()
