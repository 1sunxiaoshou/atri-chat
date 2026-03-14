"""会话管理 API (ORM 版本)"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Conversation, Character, Message
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter()


# ==================== Pydantic 模型 ====================

class ConversationCreate(BaseModel):
    """创建会话"""
    character_id: str = Field(..., description="角色 ID")
    title: str = Field("New Chat", description="会话标题")


class ConversationUpdate(BaseModel):
    """更新会话"""
    title: Optional[str] = Field(None, description="会话标题")


# ==================== API 端点 ====================

@router.get("/conversations", summary="获取所有会话", response_model=ResponseModel)
async def list_conversations(
    skip: int = 0,
    limit: int = 100,
    character_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取所有会话
    
    支持分页和按角色过滤
    """
    try:
        from sqlalchemy.orm import joinedload, selectinload
        
        # 使用 joinedload 预加载角色信息，使用 selectinload 预加载消息以计算数量
        query = db.query(Conversation).options(
            joinedload(Conversation.character),
            selectinload(Conversation.messages)
        )
        
        # 按角色过滤
        if character_id:
            query = query.filter(Conversation.character_id == character_id)
        
        # 按更新时间倒序排列
        query = query.order_by(Conversation.updated_at.desc())
        
        # 分页
        conversations = query.offset(skip).limit(limit).all()
        
        # 构建响应
        data = [
            {
                "id": conv.id,
                "character_id": conv.character_id,
                "character_name": conv.character.name,
                "title": conv.title,
                "message_count": len(conv.messages),
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
            }
            for conv in conversations
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except Exception as e:
        logger.error(f"获取会话列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取列表失败")


@router.get("/conversations/{conversation_id}", summary="获取会话详情", response_model=ResponseModel)
async def get_conversation(
    conversation_id: str,
    include_messages: bool = False,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取会话详情"""
    try:
        from sqlalchemy.orm import joinedload, selectinload
        
        # 预加载必要的关系
        query = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).options(
            joinedload(Conversation.character),
            selectinload(Conversation.messages)
        )
        
        conversation = query.first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 构建响应
        data = {
            "id": conversation.id,
            "character_id": conversation.character_id,
            "character_name": conversation.character.name,
            "title": conversation.title,
            "message_count": len(conversation.messages),
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
        }
        
        # 可选：包含消息列表
        if include_messages:
            data["messages"] = [
                {
                    "id": msg.id,
                    "message_type": msg.message_type,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat(),
                }
                for msg in conversation.messages
            ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取详情失败")


@router.post("/conversations", summary="创建会话", response_model=ResponseModel)
async def create_conversation(
    conversation_create: ConversationCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """创建会话"""
    try:
        # 验证角色是否存在
        character = db.query(Character).filter(
            Character.id == conversation_create.character_id
        ).first()
        
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 创建会话
        conversation = Conversation(
            character_id=conversation_create.character_id,
            title=conversation_create.title
        )
        
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": {
                "id": conversation.id,
                "character_id": conversation.character_id,
                "character_name": character.name,
                "title": conversation.title,
                "message_count": 0,
                "created_at": conversation.created_at.isoformat(),
                "updated_at": conversation.updated_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建会话失败: {e}")
        raise HTTPException(status_code=500, detail="创建失败")


@router.put("/conversations/{conversation_id}", summary="更新会话", response_model=ResponseModel)
async def update_conversation(
    conversation_id: str,
    conversation_update: ConversationUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新会话"""
    try:
        # 检查会话是否存在
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 更新字段
        updates = conversation_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        for key, value in updates.items():
            setattr(conversation, key, value)
        
        db.commit()
        db.refresh(conversation)
        
        return {
            "code": 200,
            "message": "会话更新成功",
            "data": {
                "id": conversation.id,
                "character_id": conversation.character_id,
                "title": conversation.title,
                "created_at": conversation.created_at.isoformat(),
                "updated_at": conversation.updated_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新会话失败: {e}")
        raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/conversations/{conversation_id}", summary="删除会话", response_model=ResponseModel)
async def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除会话（级联删除所有消息）"""
    try:
        # 检查会话是否存在
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 删除会话（会级联删除消息）
        db.delete(conversation)
        db.commit()
        
        return {
            "code": 200,
            "message": "会话删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除会话失败: {e}")
        raise HTTPException(status_code=500, detail="删除失败")


@router.get("/conversations/{conversation_id}/messages", summary="获取会话消息", response_model=ResponseModel)
async def get_conversation_messages(
    conversation_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取会话的所有消息"""
    try:
        from sqlalchemy.orm import selectinload
        # 检查会话是否存在并预加载消息
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).options(selectinload(Conversation.messages)).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 获取消息（按时间正序）
        messages = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.created_at.asc()).offset(skip).limit(limit).all()
        
        # 构建响应
        data = {
            "conversation_id": conversation_id,
            "total_messages": len(conversation.messages),
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
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话消息失败: {e}")
        raise HTTPException(status_code=500, detail="获取消息失败")


@router.delete("/conversations/{conversation_id}/messages", summary="清空会话消息", response_model=ResponseModel)
async def clear_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """清空会话的所有消息"""
    try:
        # 检查会话是否存在
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 删除所有消息
        deleted_count = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "code": 200,
            "message": "消息清空成功",
            "data": {
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"清空会话消息失败: {e}")
        raise HTTPException(status_code=500, detail="清空失败")
