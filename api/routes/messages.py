"""消息管理路由"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from api.schemas import ResponseModel, MessageRequest
from core import AgentCoordinator
from core.dependencies import get_agent

router = APIRouter()


@router.post("/messages")
async def send_message(
    req: MessageRequest,
    agent_manager: AgentCoordinator = Depends(get_agent)
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
            if req.enable_thinking is not None:
                model_kwargs["enable_thinking"] = req.enable_thinking
            if req.thinking_config is not None:
                model_kwargs["thinking_config"] = req.thinking_config
            
            from core.logger import get_logger
            logger = get_logger(__name__, category="API")
            logger.info(
                "接收到消息请求",
                extra={
                    "conversation_id": req.conversation_id,
                    "character_id": req.character_id,
                    "display_mode": req.display_mode,
                    "model_params": model_kwargs,
                    "content_length": len(req.content)
                }
            )
            
            # 统一调用 send_message，通过 output_mode 区分模式
            output_mode = "vrm" if req.display_mode == "vrm" else "text"
            
            async for json_str in agent_manager.send_message(
                user_message=req.content,
                conversation_id=req.conversation_id,
                character_id=req.character_id,
                model_id=req.model_id,
                provider_id=req.provider_id,
                output_mode=output_mode,
                **model_kwargs
            ):
                if json_str:
                    yield f"data: {json_str}\n\n"
            
        except (ValueError, RuntimeError, Exception) as e:
            error_type = {
                ValueError: "config_error",
                RuntimeError: "model_error"
            }.get(type(e), "unknown_error")
            yield f"data: {json.dumps({'error': str(e), 'error_type': error_type}, ensure_ascii=False)}\n\n"
        
        finally:
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
