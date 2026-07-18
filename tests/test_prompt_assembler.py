from types import SimpleNamespace

from core.prompts import PromptService


class _FakeCharacterRepository:
    def __init__(self, _session):
        self._character = SimpleNamespace(
            id="char-1",
            name="ATRI",
            system_prompt="你是一个温柔但有主见的角色。",
        )

    def get(self, character_id: str):
        return self._character if character_id == "char-1" else None

    def get_avatar_expressions(self, _character_id: str):
        return ["happy", "thinking"]

    def get_character_motions(self, _character_id: str, category: str = "reply"):
        assert category == "reply"
        return [
            SimpleNamespace(id="wave_hand", name="挥手", description="轻快地挥手"),
            SimpleNamespace(id="nod_softly", name="点头", description="轻轻点头"),
        ]


def test_text_mode_prompt_only_contains_role_and_mode(monkeypatch):
    monkeypatch.setattr(
        "core.prompts.service.CharacterRepository", _FakeCharacterRepository
    )

    service = PromptService()
    final_prompt = service.build_system_prompt(
        character_id="char-1",
        mode="text",
        db_session=object(),
    )

    assert "ATRI" in final_prompt
    assert "温柔但有主见" in final_prompt
    assert "输出协议 (Text Mode)" in final_prompt
    assert "记忆系统" not in final_prompt
    assert "用户画像" not in final_prompt
    assert "运行时上下文" not in final_prompt
    assert "禁止输出任何专用控制标签" in final_prompt
    assert "强制输出格式" not in final_prompt


def test_vrm_mode_prompt_uses_command_protocol(monkeypatch):
    monkeypatch.setattr(
        "core.prompts.service.CharacterRepository", _FakeCharacterRepository
    )

    service = PromptService()
    prompt = service.build_system_prompt(
        character_id="char-1",
        mode="vrm",
        db_session=object(),
    )

    assert "wave_hand" in prompt
    assert "happy" in prompt
    assert "不要输出任何专用控制标签" in prompt
    assert "通过可用工具完成" in prompt
    assert "强制输出格式" not in prompt
