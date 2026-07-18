from types import SimpleNamespace

import pytest

from core.tools.action_tools import _control_camera_impl, _perform_actions_impl


class _Writer:
    def __init__(self):
        self.events = []

    def write(self, event):
        self.events.append(event)


def _runtime(tool_call_id: str = "call-001"):
    writer = _Writer()
    return SimpleNamespace(
        stream_writer=writer,
        tool_call_id=tool_call_id,
        context=SimpleNamespace(db_session=None, character_id="char-001"),
    )


@pytest.mark.asyncio
async def test_perform_actions_accepts_valid_commands_and_streams_event():
    runtime = _runtime()
    result = await _perform_actions_impl(
        [
            " emotion   happy ",
            "say happy   |  欢迎回来",
            "wait  500",
            "motion wave",
        ],
        runtime,
    )

    assert result == "ok"
    assert runtime.stream_writer.events == [
        {
            "type": "vrm.perform_actions",
            "toolCallId": "call-001",
            "commands": [
                "emotion happy",
                "say happy | 欢迎回来",
                "wait 500",
                "motion wave",
            ],
            "speech": [],
        }
    ]


@pytest.mark.asyncio
async def test_perform_actions_accepts_partially_valid_commands():
    runtime = _runtime()
    result = await _perform_actions_impl(
        [
            "invalid command",
            "say sad | 别担心",
            "wait nope",
        ],
        runtime,
    )

    assert result == "ok"
    assert runtime.stream_writer.events[0]["commands"] == ["say sad | 别担心"]


@pytest.mark.asyncio
async def test_perform_actions_fails_when_all_commands_are_invalid():
    runtime = _runtime()
    result = await _perform_actions_impl(
        [
            "invalid",
            "camera close",
        ],
        runtime,
    )

    assert result.startswith("error:")
    assert runtime.stream_writer.events == []


@pytest.mark.asyncio
async def test_control_camera_returns_ok_and_streams_event():
    runtime = _runtime()
    result = await _control_camera_impl(
        action="transition",
        preset="front",
        durationMs=600,
        runtime=runtime,
    )

    assert result == "ok"
    assert runtime.stream_writer.events == [
        {
            "type": "vrm.control_camera",
            "toolCallId": "call-001",
            "command": {
                "action": "transition",
                "preset": "front",
                "durationMs": 600,
            },
        }
    ]
