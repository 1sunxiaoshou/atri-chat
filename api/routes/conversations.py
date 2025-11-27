"""会话管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import (
    ResponseModel, ConversationRequest, ConversationResponse, ConversationUpdateRequest
)
from core import AppStorage, AgentManager
from core.dependencies import get_storage, get_agent

router = APIRouter()


@router.post("/conversations", response_model=ResponseModel)
async def create_conversation(
    req: ConversationRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建会话"""
    try:
        conversation_id = app_storage.create_conversation(
            character_id=req.character_id,
            title=req.title
        )
        if not conversation_id:
            raise HTTPException(status_code=400, detail="会话创建失败")
        return ResponseModel(
            code=200,
            message="会话创建成功",
            data={"conversation_id": conversation_id}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}", response_model=ResponseModel)
async def get_conversation(
    conversation_id: int,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取会话"""
    try:
        conversation = app_storage.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="会话不存在")
        return ResponseModel(
            code=200,
            message="获取成功",
            data=conversation
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=ResponseModel)
async def list_conversations(
    character_id: int = None,
    app_storage: AppStorage = Depends(get_storage)
):
    """列出会话"""
    try:
        conversations = app_storage.list_conversations(character_id)
        return ResponseModel(
            code=200,
            message="获取成功",
            data=conversations
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/conversations/{conversation_id}", response_model=ResponseModel)
async def update_conversation(
    conversation_id: int,
    req: ConversationUpdateRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """更新会话"""
    try:
        success = app_storage.update_conversation(
            conversation_id=conversation_id,
            title=req.title
        )
        if not success:
            raise HTTPException(status_code=404, detail="会话不存在")
        return ResponseModel(
            code=200,
            message="更新成功",
            data={"conversation_id": conversation_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conversation_id}", response_model=ResponseModel)
async def delete_conversation(
    conversation_id: int,
    app_storage: AppStorage = Depends(get_storage)
):
    """删除会话"""
    try:
        success = app_storage.delete_conversation(conversation_id)
        if not success:
            raise HTTPException(status_code=404, detail="会话不存在")
        return ResponseModel(
            code=200,
            message="删除成功",
            data={"conversation_id": conversation_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/clear", response_model=ResponseModel)
async def clear_conversation_history(
    conversation_id: int,
    agent_manager: AgentManager = Depends(get_agent)
):
    """清空会话历史"""
    try:
        result = agent_manager.clear_conversation_history(
            conversation_id=conversation_id,
            clear_checkpoint=True,
            clear_messages=True
        )
        return ResponseModel(
            code=200,
            message="清空成功",
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
