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
        provider_id: str, 
        model_id: str
    ) -> Optional[Model]:
        """根据供应商和模型 ID 获取模型
        
        Args:
            provider_id: 供应商标识
            model_id: 模型标识
            
        Returns:
            模型配置对象
        """
        return self.db.query(Model).filter(
            Model.provider_id == provider_id,
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
        if 'provider_id' in filters:
            query = query.filter(Model.provider_id == filters['provider_id'])
        
        # 按模型类型过滤
        if 'model_type' in filters:
            query = query.filter(Model.model_type == filters['model_type'])
        
        # 仅启用的模型
        if filters.get('enabled_only', False):
            query = query.filter(Model.enabled == True)
        
        # 排序
        query = query.order_by(Model.provider_id, Model.created_at.desc())
        
        return query.offset(skip).limit(limit).all()
    
    def list_by_provider(
        self, 
        provider_id: str, 
        enabled_only: bool = False
    ) -> List[Model]:
        """列出指定供应商的所有模型
        
        Args:
            provider_id: 供应商 ID
            enabled_only: 是否仅返回启用的模型
            
        Returns:
            模型列表
        """
        return self.list(
            provider_id=provider_id,
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
        provider_id: str,
        model_id: str,
        **data
    ) -> Optional[Model]:
        """根据供应商和模型 ID 更新模型"""
        model = self.get_by_provider_and_model(provider_id, model_id)
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
        provider_id: str,
        model_id: str
    ) -> bool:
        """根据供应商和模型 ID 删除模型"""
        model = self.get_by_provider_and_model(provider_id, model_id)
        if not model:
            return False
        
        self.db.delete(model)
        self.db.commit()
        return True
