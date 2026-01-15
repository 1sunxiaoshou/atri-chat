"""会话管理服务"""
from ..storage import AppStorage
from ..logger import get_logger

logger = get_logger(__name__, category="SERVICE")


class ConversationService:
    """会话管理服务
    
    负责会话的验证、消息保存和自动标题生成。
    """
    
    def __init__(self, app_storage: AppStorage):
        self.app_storage = app_storage
    
    def validate_conversation(self, conversation_id: int):
        """验证会话是否存在
        
        Args:
            conversation_id: 会话ID
            
        Returns:
            会话信息字典
            
        Raises:
            ValueError: 会话不存在
        """
        conversation = self.app_storage.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"会话不存在: {conversation_id}")
            raise ValueError(f"会话 {conversation_id} 不存在")
        return conversation
    
    def save_message(self, conversation_id: int, role: str, content: str):
        """保存消息
        
        Args:
            conversation_id: 会话ID
            role: 角色（user/assistant）
            content: 消息内容
        """
        self.app_storage.add_message(conversation_id, role, content)
        logger.debug(f"消息已保存: conversation_id={conversation_id}, role={role}")
    
    def auto_title(self, conversation_id: int, first_message: str):
        """自动生成会话标题
        
        如果会话标题为默认值，则根据第一条消息生成标题。
        
        Args:
            conversation_id: 会话ID
            first_message: 第一条用户消息
        """
        conversation = self.app_storage.get_conversation(conversation_id)
        if conversation and conversation["title"] == "New Chat":
            title = first_message.replace("\n", " ").strip()
            if len(title) > 30:
                title = title[:30] + "..."
            self.app_storage.update_conversation(conversation_id, title=title)
            logger.debug(f"自动标题: {title}")
