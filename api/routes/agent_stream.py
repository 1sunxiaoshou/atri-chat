"""useStream 自定义 transport 兼容流式路由。"""

from __future__ import annotations

import json
from itertools import count
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from langchain_core.messages import BaseMessage, message_to_dict
from sqlalchemy.orm import Session

from api.schemas import AgentStreamRequest
from core.dependencies import get_agent, get_db
from core.logger import get_logger

if TYPE_CHECKING:
    from core.agent.coordinator import AgentCoordinator


logger = get_logger(__name__)
router = APIRouter()


def _to_sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(jsonable_encoder(data), ensure_ascii=False)}\n\n"


def _flatten_langchain_message(message: BaseMessage) -> dict[str, Any]:
    """转换为 @langchain/react useStream 兼容的扁平消息结构。"""
    serialized = message_to_dict(message)
    if not isinstance(serialized, dict):
        return jsonable_encoder(serialized)

    message_type = serialized.get("type")
    message_data = serialized.get("data")

    if isinstance(message_data, dict):
        flattened = {"type": message_type, **message_data}
        if "id" in serialized and "id" not in flattened:
            flattened["id"] = serialized["id"]
        return flattened

    return jsonable_encoder(serialized)


def _serialize_stream_payload(
    mode: str,
    payload: Any,
    *,
    fallback_message_id: str | None = None,
) -> Any:
    if mode == "messages":
        token, metadata = payload
        if isinstance(token, BaseMessage):
            serialized_message = _flatten_langchain_message(token)
            if fallback_message_id and isinstance(serialized_message, dict):
                if not serialized_message.get("id"):
                    serialized_message["id"] = fallback_message_id
            return [serialized_message, jsonable_encoder(metadata)]
        return [jsonable_encoder(token), jsonable_encoder(metadata)]

    return jsonable_encoder(payload)


def _extract_user_message(payload: AgentStreamRequest) -> str:
    messages = (payload.input or {}).get("messages")
    if not isinstance(messages, list) or not messages:
        raise HTTPException(status_code=400, detail="agent_stream 需要 input.messages")

    latest = messages[-1]
    if not isinstance(latest, dict):
        raise HTTPException(status_code=400, detail="input.messages[-1] 格式无效")

    content = latest.get("content")
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    text_parts.append(text)
        if text_parts:
            return "".join(text_parts)

    raise HTTPException(status_code=400, detail="当前仅支持文本消息输入")


@router.post("/agent-stream")
async def agent_stream(
    req: AgentStreamRequest,
    agent_manager: AgentCoordinator = Depends(get_agent),
    db: Session = Depends(get_db),
):
    """官方 useStream 的自定义 transport 入口。"""
    user_message = _extract_user_message(req)
    thread_id = ((req.config or {}).get("configurable") or {}).get(
        "thread_id"
    ) or req.context.conversation_id

    runtime_config = {
        **(req.config or {}),
        "configurable": {
            **((req.config or {}).get("configurable") or {}),
            "thread_id": str(thread_id),
        },
    }

    async def generate():
        fallback_message_ids: dict[str, str] = {}
        message_counter = count(1)

        def get_fallback_message_id(
            mode: str, payload: Any, namespace: Any
        ) -> str | None:
            if (
                mode != "messages"
                or not isinstance(payload, tuple)
                or len(payload) != 2
            ):
                return None

            token, metadata = payload
            if not isinstance(token, BaseMessage):
                return None

            namespace_key = (
                "|".join(str(item) for item in namespace)
                if isinstance(namespace, (list, tuple))
                else "root"
            )
            message_type = getattr(token, "type", None) or token.__class__.__name__
            tool_call_id = getattr(token, "tool_call_id", None)
            metadata_node = (
                metadata.get("langgraph_node") if isinstance(metadata, dict) else None
            )

            key_parts = [
                namespace_key,
                str(metadata_node or "default"),
                str(tool_call_id or message_type),
            ]
            key = "::".join(key_parts)

            if key not in fallback_message_ids:
                fallback_message_ids[key] = (
                    f"{req.context.conversation_id}:{next(message_counter)}:{uuid4().hex[:8]}"
                )

            return fallback_message_ids[key]

        yield _to_sse(
            "metadata",
            {
                "conversation_id": req.context.conversation_id,
                "thread_id": str(thread_id),
            },
        )

        try:
            async for part in agent_manager.stream_runtime_events(
                user_message=user_message,
                conversation_id=req.context.conversation_id,
                character_id=req.context.character_id,
                model_id=req.context.model_id,
                provider_config_id=req.context.provider_config_id,
                db_session=db,
                output_mode=req.context.display_mode,
                config=runtime_config,
                temperature=req.context.temperature,
                max_tokens=req.context.max_tokens,
                top_p=req.context.top_p,
                enable_thinking=req.context.enable_thinking,
                thinking_config=req.context.thinking_config,
            ):
                mode = part.get("type", "custom")
                payload = part.get("data")
                namespace = part.get("ns")
                event_name = (
                    f"{mode}|{'|'.join(namespace)}"
                    if isinstance(namespace, (list, tuple)) and namespace
                    else mode
                )
                yield _to_sse(
                    event_name,
                    _serialize_stream_payload(
                        mode,
                        payload,
                        fallback_message_id=get_fallback_message_id(
                            mode, payload, namespace
                        ),
                    ),
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"agent_stream 流式输出失败: {e}")
            yield _to_sse(
                "custom",
                {
                    "type": "error",
                    "message": f"{type(e).__name__}: {e}",
                },
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
