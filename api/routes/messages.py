"""消息管理路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.responses import StreamingResponse
from api.schemas import (
    ResponseModel, MessageRequest, MessageResponse, ConversationHistoryResponse,
    TextToSpeechRequest, CacheInfoResponse, ClearCacheRequest
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
            # 流式生成内容
            async for json_str in agent_manager.send_message_stream(
                user_message=req.content,
                conversation_id=req.conversation_id,
                character_id=req.character_id,
                model_id=req.model_id,
                provider_id=req.provider_id
            ):
                if json_str: 
                    # 直接转发 JSON 字符串，不需要再次包装
                    yield f"data: {json_str}\n\n"
            
            # 发送结束标记
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        except ValueError as e:
            # 配置错误（会话、角色、模型不存在或未启用）
            error_data = {
                "error": str(e),
                "error_type": "config_error",
                "message": "配置错误，请检查会话、角色或模型设置"
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        except RuntimeError as e:
            # 模型调用错误（API Key、网络、超时等）
            error_data = {
                "error": str(e),
                "error_type": "model_error",
                "message": "模型调用失败"
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        except Exception as e:
            # 其他未知错误
            error_data = {
                "error": str(e),
                "error_type": "unknown_error",
                "message": "服务器内部错误"
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
            "Content-Type": "text/event-stream; charset=utf-8",
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

@router.get("/cache/info", response_model=ResponseModel)
async def get_cache_info(agent_manager: AgentManager = Depends(get_agent)):
    """获取缓存信息"""
    try:
        cache_info = agent_manager.get_cache_info()
        return ResponseModel(
            code=200,
            message="获取成功",
            data=cache_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache/clear", response_model=ResponseModel)
async def clear_cache(
    req: ClearCacheRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    """清空Agent缓存"""
    try:
        count = agent_manager.clear_agent_cache(req.character_id)
        return ResponseModel(
            code=200,
            message="清空成功",
            data={"cleared_count": count}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
