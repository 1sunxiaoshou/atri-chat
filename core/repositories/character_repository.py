"""角色 Repository"""
import json
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from core.db import Character, Motion, CharacterMotionBinding
from .base import BaseRepository


# 默认资源定义（防止数据库为空）
DEFAULT_EXPRESSIONS = ["neutral", "happy", "angry", "sad", "relaxed"]


class CharacterRepository(BaseRepository[Character]):
    """角色仓储
    
    负责角色的数据访问操作。
    """
    
    def get(self, id: str) -> Optional[Character]:
        """根据 ID 获取角色"""
        return self.db.query(Character).filter(Character.id == id).first()
    
    def get_with_relations(self, id: str) -> Optional[Character]:
        """获取角色及其关联数据（avatar, voice_asset, primary_model, motion_bindings）"""
        return self.db.query(Character)\
            .options(
                joinedload(Character.avatar),
                joinedload(Character.voice_asset),
                joinedload(Character.primary_model),
                joinedload(Character.motion_bindings).joinedload(CharacterMotionBinding.motion)
            )\
            .filter(Character.id == id)\
            .first()
    
    def get_avatar_expressions(self, character_id: str) -> List[str]:
        """获取角色形象支持的表情列表
        
        Args:
            character_id: 角色 ID
            
        Returns:
            表情列表，如 ["neutral", "happy", "angry"]
        """
        character = self.db.query(Character)\
            .options(joinedload(Character.avatar))\
            .filter(Character.id == character_id)\
            .first()
        
        if not character or not character.avatar:
            return DEFAULT_EXPRESSIONS
        
        # 解析 JSON 字符串
        try:
            if character.avatar.available_expressions:
                return json.loads(character.avatar.available_expressions)
        except (json.JSONDecodeError, TypeError):
            pass
        
        return DEFAULT_EXPRESSIONS
    
    def get_character_motions(self, character_id: str, category: Optional[str] = None) -> List[Motion]:
        """获取角色绑定的动作列表
        
        Args:
            character_id: 角色 ID
            category: 动作分类（可选），如 'idle', 'thinking', 'reply'
            
        Returns:
            动作列表（按权重降序）
        """
        character = self.db.query(Character)\
            .options(joinedload(Character.motion_bindings).joinedload(CharacterMotionBinding.motion))\
            .filter(Character.id == character_id)\
            .first()
        
        if not character or not character.motion_bindings:
            return []
        
        # 过滤分类
        bindings = character.motion_bindings
        if category:
            bindings = [b for b in bindings if b.category == category]
        
        return [b.motion for b in bindings]
    
    def list(
        self, 
        skip: int = 0, 
        limit: int = 100, 
        **filters
    ) -> List[Character]:
        """列出角色
        
        支持的过滤条件：
        - enabled_only: 仅启用的角色
        - search: 按名称搜索
        """
        query = self.db.query(Character)
        
        # 仅启用的角色
        if filters.get('enabled_only', False):
            query = query.filter(Character.enabled == True)
        
        # 按名称搜索
        if 'search' in filters and filters['search']:
            query = query.filter(
                Character.name.ilike(f"%{filters['search']}%")
            )
        
        # 排序
        query = query.order_by(Character.created_at.desc())
        
        return query.offset(skip).limit(limit).all()
    
    def create(self, **data) -> Character:
        """创建角色"""
        character = Character(**data)
        self.db.add(character)
        self.db.commit()
        self.db.refresh(character)
        return character
    
    def update(self, id: str, **data) -> Optional[Character]:
        """更新角色"""
        character = self.get(id)
        if not character:
            return None
        
        for key, value in data.items():
            if hasattr(character, key):
                setattr(character, key, value)
        
        self.db.commit()
        self.db.refresh(character)
        return character
    
    def delete(self, id: str) -> bool:
        """删除角色（级联删除会话和绑定）"""
        character = self.get(id)
        if not character:
            return False
        
        self.db.delete(character)
        self.db.commit()
        return True
    
    def get_by_provider(self, provider_id: str) -> List[Character]:
        """获取使用指定供应商的所有角色
        
        Args:
            provider_id: 供应商 ID
            
        Returns:
            角色列表
        """
        return self.db.query(Character).filter(
            Character.primary_provider_id == provider_id
        ).all()
