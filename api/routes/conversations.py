"""会话管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import (
    ResponseModel, ConversationRequest, ConversationResponse, ConversationUpdateRequest
)
from core import AppStorage, AgentCoordinator
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
            
        # 获取完整会话信息
        conversation = app_storage.get_conversation(conversation_id)
        
        return ResponseModel(
            code=200,
            message="会话创建成功",
            data=conversation
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


@router.get("/conversations/{conversation_id}/messages", response_model=ResponseModel)
async def get_conversation_history(
    conversation_id: int,
    from_checkpoint: bool = False,
    agent_manager: AgentCoordinator = Depends(get_agent),
    app_storage: AppStorage = Depends(get_storage)
):
    """获取会话历史"""
    from core.logger import get_logger
    logger = get_logger(__name__, category="API")
    
    try:
        if from_checkpoint:
            config = {"configurable": {"thread_id": str(conversation_id)}}
            checkpoint_tuple = agent_manager.checkpointer.get_tuple(config)
            
            if checkpoint_tuple:
                messages = checkpoint_tuple.checkpoint['channel_values']['messages']
                messages = [{"type": msg.type, "content": msg.content} for msg in messages]
            else:
                messages = []
        else:
            messages = app_storage.list_messages(conversation_id)
            
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "conversation_id": conversation_id,
                "messages": messages
            }
        )
    except Exception as e:
        logger.error(f"获取会话历史失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/clear", response_model=ResponseModel)
async def clear_conversation_history(
    conversation_id: int,
    clear_checkpoint: bool = True,
    clear_messages: bool = True,
    agent_manager: AgentCoordinator = Depends(get_agent),
    app_storage: AppStorage = Depends(get_storage)
):
    """清空会话历史"""
    from core.logger import get_logger
    logger = get_logger(__name__, category="API")
    
    try:
        result = {"checkpoint_cleared": 0, "messages_deleted": 0}
        
        if clear_checkpoint:
            agent_manager.checkpointer.delete_thread(thread_id=str(conversation_id))
            result["checkpoint_cleared"] = 1
        
        if clear_messages:
            count = app_storage.delete_messages_by_conversation(conversation_id)
            result["messages_deleted"] = count
            
        return ResponseModel(
            code=200,
            message="清空成功",
            data=result
        )
    except Exception as e:
        logger.error(f"清空会话历史失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
