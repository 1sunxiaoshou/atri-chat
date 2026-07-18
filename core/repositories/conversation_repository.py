"""会话 Repository"""

from core.db import Conversation

from .base import BaseRepository


class ConversationRepository(BaseRepository[Conversation]):
    """会话仓储

    负责会话的数据访问操作。
    """

    def get(self, id: str) -> Conversation | None:
        """根据 ID 获取会话"""
        return self.db.query(Conversation).filter(Conversation.id == id).first()

    def get_with_messages(self, id: str) -> Conversation | None:
        """获取会话及其消息列表"""
        # SQLAlchemy 会自动加载 messages 关系
        return self.get(id)

    def list(self, skip: int = 0, limit: int = 100, **filters) -> list[Conversation]:
        """列出会话

        支持的过滤条件：
        - character_id: 按角色过滤
        """
        query = self.db.query(Conversation)

        # 按角色过滤
        if "character_id" in filters:
            query = query.filter(Conversation.character_id == filters["character_id"])

        # 按更新时间倒序
        query = query.order_by(Conversation.updated_at.desc())

        return query.offset(skip).limit(limit).all()

    def create(self, **data) -> Conversation:
        """创建会话"""
        conversation = Conversation(**data)
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def update(self, id: str, **data) -> Conversation | None:
        """更新会话"""
        conversation = self.get(id)
        if not conversation:
            return None

        for key, value in data.items():
            if hasattr(conversation, key):
                setattr(conversation, key, value)

        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def delete(self, id: str) -> bool:
        """删除会话（级联删除消息）"""
        conversation = self.get(id)
        if not conversation:
            return False

        self.db.delete(conversation)
        self.db.commit()
        return True
