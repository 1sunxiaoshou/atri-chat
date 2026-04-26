"""ATRI Chat agent_stream 端到端流式实测工具。

默认复用本地数据库中已有的 qwen 供应商 / 模型 / 角色配置。
如果本地没有 qwen 供应商配置，可通过环境变量 `QWEN_API_KEY`
创建最小测试配置。脚本不会打印或持久化密钥。

为了避免手工实测时控制台刷出大量启动日志，默认会在导入
FastAPI 应用前注入更安静的日志环境变量；如需查看完整日志，可
通过 `--verbose` 关闭该行为。
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
from pathlib import Path
import sys
from typing import Any

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _unwrap(response) -> Any:
    payload = response.json()
    if response.status_code != 200:
        raise RuntimeError(f"HTTP {response.status_code}: {payload}")
    return payload["data"]


def _safe_console_text(text: str) -> str:
    encoding = sys.stdout.encoding if sys.stdout is not None else None
    if not encoding:
        return text
    return text.encode(encoding, errors="replace").decode(encoding)


def _prepare_quiet_env(verbose: bool) -> None:
    if verbose:
        return

    os.environ.setdefault("LOG_LEVEL", "WARNING")
    os.environ.setdefault("ENABLE_HTTP_LOGGING", "false")
    os.environ.setdefault("ENABLE_LLM_CALL_LOGGER", "false")


def _load_app_module(verbose: bool):
    _prepare_quiet_env(verbose)
    return importlib.import_module("main")


def _find_provider(client: TestClient, provider_type: str) -> dict[str, Any] | None:
    providers = _unwrap(client.get("/api/v1/providers"))
    for provider in providers:
        if provider["provider_type"] == provider_type:
            return provider
    return None


def _ensure_qwen_provider(client: TestClient, api_key: str | None) -> int:
    provider = _find_provider(client, "qwen")
    if provider:
        return int(provider["id"])

    if not api_key:
        raise RuntimeError(
            "本地没有 qwen 供应商配置，请先设置环境变量 QWEN_API_KEY 再运行测试。"
        )

    response = client.post(
        "/api/v1/providers",
        json={
            "name": "Qwen (E2E)",
            "provider_type": "qwen",
            "config_payload": {
                "api_key": api_key,
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            },
        },
    )
    data = _unwrap(response)
    return int(data["id"])


def _ensure_model(
    client: TestClient,
    provider_config_id: int,
    model_id: str,
) -> int:
    models = _unwrap(client.get(f"/api/v1/models?provider_config_id={provider_config_id}"))
    for model in models:
        if model["model_id"] == model_id:
            return int(model["id"])

    response = client.post(
        "/api/v1/models",
        json={
            "provider_config_id": provider_config_id,
            "model_id": model_id,
            "model_type": "chat",
            "has_vision": False,
            "has_audio": False,
            "has_video": False,
            "has_reasoning": True,
            "has_tool_use": True,
            "has_document": False,
            "has_structured_output": False,
            "enabled": True,
            "parameters": {},
        },
    )
    data = _unwrap(response)
    return int(data["id"])


def _pick_character(client: TestClient, character_id: str | None) -> dict[str, Any]:
    characters = _unwrap(client.get("/api/v1/characters?enabled=true"))
    if not characters:
        raise RuntimeError("没有可用的启用角色，无法执行端到端测试。")

    if character_id:
        for character in characters:
            if character["id"] == character_id:
                return character
        raise RuntimeError(f"未找到指定角色: {character_id}")

    return characters[0]


def _create_conversation(client: TestClient, character_id: str) -> dict[str, Any]:
    return _unwrap(
        client.post(
            "/api/v1/conversations",
            json={"character_id": character_id, "title": "agent-stream e2e"},
        )
    )


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
            payload = json.loads(line[6:])
            events.append((current_event, payload))

    return events


def run_e2e(
    prompt: str,
    model_id: str,
    character_id: str | None,
    *,
    verbose: bool = False,
) -> int:
    api_key = os.environ.get("QWEN_API_KEY")
    app_module = _load_app_module(verbose)

    with TestClient(app_module.app) as client:
        provider_config_id = _ensure_qwen_provider(client, api_key)
        _ensure_model(client, provider_config_id, model_id)
        character = _pick_character(client, character_id)
        conversation = _create_conversation(client, character["id"])

        print(_safe_console_text("E2E target"))
        print(_safe_console_text(f"  provider_config_id: {provider_config_id}"))
        print(_safe_console_text(f"  model_id: {model_id}"))
        print(_safe_console_text(f"  character_id: {character['id']}"))
        print(_safe_console_text(f"  conversation_id: {conversation['id']}"))

        response = client.post(
            "/api/v1/agent-stream",
            json={
                "input": {
                    "messages": [
                        {
                            "type": "human",
                            "content": prompt,
                        }
                    ]
                },
                "context": {
                    "conversation_id": conversation["id"],
                    "character_id": character["id"],
                    "model_id": model_id,
                    "provider_config_id": provider_config_id,
                    "display_mode": "text",
                },
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"agent_stream HTTP {response.status_code}: {response.text}")

        events = _parse_sse_events(response)
        if not events:
            raise RuntimeError("未收到任何 SSE 事件。")

        event_names = [name for name, _ in events]
        text_chunks = 0
        saw_error = None

        for event_name, payload in events:
            if event_name.startswith("messages"):
                text_chunks += 1
            if event_name == "custom" and payload.get("type") == "error":
                saw_error = payload.get("message")

        print(_safe_console_text("Event summary"))
        print(_safe_console_text(f"  total_events: {len(events)}"))
        print(_safe_console_text(f"  event_types: {sorted(set(event_names))}"))
        print(_safe_console_text(f"  message_chunks: {text_chunks}"))

        if saw_error:
            print(_safe_console_text(f"  custom_error: {saw_error}"))
            return 1

        assistant_text = ""
        for event_name, payload in events:
            if not event_name.startswith("messages"):
                continue
            data = payload
            if (
                isinstance(data, list)
                and len(data) == 2
                and isinstance(data[0], dict)
                and data[0].get("type") == "AIMessageChunk"
            ):
                content = data[0].get("data", {}).get("content")
                if isinstance(content, str):
                    assistant_text += content
                elif isinstance(content, list):
                    assistant_text += "".join(
                        item.get("text", "")
                        for item in content
                        if isinstance(item, dict)
                    )

        print(_safe_console_text("Assistant preview"))
        preview = assistant_text.strip().replace("\n", " ")
        print(_safe_console_text(f"  {preview[:200] or '[empty]'}"))
        return 0


def main_cli() -> int:
    parser = argparse.ArgumentParser(description="Run a real agent_stream E2E test.")
    parser.add_argument(
        "--prompt",
        default="请用两三句话介绍你自己，并简单回应“流式测试正常”。",
        help="发送给模型的测试提示词",
    )
    parser.add_argument(
        "--model-id",
        default="qwen3.5-flash",
        help="用于测试的模型 ID",
    )
    parser.add_argument(
        "--character-id",
        default=None,
        help="可选：指定角色 ID",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="显示应用启动与请求日志",
    )
    args = parser.parse_args()

    return run_e2e(
        prompt=args.prompt,
        model_id=args.model_id,
        character_id=args.character_id,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    sys.exit(main_cli())
