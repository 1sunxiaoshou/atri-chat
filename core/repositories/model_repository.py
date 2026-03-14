"""模型 Repository"""
from typing import Optional, List
from sqlalchemy.orm import Session
from core.db import Model
from .base import BaseRepository


class ModelRepository(BaseRepository[Model]):
    """模型仓储
    
    负责模型配置的数据访问操作。
    """
    
    def get(self, id: str) -> Optional[Model]:
        """根据 UUID 获取模型"""
        return self.db.query(Model).filter(Model.id == id).first()
    
    def get_by_provider_and_model(
        self, 
        provider_config_id: int, 
        model_id: str
    ) -> Optional[Model]:
        """根据供应商 ID 和模型 ID 获取模型
        
        Args:
            provider_config_id: 供应商配置内部 ID
            model_id: 模型标识
            
        Returns:
            模型配置对象
        """
        return self.db.query(Model).filter(
            Model.provider_config_id == provider_config_id,
            Model.model_id == model_id
        ).first()
    
    def list(
        self, 
        skip: int = 0, 
        limit: int = 100, 
        **filters
    ) -> List[Model]:
        """列出模型
        
        支持的过滤条件：
        - provider_id: 供应商 ID
        - model_type: 模型类型
        - enabled_only: 仅启用的模型
        """
        query = self.db.query(Model)
        
        # 按供应商过滤
        if 'provider_config_id' in filters:
            query = query.filter(Model.provider_config_id == filters['provider_config_id'])
        elif 'provider_id' in filters:
            # 兼容旧代码，将 provider_id 视为 provider_config_id (如果传的是 int)
            query = query.filter(Model.provider_config_id == filters['provider_id'])
        
        # 按模型类型过滤
        if 'model_type' in filters:
            query = query.filter(Model.model_type == filters['model_type'])
        
        # 按能力过滤
        if filters.get('has_vision'): query = query.filter(Model.has_vision == True)
        if filters.get('has_audio'): query = query.filter(Model.has_audio == True)
        if filters.get('has_video'): query = query.filter(Model.has_video == True)
        if filters.get('has_reasoning'): query = query.filter(Model.has_reasoning == True)
        if filters.get('has_tool_use'): query = query.filter(Model.has_tool_use == True)
        if filters.get('has_document'): query = query.filter(Model.has_document == True)
        if filters.get('has_structured_output'): query = query.filter(Model.has_structured_output == True)

        # 仅启用的模型
        if filters.get('enabled_only', False):
            query = query.filter(Model.enabled == True)
        
        # 排序
        query = query.order_by(Model.provider_config_id, Model.created_at.desc())
        
        return query.offset(skip).limit(limit).all()
    
    def list_by_provider(
        self, 
        provider_config_id: int, 
        enabled_only: bool = False
    ) -> List[Model]:
        """列出指定供应商的所有模型
        
        Args:
            provider_config_id: 供应商配置内部 ID
            enabled_only: 是否仅返回启用的模型
            
        Returns:
            模型列表
        """
        return self.list(
            provider_config_id=provider_config_id,
            enabled_only=enabled_only,
            limit=1000  # 获取所有
        )
    
    def create(self, **data) -> Model:
        """创建模型"""
        model = Model(**data)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model
    
    def update(self, id: str, **data) -> Optional[Model]:
        """更新模型"""
        model = self.get(id)
        if not model:
            return None
        
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        
        self.db.commit()
        self.db.refresh(model)
        return model
    
    def update_by_provider_and_model(
        self,
        provider_config_id: int,
        model_id: str,
        **data
    ) -> Optional[Model]:
        """根据供应商 ID 和模型 ID 更新模型"""
        model = self.get_by_provider_and_model(provider_config_id, model_id)
        if not model:
            return None
        
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        
        self.db.commit()
        self.db.refresh(model)
        return model
    
    def delete(self, id: str) -> bool:
        """删除模型"""
        model = self.get(id)
        if not model:
            return False
        
        self.db.delete(model)
        self.db.commit()
        return True
    
    def delete_by_provider_and_model(
        self,
        provider_config_id: int,
        model_id: str
    ) -> bool:
        """根据供应商 ID 和模型 ID 删除模型"""
        model = self.get_by_provider_and_model(provider_config_id, model_id)
        if not model:
            return False
        
        self.db.delete(model)
        self.db.commit()
        return True
