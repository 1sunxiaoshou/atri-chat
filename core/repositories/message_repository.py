"""消息 Repository"""
from typing import Optional, List
from sqlalchemy.orm import Session
from core.db import Message
from .base import BaseRepository


class MessageRepository(BaseRepository[Message]):
    """消息仓储
    
    负责消息的数据访问操作。
    """
    
    def get(self, id: str) -> Optional[Message]:
        """根据 ID 获取消息"""
        return self.db.query(Message).filter(Message.id == id).first()
    
    def list(
        self, 
        skip: int = 0, 
        limit: int = 100, 
        **filters
    ) -> List[Message]:
        """列出消息
        
        支持的过滤条件：
        - conversation_id: 按会话过滤
        """
        query = self.db.query(Message)
        
        # 按会话过滤
        if 'conversation_id' in filters:
            query = query.filter(
                Message.conversation_id == filters['conversation_id']
            )
        
        # 按时间正序
        query = query.order_by(Message.created_at.asc())
        
        return query.offset(skip).limit(limit).all()
    
    def list_by_conversation(
        self,
        conversation_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Message]:
        """获取指定会话的消息列表
        
        Args:
            conversation_id: 会话 ID
            skip: 跳过记录数
            limit: 返回记录数
            
        Returns:
            消息列表（按时间正序）
        """
        return self.list(
            skip=skip,
            limit=limit,
            conversation_id=conversation_id
        )
    
    def create(self, **data) -> Message:
        """创建消息"""
        message = Message(**data)
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message
    
    def update(self, id: str, **data) -> Optional[Message]:
        """更新消息"""
        message = self.get(id)
        if not message:
            return None
        
        for key, value in data.items():
            if hasattr(message, key):
                setattr(message, key, value)
        
        self.db.commit()
        self.db.refresh(message)
        return message
    
    def delete(self, id: str) -> bool:
        """删除消息"""
        message = self.get(id)
        if not message:
            return False
        
        self.db.delete(message)
        self.db.commit()
        return True
    
    def delete_by_conversation(self, conversation_id: str) -> int:
        """删除指定会话的所有消息
        
        Args:
            conversation_id: 会话 ID
            
        Returns:
            删除的消息数量
        """
        deleted_count = self.db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).delete(synchronize_session=False)
        
        self.db.commit()
        return deleted_count
