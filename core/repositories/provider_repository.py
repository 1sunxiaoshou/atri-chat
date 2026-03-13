"""供应商 Repository"""
from typing import Optional, List
from sqlalchemy.orm import Session
from core.db import ProviderConfig
from .base import BaseRepository


class ProviderRepository(BaseRepository[ProviderConfig]):
    """供应商仓储
    
    负责供应商配置的数据访问操作。
    """
    
    def get(self, id: int) -> Optional[ProviderConfig]:
        """根据内部整数 ID 获取供应商"""
        return self.db.query(ProviderConfig).filter(
            ProviderConfig.id == id
        ).first()
    
    def get_by_name(self, name: str) -> Optional[ProviderConfig]:
        """根据显示名称获取供应商
        
        Args:
            name: 供应商显示名称
            
        Returns:
            供应商配置对象
        """
        return self.db.query(ProviderConfig).filter(
            ProviderConfig.name == name
        ).first()
    
    def list(self, skip: int = 0, limit: int = 100, **filters) -> List[ProviderConfig]:
        """列出供应商"""
        query = self.db.query(ProviderConfig)
        
        # 按创建时间倒序
        query = query.order_by(ProviderConfig.created_at.desc())
        
        return query.offset(skip).limit(limit).all()
    
    def create(self, **data) -> ProviderConfig:
        """创建供应商"""
        provider = ProviderConfig(**data)
        self.db.add(provider)
        self.db.commit()
        self.db.refresh(provider)
        return provider
    
    def update(self, id: int, **data) -> Optional[ProviderConfig]:
        """更新供应商"""
        provider = self.get(id)
        if not provider:
            return None
        
        for key, value in data.items():
            if hasattr(provider, key):
                setattr(provider, key, value)
        
        self.db.commit()
        self.db.refresh(provider)
        return provider
    
    def update_by_name(self, name: str, **data) -> Optional[ProviderConfig]:
        """根据显示名称更新供应商"""
        provider = self.get_by_name(name)
        if not provider:
            return None
        
        for key, value in data.items():
            if hasattr(provider, key):
                setattr(provider, key, value)
        
        self.db.commit()
        self.db.refresh(provider)
        return provider
    
    def delete(self, id: int) -> bool:
        """删除供应商（级联删除模型）"""
        provider = self.get(id)
        if not provider:
            return False
        
        self.db.delete(provider)
        self.db.commit()
        return True
    
    def delete_by_name(self, name: str) -> bool:
        """根据显示名称删除供应商"""
        provider = self.get_by_name(name)
        if not provider:
            return False
        
        self.db.delete(provider)
        self.db.commit()
        return True
