"""模型工厂

提供模型创建、供应商管理和依赖检查功能
"""
from typing import Optional, Any, TYPE_CHECKING, Dict, List
from .config import ModelConfig, ProviderMetadata, ProviderConfig
from .provider import BaseProvider, OpenAIProvider, AnthropicProvider, GoogleProvider, TongyiProvider, LocalProvider
from ..logger import get_logger

if TYPE_CHECKING:
    from ..storage import AppStorage

logger = get_logger(__name__, category="MODEL")


class ModelFactory:
    """模型工厂
    
    使用供应商插件化架构管理不同供应商的模型创建逻辑。
    所有供应商配置统一存储在数据库，通过 template_type 路由到对应的 Provider 实现类。
    """
    
    def __init__(self, storage: "AppStorage"):
        self.storage = storage
        self._provider_templates: Dict[str, BaseProvider] = {}
        self._register_provider_templates()
        logger.debug(f"ModelFactory 初始化完成", extra={"template_count": len(self._provider_templates)})
    
    def _register_provider_templates(self):
        """注册供应商模板（Provider 实现类）"""
        self.register_provider_template(OpenAIProvider())
        self.register_provider_template(AnthropicProvider())
        self.register_provider_template(GoogleProvider())
        self.register_provider_template(TongyiProvider())
        self.register_provider_template(LocalProvider())
    
    def get_available_templates(self) -> List[str]:
        """获取所有可用的供应商模板类型"""
        return list(self._provider_templates.keys())
    
    def register_provider_template(self, provider: BaseProvider) -> None:
        """注册供应商模板
        
        Args:
            provider: 供应商实例
        """
        self._provider_templates[provider.metadata.provider_id] = provider
    
    def get_provider_template(self, template_type: str) -> Optional[BaseProvider]:
        """根据模板类型获取 Provider 实现类
        
        Args:
            template_type: 模板类型 (openai, anthropic, google, tongyi, local)
        
        Returns:
            Provider 实例，如果模板不存在则返回 None
        """
        return self._provider_templates.get(template_type)
    
    def get_all_template_metadata(self) -> Dict[str, ProviderMetadata]:
        """获取所有供应商模板的元数据"""
        return {
            template_id: provider.metadata
            for template_id, provider in self._provider_templates.items()
        }
    
    def create_model(self, provider_id: str, model_id: str, **kwargs) -> Optional[Any]:
        """根据 provider_id 和 model_id 创建模型实例
        
        流程：
        1. 从数据库查询模型配置
        2. 从数据库查询供应商配置（获取 api_key、base_url、template_type 等）
        3. 根据 template_type 找到对应的 Provider 实现类
        4. 使用 Provider 实例化模型
        
        Args:
            provider_id: 供应商ID
            model_id: 模型ID
            **kwargs: 动态参数（temperature, max_tokens等），会覆盖配置中的默认值
            
        Raises:
            ValueError: 当模型或供应商配置不存在、未启用或创建失败时
        """
        # 1. 获取模型配置
        logger.debug(f"获取模型配置", extra={"provider_id": provider_id, "model_id": model_id})
        model_config = self.storage.get_model(provider_id, model_id)
        if not model_config:
            logger.error(f"模型不存在", extra={"provider_id": provider_id, "model_id": model_id})
            raise ValueError(f"模型 {provider_id}/{model_id} 不存在")
        if not model_config.enabled:
            logger.error(f"模型未启用", extra={"provider_id": provider_id, "model_id": model_id})
            raise ValueError(f"模型 {provider_id}/{model_id} 未启用")
        
        # 2. 获取供应商配置
        provider_config_dict = self.storage.get_provider(provider_id)
        if not provider_config_dict:
            logger.error(f"供应商不存在", extra={"provider_id": provider_id})
            raise ValueError(f"供应商 {provider_id} 不存在")
        
        # 3. 根据 template_type 获取 Provider 实现类
        template_type = provider_config_dict.get("template_type", "openai")
        logger.debug(f"使用模板类型", extra={"template_type": template_type, "provider_id": provider_id})
        provider_template = self.get_provider_template(template_type)
        if not provider_template:
            logger.error(f"不支持的模板类型", extra={"template_type": template_type})
            raise ValueError(f"不支持的供应商模板类型: {template_type}")
        
        # 4. 构造 ProviderConfig 并实例化模型
        try:
            provider_config = ProviderConfig(
                provider_id=provider_config_dict["provider_id"],
                config_json=provider_config_dict["config_json"]
            )
            
            model = provider_template.create_model(model_config, provider_config, **kwargs)
            if model is None:
                logger.error(f"模型创建失败", extra={"provider_id": provider_id, "model_id": model_id})
                raise ValueError(f"模型 {provider_id}/{model_id} 创建失败，请检查配置")
            
            logger.info(
                f"模型创建成功",
                extra={
                    "provider_id": provider_id,
                    "model_id": model_id,
                    "template_type": template_type,
                    "has_kwargs": bool(kwargs)
                }
            )
            return model
        except Exception as e:
            logger.error(
                f"创建模型时出错",
                extra={"provider_id": provider_id, "model_id": model_id, "error": str(e)},
                exc_info=True
            )
            raise ValueError(f"创建模型 {provider_id}/{model_id} 时出错: {str(e)}")
    
    def check_provider_dependencies(self, provider_id: str) -> Dict[str, List[str]]:
        """检查供应商的依赖关系
        
        Args:
            provider_id: 供应商ID
            
        Returns:
            依赖信息字典，包含 models 和 characters 列表
        """
        dependencies = {
            "models": [],
            "characters": []
        }
        
        # 检查依赖的模型
        models = self.storage.list_models(provider_id=provider_id, enabled_only=False)
        dependencies["models"] = [m.model_id for m in models]
        
        # 检查依赖的角色
        characters = self.storage.list_characters(enabled_only=False)
        for char in characters:
            if char["primary_provider_id"] == provider_id:
                dependencies["characters"].append(char["name"])
        
        return dependencies
    
    def validate_template_type(self, template_type: str) -> bool:
        """验证模板类型是否有效
        
        Args:
            template_type: 模板类型
            
        Returns:
            是否有效
        """
        return template_type in self._provider_templates
