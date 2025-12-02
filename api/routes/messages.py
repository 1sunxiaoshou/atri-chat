"""消息管理路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.responses import StreamingResponse
from api.schemas import (
    ResponseModel, MessageRequest, MessageResponse, ConversationHistoryResponse,
    TextToSpeechRequest
)
from core import AppStorage, AgentManager
from core.dependencies import get_storage, get_agent
import io

router = APIRouter()


@router.post("/messages")
async def send_message(
    req: MessageRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    """发送文本消息（流式响应）"""
    async def generate():
        import json
        try:
            # 构建模型动态参数
            model_kwargs = {}
            if req.temperature is not None:
                model_kwargs["temperature"] = req.temperature
            if req.max_tokens is not None:
                model_kwargs["max_tokens"] = req.max_tokens
            if req.top_p is not None:
                model_kwargs["top_p"] = req.top_p
            if req.reasoning_effort is not None:
                model_kwargs["reasoning_effort"] = req.reasoning_effort
            
            # 记录模型参数
            from core.logger import get_logger
            logger = get_logger(__name__, category="API")
            if model_kwargs:
                logger.info(
                    "使用自定义模型参数",
                    extra={
                        "conversation_id": req.conversation_id,
                        "model_params": model_kwargs
                    }
                )
            
            # 流式生成内容
            async for json_str in agent_manager.send_message_stream(
                user_message=req.content,
                conversation_id=req.conversation_id,
                character_id=req.character_id,
                model_id=req.model_id,
                provider_id=req.provider_id,
                **model_kwargs
            ):
                if json_str: 
                    # 直接转发 JSON 字符串，不需要再次包装
                    yield f"data: {json_str}\n\n"
            
        except (ValueError, RuntimeError, Exception) as e:
            # 统一错误处理
            error_type = {
                ValueError: "config_error",
                RuntimeError: "model_error"
            }.get(type(e), "unknown_error")
            
            yield f"data: {json.dumps({'error': str(e), 'error_type': error_type}, ensure_ascii=False)}\n\n"
        
        finally:
            # 始终发送结束标记
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/conversations/{conversation_id}/messages", response_model=ResponseModel)
async def get_conversation_history(
    conversation_id: int,
    from_checkpoint: bool = False,
    agent_manager: AgentManager = Depends(get_agent)
):
    """获取会话历史"""
    try:
        messages = agent_manager.get_conversation_history(
            conversation_id=conversation_id,
            from_checkpoint=from_checkpoint
        )
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "conversation_id": conversation_id,
                "messages": messages
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


