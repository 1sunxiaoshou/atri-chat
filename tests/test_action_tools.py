from core.tools.action_tools import control_camera, perform_actions


def test_perform_actions_accepts_valid_commands():
    result = perform_actions.invoke(
        {
            "commands": [
                " emotion   happy ",
                "say happy   |  欢迎回来",
                "wait  500",
                "motion wave",
            ]
        }
    )

    assert result == "ok"


def test_perform_actions_accepts_partially_valid_commands():
    result = perform_actions.invoke(
        {
            "commands": [
                "invalid command",
                "say sad | 别担心",
                "wait nope",
            ]
        }
    )

    assert result == "ok"


def test_perform_actions_fails_when_all_commands_are_invalid():
    result = perform_actions.invoke(
        {
            "commands": [
                "invalid",
                "camera close",
            ]
        }
    )

    assert result.startswith("error:")


def test_control_camera_returns_ok():
    result = control_camera.invoke(
        {
            "action": "transition",
            "preset": "front",
            "durationMs": 600,
        }
    )

    assert result == "ok"
