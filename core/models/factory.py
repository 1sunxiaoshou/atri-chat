"""模型工厂"""
from typing import Optional, Any, TYPE_CHECKING, Dict, List
from .config import ModelConfig
from .provider import BaseProvider, OpenAIProvider, AnthropicProvider, GoogleProvider, TongyiProvider, LocalProvider

if TYPE_CHECKING:
    from ..storage import AppStorage


class ModelFactory:
    """模型工厂
    
    使用供应商插件化架构管理不同供应商的模型创建逻辑。
    支持动态注册自定义供应商。
    """
    
    def __init__(self, storage: "AppStorage"):
        self.storage = storage
        self._providers: Dict[str, BaseProvider] = {}
        self._register_default_providers()
    
    def _register_default_providers(self):
        """注册默认供应商"""
        self.register_provider(OpenAIProvider())
        self.register_provider(AnthropicProvider())
        self.register_provider(GoogleProvider())
        self.register_provider(TongyiProvider())
        self.register_provider(LocalProvider())
    
    def register_provider(self, provider: BaseProvider) -> None:
        """注册供应商
        
        Args:
            provider: 供应商实例
        """
        self._providers[provider.metadata.provider_id] = provider
    
    def get_provider(self, provider_id: str) -> Optional[BaseProvider]:
        """获取供应商"""
        return self._providers.get(provider_id)
    
    def list_providers(self) -> Dict[str, BaseProvider]:
        """列出所有已注册的供应商"""
        return self._providers.copy()
    
    def create_model(self, provider_id: str, model_id: str, **kwargs) -> Optional[Any]:
        """根据provider_id和model_id创建模型实例
        
        Args:
            provider_id: 供应商ID
            model_id: 模型ID
            **kwargs: 动态参数（temperature, max_tokens等），会覆盖配置中的默认值
        """
        model_config = self.storage.get_model(provider_id, model_id)
        if not model_config or not model_config.enabled:
            return None
        
        provider_config = self.storage.get_provider(provider_id)
        if not provider_config:
            return None
        
        provider = self.get_provider(provider_id)
        if not provider:
            print(f"警告: 未注册的供应商 '{provider_id}'")
            return None
        
        return provider.create_model(model_config, provider_config, **kwargs)
    
    def get_available_models(self, provider_id: str) -> List[str]:
        """获取供应商的可用模型列表
        
        Args:
            provider_id: 供应商ID
            
        Returns:
            模型ID列表
        """
        provider_config = self.storage.get_provider(provider_id)
        if not provider_config:
            return []
        
        provider = self.get_provider(provider_id)
        if not provider:
            return []
        
        return provider.get_available_models(provider_config)
