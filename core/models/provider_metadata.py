"""供应商元数据定义"""
from typing import Dict, Optional, TYPE_CHECKING
from .config import ProviderMetadata

if TYPE_CHECKING:
    from .factory import ModelFactory


def get_supported_providers(factory: Optional["ModelFactory"] = None) -> Dict[str, ProviderMetadata]:
    """获取所有支持的供应商
    
    Args:
        factory: 模型工厂实例，如果提供则从工厂获取，否则返回默认供应商
    """
    if factory:
        return {
            provider_id: provider.metadata
            for provider_id, provider in factory.list_providers().items()
        }
    
    # 默认供应商列表
    from .provider import (
        OpenAIProvider, AnthropicProvider, GoogleProvider, 
        TongyiProvider, LocalProvider
    )
    
    providers = [
        OpenAIProvider(),
        AnthropicProvider(),
        GoogleProvider(),
        TongyiProvider(),
        LocalProvider(),
    ]
    
    return {p.metadata.provider_id: p.metadata for p in providers}


def get_provider_metadata(provider_id: str, factory: Optional["ModelFactory"] = None) -> Optional[ProviderMetadata]:
    """获取供应商元数据
    
    Args:
        provider_id: 供应商ID
        factory: 模型工厂实例
    """
    providers = get_supported_providers(factory)
    return providers.get(provider_id)
