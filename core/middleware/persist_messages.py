"""Persist final agent messages into the application message table."""

from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentState, after_agent
from langchain_core.messages import AIMessage, ToolMessage, message_to_dict
from langgraph.runtime import Runtime

from ..logger import get_logger
from ..services import ConversationService
from ..utils.message_utils import extract_text_from_content

logger = get_logger(__name__)


def _safe_message_dict(message: Any) -> dict[str, Any] | None:
    try:
        serialized = message_to_dict(message)
    except Exception as e:
        logger.debug(f"序列化 LangChain 消息失败: {e}")
        return None
    return serialized if isinstance(serialized, dict) else {"value": serialized}


@after_agent
async def persist_agent_messages(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """Persist assistant/tool messages produced by the current agent invocation."""
    context = runtime.context
    conversation_id = getattr(context, "conversation_id", None)
    turn_id = getattr(context, "turn_id", None)
    db_session = getattr(context, "db_session", None)
    pre_run_message_ids = getattr(context, "pre_run_message_ids", set()) or set()

    if not conversation_id or db_session is None:
        return None

    service = ConversationService(db_session)
    for message in state.get("messages", []):
        lc_message_id = getattr(message, "id", None)
        if lc_message_id and str(lc_message_id) in pre_run_message_ids:
            continue

        if isinstance(message, AIMessage):
            role = "assistant"
            tool_call_id = None
            tool_name = None
            has_tool_calls = bool(getattr(message, "tool_calls", None))
        elif isinstance(message, ToolMessage):
            role = "tool"
            tool_call_id = getattr(message, "tool_call_id", None)
            tool_name = getattr(message, "name", None)
            has_tool_calls = False
        else:
            continue

        content = extract_text_from_content(message.content)
        if not content and not has_tool_calls:
            continue

        try:
            service.save_message(
                conversation_id=conversation_id,
                role=role,
                content=content,
                turn_id=turn_id,
                lc_message_id=str(lc_message_id) if lc_message_id else None,
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                raw_json=_safe_message_dict(message),
            )
        except Exception as e:
            logger.error(f"持久化 agent 消息失败: {e}")

    return None
