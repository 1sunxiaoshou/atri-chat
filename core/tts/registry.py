"""TTS 服务商注册中心"""
from typing import Type, Dict, Tuple

from core.logger import get_logger

logger = get_logger(__name__, category="MODEL")


class TTSRegistry:
    """TTS 服务商注册中心（单例模式）"""
    
    _providers: Dict[str, Tuple[Type, str]] = {}  # {provider_id: (class, display_name)}
    
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
            logger.debug(f"TTS 服务商已注册", extra={"provider": provider_id, "name": name})
            return provider_class
        return decorator
    
    @classmethod
    def get_provider_class(cls, provider_id: str) -> Type:
        """获取服务商类
        
        Args:
            provider_id: 服务商ID
            
        Returns:
            服务商类
            
        Raises:
            ValueError: 未知的服务商
        """
        if provider_id not in cls._providers:
            raise ValueError(f"未知的 TTS 服务商: {provider_id}")
        return cls._providers[provider_id][0]
    
    @classmethod
    def get_all_providers(cls) -> Dict[str, Tuple[Type, str]]:
        """获取所有已注册的服务商
        
        Returns:
            {provider_id: (class, display_name)}
        """
        return cls._providers.copy()
    
    @classmethod
    def get_provider_name(cls, provider_id: str) -> str:
        """获取服务商显示名称"""
        if provider_id not in cls._providers:
            return provider_id
        return cls._providers[provider_id][1]
