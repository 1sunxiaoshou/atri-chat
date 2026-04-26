from __future__ import annotations

import importlib
import json
import os
from pathlib import Path
import sys
from typing import Any

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessageChunk

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _load_app_module():
    os.environ.setdefault("LOG_LEVEL", "WARNING")
    os.environ.setdefault("ENABLE_HTTP_LOGGING", "false")
    os.environ.setdefault("ENABLE_LLM_CALL_LOGGER", "false")
    return importlib.import_module("main")


def _parse_sse_events(response) -> list[tuple[str, Any]]:
    events: list[tuple[str, Any]] = []
    current_event = "message"

    for raw_line in response.iter_lines():
        if not raw_line:
            continue

        line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
        if line.startswith("event: "):
            current_event = line[7:]
            continue
        if line.startswith("data: "):
            events.append((current_event, json.loads(line[6:])))

    return events


def _build_request_payload(display_mode: str = "text") -> dict[str, Any]:
    return {
        "input": {
            "messages": [
                {
                    "type": "human",
                    "content": "你好，做一个流式测试。",
                }
            ]
        },
        "context": {
            "conversation_id": "conv-001",
            "character_id": "char-001",
            "model_id": "qwen3.5-flash",
            "provider_config_id": 1,
            "display_mode": display_mode,
        },
    }


class _FakeCoordinator:
    async def stream_runtime_events(self, **_: Any):
        yield {
            "type": "custom",
            "data": {"type": "title_update", "title": "新的标题"},
        }
        yield {
            "type": "messages",
            "data": (
                AIMessageChunk(content="流式输出正常。"),
                {"langgraph_node": "model"},
            ),
        }
        yield {
            "type": "updates",
            "data": {"step": "model", "status": "completed"},
        }
        yield {
            "type": "metadata",
            "data": {"conversation_id": "conv-001", "usage": {"total_tokens": 12}},
        }


class _FailingCoordinator:
    async def stream_runtime_events(self, **_: Any):
        raise ValueError("boom")
        yield


def _override_db():
    yield object()


def test_agent_stream_emits_official_v2_style_events():
    app_module = _load_app_module()

    from core.dependencies import get_agent, get_db

    app_module.app.dependency_overrides[get_agent] = lambda: _FakeCoordinator()
    app_module.app.dependency_overrides[get_db] = _override_db

    try:
        with TestClient(app_module.app) as client:
            response = client.post("/api/v1/agent-stream", json=_build_request_payload())

        assert response.status_code == 200
        events = _parse_sse_events(response)
    finally:
        app_module.app.dependency_overrides.clear()

    assert events[0] == (
        "metadata",
        {"conversation_id": "conv-001", "thread_id": "conv-001"},
    )

    event_names = [name for name, _ in events]
    assert "custom" in event_names
    assert "messages" in event_names
    assert "updates" in event_names
    assert "metadata" in event_names

    message_event = next(payload for name, payload in events if name == "messages")
    assert message_event[0]["type"] == "AIMessageChunk"
    assert message_event[0]["content"] == "流式输出正常。"
    assert "data" not in message_event[0]
    assert isinstance(message_event[0]["id"], str)
    assert message_event[0]["id"]
    assert message_event[1]["langgraph_node"] == "model"

    update_event = next(payload for name, payload in events if name == "updates")
    assert update_event["status"] == "completed"


def test_agent_stream_surfaces_runtime_errors_as_custom_events():
    app_module = _load_app_module()

    from core.dependencies import get_agent, get_db

    app_module.app.dependency_overrides[get_agent] = lambda: _FailingCoordinator()
    app_module.app.dependency_overrides[get_db] = _override_db

    try:
        with TestClient(app_module.app) as client:
            response = client.post("/api/v1/agent-stream", json=_build_request_payload())

        assert response.status_code == 200
        events = _parse_sse_events(response)
    finally:
        app_module.app.dependency_overrides.clear()

    assert events[0][0] == "metadata"
    assert events[-1][0] == "custom"
    assert events[-1][1]["type"] == "error"
    assert "ValueError: boom" in events[-1][1]["message"]


def test_agent_stream_accepts_vrm_mode_custom_events():
    app_module = _load_app_module()

    from core.dependencies import get_agent, get_db

    app_module.app.dependency_overrides[get_agent] = lambda: _FakeCoordinator()
    app_module.app.dependency_overrides[get_db] = _override_db

    with TestClient(app_module.app) as client:
        response = client.post("/api/v1/agent-stream", json=_build_request_payload(display_mode="vrm"))

    try:
        assert response.status_code == 200
        events = _parse_sse_events(response)
    finally:
        app_module.app.dependency_overrides.clear()

    assert events[0] == (
        "metadata",
        {"conversation_id": "conv-001", "thread_id": "conv-001"},
    )
