"""会话管理服务 (ORM 版本)"""
from sqlalchemy.orm import Session
from ..db import Conversation, Message
from ..logger import get_logger

logger = get_logger(__name__)


class ConversationService:
    """会话管理服务
    
    负责会话的验证、消息保存和自动标题生成。
    使用 SQLAlchemy ORM 进行数据库操作。
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def validate_conversation(self, conversation_id: str):
        """验证会话是否存在
        
        Args:
            conversation_id: 会话ID (UUID)
            
        Returns:
            Conversation ORM 对象
            
        Raises:
            ValueError: 会话不存在
        """
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            logger.error(f"会话不存在: {conversation_id}")
            raise ValueError(f"会话 {conversation_id} 不存在")
        
        return conversation
    
    def save_message(self, conversation_id: str, role: str, content: str):
        """保存消息
        
        Args:
            conversation_id: 会话ID (UUID)
            role: 角色（user/assistant/system）
            content: 消息内容
        """
        try:
            message = Message(
                conversation_id=conversation_id,
                message_type=role,
                content=content
            )
            self.db.add(message)
            self.db.commit()
            logger.debug(f"消息已保存: conversation_id={conversation_id}, role={role}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"保存消息失败: {e}", exc_info=True)
            raise
    
    def auto_title(self, conversation_id: str, first_message: str):
        """自动生成会话标题
        
        如果会话标题为默认值，则根据第一条消息生成标题。
        
        Args:
            conversation_id: 会话ID (UUID)
            first_message: 第一条用户消息
        """
        try:
            conversation = self.db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            
            if conversation and conversation.title == "New Chat":
                title = first_message.replace("\n", " ").strip()
                if len(title) > 30:
                    title = title[:30] + "..."
                conversation.title = title
                self.db.commit()
                logger.debug(f"自动标题: {title}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"自动生成标题失败: {e}", exc_info=True)
