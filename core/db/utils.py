"""数据库工具函数"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from core.logger import get_logger
from .models import (
    Avatar, Motion, TTSProvider, VoiceAsset, ProviderConfig, Model,
    Character, CharacterMotionBinding, Conversation, Message
)

logger = get_logger(__name__)


class DatabaseError(Exception):
    """数据库操作错误基类"""
    pass


class ResourceInUseError(DatabaseError):
    """资源被引用错误"""
    def __init__(self, resource_type: str, resource_id: Any, referenced_by: list):
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.referenced_by = referenced_by
        super().__init__(
            f"Cannot delete {resource_type} {resource_id}: "
            f"referenced by {len(referenced_by)} resource(s)"
        )


class InvalidReferenceError(DatabaseError):
    """无效引用错误"""
    def __init__(self, field: str, value: Any, resource_type: str):
        self.field = field
        self.value = value
        self.resource_type = resource_type
        super().__init__(
            f"Invalid reference: {field}={value} does not exist in {resource_type}"
        )


# ==================== 引用检查 ====================

def check_avatar_references(db: Session, avatar_id: str) -> List[Dict[str, Any]]:
    """检查形象是否被角色引用
    
    Args:
        db: 数据库会话
        avatar_id: 形象 ID
        
    Returns:
        引用该形象的角色列表
    """
    characters = db.query(Character).filter(Character.avatar_id == avatar_id).all()
    return [
        {
            "type": "character",
            "id": char.id,
            "name": char.name
        }
        for char in characters
    ]


def check_voice_asset_references(db: Session, voice_asset_id: int) -> List[Dict[str, Any]]:
    """检查音色资产是否被角色引用
    
    Args:
        db: 数据库会话
        voice_asset_id: 音色资产 ID
        
    Returns:
        引用该音色资产的角色列表
    """
    characters = db.query(Character).filter(Character.voice_asset_id == voice_asset_id).all()
    return [
        {
            "type": "character",
            "id": char.id,
            "name": char.name
        }
        for char in characters
    ]


def check_motion_references(db: Session, motion_id: str) -> List[Dict[str, Any]]:
    """检查动作是否被角色绑定
    
    Args:
        db: 数据库会话
        motion_id: 动作 ID
        
    Returns:
        绑定该动作的角色列表
    """
    bindings = db.query(CharacterMotionBinding).filter(
        CharacterMotionBinding.motion_id == motion_id
    ).all()
    
    # 去重并获取角色信息
    character_ids = set(binding.character_id for binding in bindings)
    characters = db.query(Character).filter(Character.id.in_(character_ids)).all()
    
    return [
        {
            "type": "character",
            "id": char.id,
            "name": char.name
        }
        for char in characters
    ]


def check_model_references(db: Session, model_id: int) -> List[Dict[str, Any]]:
    """检查模型是否被角色引用
    
    Args:
        db: 数据库会话
        model_id: 模型 UUID（主键 id）
        
    Returns:
        引用该模型的角色列表
    """
    characters = db.query(Character).filter(Character.primary_model_id == model_id).all()
    return [
        {
            "type": "character",
            "id": char.id,
            "name": char.name
        }
        for char in characters
    ]


# ==================== 存在性验证 ====================

def validate_avatar_exists(db: Session, avatar_id: str) -> bool:
    """验证形象是否存在
    
    Args:
        db: 数据库会话
        avatar_id: 形象 ID
        
    Returns:
        是否存在
        
    Raises:
        InvalidReferenceError: 如果不存在
    """
    avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
    if not avatar:
        raise InvalidReferenceError("avatar_id", avatar_id, "avatar")
    return True


def validate_voice_asset_exists(db: Session, voice_asset_id: int) -> bool:
    """验证音色资产是否存在
    
    Args:
        db: 数据库会话
        voice_asset_id: 音色资产 ID
        
    Returns:
        是否存在
        
    Raises:
        InvalidReferenceError: 如果不存在
    """
    voice_asset = db.query(VoiceAsset).filter(VoiceAsset.id == voice_asset_id).first()
    if not voice_asset:
        raise InvalidReferenceError("voice_asset_id", voice_asset_id, "voice_asset")
    return True


def validate_motion_exists(db: Session, motion_id: str) -> bool:
    """验证动作是否存在
    
    Args:
        db: 数据库会话
        motion_id: 动作 ID
        
    Returns:
        是否存在
        
    Raises:
        InvalidReferenceError: 如果不存在
    """
    motion = db.query(Motion).filter(Motion.id == motion_id).first()
    if not motion:
        raise InvalidReferenceError("motion_id", motion_id, "motion")
    return True


def validate_model_exists(db: Session, model_id: int) -> bool:
    """验证模型是否存在
    
    Args:
        db: 数据库会话
        model_id: 模型 UUID（主键 id）
        
    Returns:
        是否存在
        
    Raises:
        InvalidReferenceError: 如果不存在
    """
    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        raise InvalidReferenceError("model_id", model_id, "model")
    return True


# ==================== 安全删除 ====================

def safe_delete_avatar(db: Session, avatar_id: str) -> bool:
    """安全删除形象（检查引用）
    
    Args:
        db: 数据库会话
        avatar_id: 形象 ID
        
    Returns:
        是否成功删除
        
    Raises:
        ResourceInUseError: 如果被引用
    """
    # 检查引用
    references = check_avatar_references(db, avatar_id)
    if references:
        raise ResourceInUseError("avatar", avatar_id, references)
    
    # 删除
    avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
    if avatar:
        db.delete(avatar)
        db.commit()
        return True
    return False


def safe_delete_voice_asset(db: Session, voice_asset_id: int) -> bool:
    """安全删除音色资产（检查引用）
    
    Args:
        db: 数据库会话
        voice_asset_id: 音色资产 ID
        
    Returns:
        是否成功删除
        
    Raises:
        ResourceInUseError: 如果被引用
    """
    # 检查引用
    references = check_voice_asset_references(db, voice_asset_id)
    if references:
        raise ResourceInUseError("voice_asset", voice_asset_id, references)
    
    # 删除
    voice_asset = db.query(VoiceAsset).filter(VoiceAsset.id == voice_asset_id).first()
    if voice_asset:
        db.delete(voice_asset)
        db.commit()
        return True
    return False


def safe_delete_motion(db: Session, motion_id: str) -> bool:
    """安全删除动作（检查引用）
    
    Args:
        db: 数据库会话
        motion_id: 动作 ID
        
    Returns:
        是否成功删除
        
    Raises:
        ResourceInUseError: 如果被引用
    """
    # 检查引用
    references = check_motion_references(db, motion_id)
    if references:
        raise ResourceInUseError("motion", motion_id, references)
    
    # 删除
    motion = db.query(Motion).filter(Motion.id == motion_id).first()
    if motion:
        db.delete(motion)
        db.commit()
        return True
    return False


def safe_delete_model(db: Session, model_id: int) -> bool:
    """安全删除模型（检查引用）
    
    Args:
        db: 数据库会话
        model_id: 模型 ID
        
    Returns:
        是否成功删除
        
    Raises:
        ResourceInUseError: 如果被引用
    """
    # 检查引用
    references = check_model_references(db, model_id)
    if references:
        raise ResourceInUseError("model", model_id, references)
    
    # 删除
    model = db.query(Model).filter(Model.id == model_id).first()
    if model:
        db.delete(model)
        db.commit()
        return True
    return False


# ==================== 复杂查询 ====================

def get_character_with_assets(db: Session, character_id: str) -> Optional[Dict[str, Any]]:
    """获取角色及其关联的资产信息
    
    Args:
        db: 数据库会话
        character_id: 角色 ID
        
    Returns:
        包含完整资产信息的角色字典，如果不存在则返回 None
    """
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        return None
    
    return {
        "id": character.id,
        "name": character.name,
        "system_prompt": character.system_prompt,
        "voice_speaker_id": character.voice_speaker_id,
        "primary_provider_id": character.primary_provider_id,
        "enabled": character.enabled,
        "created_at": character.created_at.isoformat(),
        "updated_at": character.updated_at.isoformat(),
        "avatar": {
            "id": character.avatar.id,
            "name": character.avatar.name,
            "file_url": character.avatar.file_url,  # 使用属性（动态生成）
            "thumbnail_url": character.avatar.thumbnail_url,  # 使用属性（动态生成）
        },
        "voice_asset": {
            "id": character.voice_asset.id,
            "name": character.voice_asset.name,
            "provider_id": character.voice_asset.provider_id,
            "voice_config": character.voice_asset.voice_config,
        },
        "primary_model": {
            "id": character.primary_model.id,
            "model_id": character.primary_model.model_id,
            "provider_id": character.primary_model.provider_id,
        } if character.primary_model else None,
        "motion_bindings": [
            {
                "id": binding.id,
                "category": binding.category,
                "motion": {
                    "id": binding.motion.id,
                    "name": binding.motion.name,
                    "file_url": binding.motion.file_url,  # 使用属性（动态生成）
                    "duration_ms": binding.motion.duration_ms,
                }
            }
            for binding in character.motion_bindings
        ]
    }


def get_conversation_with_messages(
    db: Session, 
    conversation_id: str,
    limit: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """获取会话及其消息
    
    Args:
        db: 数据库会话
        conversation_id: 会话 ID
        limit: 消息数量限制
        
    Returns:
        包含消息的会话字典，如果不存在则返回 None
    """
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return None
    
    messages = conversation.messages
    if limit:
        messages = messages[-limit:]
    
    return {
        "id": conversation.id,
        "character_id": conversation.character_id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "messages": [
            {
                "id": msg.id,
                "message_type": msg.message_type,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in messages
        ]
    }
