"""供应商 Repository"""
from typing import Optional, List
from sqlalchemy.orm import Session
from core.db import ProviderConfig
from .base import BaseRepository


class ProviderRepository(BaseRepository[ProviderConfig]):
    """供应商仓储
    
    负责供应商配置的数据访问操作。
    """
    
    def get(self, id: str) -> Optional[ProviderConfig]:
        """根据 UUID 获取供应商"""
        return self.db.query(ProviderConfig).filter(
            ProviderConfig.id == id
        ).first()
    
    def get_by_provider_id(self, provider_id: str) -> Optional[ProviderConfig]:
        """根据 provider_id 获取供应商
        
        Args:
            provider_id: 供应商标识（如 openai, anthropic）
            
        Returns:
            供应商配置对象
        """
        return self.db.query(ProviderConfig).filter(
            ProviderConfig.provider_id == provider_id
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
    
    def update(self, id: str, **data) -> Optional[ProviderConfig]:
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
    
    def update_by_provider_id(self, provider_id: str, **data) -> Optional[ProviderConfig]:
        """根据 provider_id 更新供应商"""
        provider = self.get_by_provider_id(provider_id)
        if not provider:
            return None
        
        for key, value in data.items():
            if hasattr(provider, key):
                setattr(provider, key, value)
        
        self.db.commit()
        self.db.refresh(provider)
        return provider
    
    def delete(self, id: str) -> bool:
        """删除供应商（级联删除模型）"""
        provider = self.get(id)
        if not provider:
            return False
        
        self.db.delete(provider)
        self.db.commit()
        return True
    
    def delete_by_provider_id(self, provider_id: str) -> bool:
        """根据 provider_id 删除供应商"""
        provider = self.get_by_provider_id(provider_id)
        if not provider:
            return False
        
        self.db.delete(provider)
        self.db.commit()
        return True
