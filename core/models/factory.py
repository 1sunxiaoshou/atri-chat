"""模型工厂

提供模型创建和供应商模板管理功能。
职责：
1. 注册和管理供应商模板（Provider 实现类）
2. 根据配置创建模型实例
3. 提供模板元数据查询

注意：不再负责数据访问，配置由 ModelService 通过 Repository 获取。
"""
from typing import Optional, Any, Dict, List
from .config import ModelConfig, ProviderMetadata, ProviderConfig
from .providers.base import BaseProvider
from . import providers
from ..logger import get_logger

logger = get_logger(__name__)


class ModelFactory:
    """模型工厂
    
    使用供应商插件化架构管理不同供应商的模型创建逻辑。
    所有供应商配置统一存储在数据库，通过 provider_type 路由到对应的 Provider 实现类。
    
    注意：Factory 不再持有 storage，所有配置由调用者（ModelService）提供。
    """
    
    def __init__(self):
        """初始化模型工厂（无状态）"""
        self._provider_templates: Dict[str, providers.BaseProvider] = {}
        self._register_provider_templates()
    
    def _register_provider_templates(self):
        """注册供应商模板（Provider 实现类）"""
        self.register_provider_template(providers.OpenAIProvider())
        self.register_provider_template(providers.AnthropicProvider())
        self.register_provider_template(providers.GoogleProvider())
        self.register_provider_template(providers.QwenProvider())
        self.register_provider_template(providers.OllamaProvider())
        self.register_provider_template(providers.MistralProvider())
        self.register_provider_template(providers.DeepSeekProvider())
        self.register_provider_template(providers.CohereProvider())
        self.register_provider_template(providers.GroqProvider())
        self.register_provider_template(providers.XAIProvider())
    
    def get_available_templates(self) -> List[str]:
        """获取所有可用的供应商模板类型"""
        return list(self._provider_templates.keys())
    
    def register_provider_template(self, provider: providers.BaseProvider) -> None:
        """注册供应商模板
        
        Args:
            provider: 供应商实例
        """
        self._provider_templates[provider.metadata.provider_id] = provider
    
    def get_provider_template(self, provider_type: str) -> Optional[BaseProvider]:
        """根据供应商类型获取 Provider 实现类
        
        Args:
            provider_type: 供应商类型 (openai, anthropic, google, qwen, ollama)
        
        Returns:
            Provider 实例，如果模板不存在则返回 None
        """
        return self._provider_templates.get(provider_type)
    
    def get_all_template_metadata(self) -> Dict[str, ProviderMetadata]:
        """获取所有供应商模板的元数据"""
        return {
            template_id: provider.metadata
            for template_id, provider in self._provider_templates.items()
        }
    
    def create_model(
        self,
        model_config: ModelConfig,
        provider_config: ProviderConfig,
        provider_type: str,
        **kwargs
    ) -> Optional[Any]:
        """根据配置创建模型实例
        
        注意：配置由调用者提供（通过 Repository 获取），Factory 只负责创建。
        
        Args:
            model_config: 模型配置对象
            provider_config: 供应商配置对象
            provider_type: 供应商类型（openai, anthropic 等）
            **kwargs: 动态参数（temperature, max_tokens等），会覆盖配置中的默认值
            
        Returns:
            模型实例（LangChain ChatModel）
            
        Raises:
            ValueError: 当模板类型不支持或创建失败时
        """
        # 根据 provider_type 获取 Provider 实现类
        provider_template = self.get_provider_template(provider_type)
        if not provider_template:
            logger.error(f"不支持的供应商类型: {provider_type}")
            raise ValueError(f"不支持的供应商类型: {provider_type}")
        
        # 使用 Provider 实例化模型
        try:
            model = provider_template.create_model(model_config, provider_config, **kwargs)
            if model is None:
                logger.error(f"模型创建失败: {model_config.provider_config_id}/{model_config.model_id}")
                raise ValueError(f"模型创建失败，请检查配置")
            
            return model
        except Exception as e:
            logger.error(
                f"创建模型时出错",
                extra={
                    "provider_config_id": model_config.provider_config_id,
                    "model_id": model_config.model_id,
                    "error": str(e)
                },
                exc_info=True
            )
            raise ValueError(f"创建模型时出错: {str(e)}")
    
    def validate_provider_type(self, provider_type: str) -> bool:
        """验证供应商类型是否有效
        
        Args:
            provider_type: 供应商类型
            
        Returns:
            是否有效
        """
        return provider_type in self._provider_templates

