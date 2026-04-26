"""命令系统工具。"""

from __future__ import annotations

from typing import Literal

from langchain.tools import tool
from pydantic import BaseModel, Field


class PerformActionsInput(BaseModel):
    commands: list[str] = Field(
        ...,
        description="按顺序执行的命令列表，例如 ['emotion happy', 'say happy | 你好呀']",
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


@tool(args_schema=PerformActionsInput)
def perform_actions(commands: list[str]) -> str:
    """向前端发送一组按顺序执行的轻量命令。"""

    normalized_commands: list[str] = []
    parsed_commands: list[dict] = []
    rejected_commands: list[str] = []

    for command in commands:
        normalized = _normalize_whitespace(command)
        parsed = _parse_action_command(normalized)
        if parsed is None:
            rejected_commands.append(command)
            continue

        normalized_commands.append(normalized)
        parsed_commands.append(parsed)

    if not parsed_commands:
        return "error: invalid command"

    return "ok"


@tool(args_schema=ControlCameraInput)
def control_camera(action: Literal["cut", "transition"], preset: str, durationMs: int | None = None) -> str:
    """发送镜头控制意图，和角色表现命令分离。"""

    if not preset.strip():
        return "error: invalid preset"
    return "ok"


def get_action_tools():
    return [perform_actions, control_camera]
