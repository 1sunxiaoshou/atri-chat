"""模型服务 - 协调 Repository 和 Factory

职责：
1. 通过 Repository 获取配置数据
2. 使用 Factory 创建模型实例
3. 提供业务逻辑层的模型管理功能
"""
from typing import Optional, Any
from sqlalchemy.orm import Session

from core.repositories import ProviderRepository, ModelRepository, CharacterRepository
from core.models.factory import ModelFactory
from core.models.config import ProviderConfig, ModelConfig
from core.logger import get_logger

logger = get_logger(__name__)


class ModelService:
    """模型服务
    
    协调 Repository（数据访问）和 Factory（模型创建）。
    """
    
    def __init__(self, db: Session, model_factory: ModelFactory):
        """初始化模型服务
        
        Args:
            db: 数据库会话（请求级别）
            model_factory: 模型工厂（无状态，可共享）
        """
        self.provider_repo = ProviderRepository(db)
        self.model_repo = ModelRepository(db)
        self.character_repo = CharacterRepository(db)
        self.model_factory = model_factory
    
    def create_model_instance(
        self, 
        provider_id: str, 
        model_id: str, 
        **kwargs
    ) -> Any:
        """创建模型实例
        
        Args:
            provider_id: 供应商 ID
            model_id: 模型 ID
            **kwargs: 动态参数（temperature, max_tokens 等）
            
        Returns:
            模型实例（LangChain ChatModel）
            
        Raises:
            ValueError: 当模型或供应商不存在、未启用或创建失败时
        """
        # 1. 通过 Repository 获取模型配置
        model_orm = self.model_repo.get_by_provider_and_model(provider_id, model_id)
        if not model_orm:
            logger.error(f"模型不存在: {provider_id}/{model_id}")
            raise ValueError(f"模型 {provider_id}/{model_id} 不存在")
        
        if not model_orm.enabled:
            logger.error(f"模型未启用: {provider_id}/{model_id}")
            raise ValueError(f"模型 {provider_id}/{model_id} 未启用")
        
        # 2. 通过 Repository 获取供应商配置
        provider_orm = self.provider_repo.get_by_provider_id(provider_id)
        if not provider_orm:
            logger.error(f"供应商不存在: {provider_id}")
            raise ValueError(f"供应商 {provider_id} 不存在")
        
        # 3. 转换为 Factory 需要的配置对象
        model_config = ModelConfig(
            provider_id=model_orm.provider_id,
            model_id=model_orm.model_id,
            model_type=model_orm.model_type,
            capabilities=model_orm.capabilities,
            context_window=model_orm.context_window,
            max_output=model_orm.max_output,
            enabled=model_orm.enabled
        )
        
        provider_config = ProviderConfig(
            provider_id=provider_orm.provider_id,
            config_json=provider_orm.config_json
        )
        
        # 4. 使用 Factory 创建模型实例
        try:
            model = self.model_factory.create_model(
                model_config=model_config,
                provider_config=provider_config,
                template_type=provider_orm.template_type,
                **kwargs
            )
            
            if model is None:
                logger.error(f"模型创建失败: {provider_id}/{model_id}")
                raise ValueError(f"模型 {provider_id}/{model_id} 创建失败，请检查配置")
            
            return model
            
        except Exception as e:
            logger.error(
                f"创建模型时出错",
                extra={"provider_id": provider_id, "model_id": model_id, "error": str(e)},
                exc_info=True
            )
            raise ValueError(f"创建模型 {provider_id}/{model_id} 时出错: {str(e)}")
    
    def check_provider_dependencies(self, provider_id: str) -> dict:
        """检查供应商的依赖关系
        
        Args:
            provider_id: 供应商 ID
            
        Returns:
            依赖信息字典，包含 models 和 characters 列表
        """
        dependencies = {
            "models": [],
            "characters": []
        }
        
        # 检查依赖的模型
        models = self.model_repo.list_by_provider(provider_id, enabled_only=False)
        dependencies["models"] = [m.model_id for m in models]
        
        # 检查依赖的角色
        characters = self.character_repo.get_by_provider(provider_id)
        dependencies["characters"] = [char.name for char in characters]
        
        return dependencies
