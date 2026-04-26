"""命令系统工具。"""

from __future__ import annotations

from typing import Literal

from langchain.tools import ToolRuntime, tool
from pydantic import BaseModel, Field

from core.agent.context import AgentContext
from core.logger import get_logger
from core.tts.synthesis import synthesize_character_speech_file

logger = get_logger(__name__)


class PerformActionsInput(BaseModel):
    commands: list[str] = Field(
        ...,
        description=(
            "按顺序执行的命令列表，例如 ['emotion happy', 'say happy | 你好呀']"
        ),
        min_length=1,
    )


class ControlCameraInput(BaseModel):
    action: Literal["cut", "transition"] = Field(..., description="镜头控制动作")
    preset: str = Field(..., description="镜头预设名称，例如 close/front")
    durationMs: int | None = Field(default=None, description="过渡时长（毫秒）")


def _normalize_whitespace(value: str) -> str:
    return " ".join(value.strip().split())


def _parse_action_command(command: str) -> dict | None:
    normalized = _normalize_whitespace(command)
    if not normalized:
        return None

    if normalized.startswith("emotion "):
        value = normalized[len("emotion ") :].strip()
        return {"type": "emotion", "value": value} if value else None

    if normalized.startswith("motion "):
        value = normalized[len("motion ") :].strip()
        return {"type": "motion", "value": value} if value else None

    if normalized.startswith("wait "):
        raw_ms = normalized[len("wait ") :].strip()
        try:
            ms = int(raw_ms)
        except ValueError:
            return None
        if ms < 0:
            return None
        return {"type": "wait", "ms": ms}

    if normalized.startswith("say "):
        payload = normalized[len("say ") :]
        separator_index = payload.find("|")
        if separator_index < 0:
            return None

        emotion = payload[:separator_index].strip()
        text = payload[separator_index + 1 :].strip()
        if not emotion or not text:
            return None

        return {
            "type": "say",
            "emotion": emotion,
            "text": text,
        }

    return None


def _write_custom_event(runtime: ToolRuntime[AgentContext] | None, event: dict) -> None:
    if runtime is None:
        return

    writer = runtime.stream_writer
    if hasattr(writer, "write"):
        writer.write(event)
    else:
        writer(event)


async def _build_speech_events(
    *,
    parsed_commands: list[dict],
    runtime: ToolRuntime[AgentContext] | None,
) -> list[dict]:
    if runtime is None:
        return []

    context = runtime.context
    db_session = getattr(context, "db_session", None)
    character_id = getattr(context, "character_id", None)
    if db_session is None or not character_id:
        return []

    speech: list[dict] = []
    for command_index, command in enumerate(parsed_commands):
        if command.get("type") != "say":
            continue

        item = {
            "commandIndex": command_index,
            "text": command["text"],
            "emotion": command["emotion"],
        }
        try:
            item["audioUrl"] = await synthesize_character_speech_file(
                text=command["text"],
                character_id=character_id,
                db_session=db_session,
            )
        except Exception as exc:
            logger.warning(f"TTS synthesis for VRM say command failed: {exc}")
        speech.append(item)

    return speech


async def _perform_actions_impl(
    commands: list[str],
    runtime: ToolRuntime[AgentContext] | None = None,
) -> str:
    normalized_commands: list[str] = []
    parsed_commands: list[dict] = []

    for command in commands:
        normalized = _normalize_whitespace(command)
        parsed = _parse_action_command(normalized)
        if parsed is None:
            continue

        normalized_commands.append(normalized)
        parsed_commands.append(parsed)

    if not parsed_commands:
        return "error: invalid command"

    speech = await _build_speech_events(
        parsed_commands=parsed_commands,
        runtime=runtime,
    )
    _write_custom_event(
        runtime,
        {
            "type": "vrm.perform_actions",
            "toolCallId": runtime.tool_call_id if runtime else None,
            "commands": normalized_commands,
            "speech": speech,
        },
    )
    return "ok"


async def _control_camera_impl(
    action: Literal["cut", "transition"],
    preset: str,
    durationMs: int | None = None,
    runtime: ToolRuntime[AgentContext] | None = None,
) -> str:
    if not preset.strip():
        return "error: invalid preset"

    _write_custom_event(
        runtime,
        {
            "type": "vrm.control_camera",
            "toolCallId": runtime.tool_call_id if runtime else None,
            "command": {
                "action": action,
                "preset": preset,
                "durationMs": durationMs,
            },
        },
    )
    return "ok"


@tool(args_schema=PerformActionsInput)
async def perform_actions(
    commands: list[str],
    runtime: ToolRuntime[AgentContext],
) -> str:
    """向前端发送一组按顺序执行的轻量命令。"""

    return await _perform_actions_impl(commands, runtime)


@tool(args_schema=ControlCameraInput)
async def control_camera(
    action: Literal["cut", "transition"],
    preset: str,
    durationMs: int | None = None,
    runtime: ToolRuntime[AgentContext] | None = None,
) -> str:
    """发送镜头控制意图，和角色表现命令分离。"""

    return await _control_camera_impl(action, preset, durationMs, runtime)


def get_action_tools():
    return [perform_actions, control_camera]
