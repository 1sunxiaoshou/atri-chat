from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest

from core.db import Character, TTSProvider, VoiceAsset
from core.tts import synthesis


class _Query:
    def __init__(self, value):
        self.value = value

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self.value


class _Db:
    def __init__(self, values):
        self.values = values

    def query(self, model):
        return _Query(self.values[model])


class _TTS:
    def __init__(self, factory):
        self.factory = factory

    async def synthesize_async(self, text, language=None):
        self.factory.calls.append((text, language))
        return b"wav-data"


class _Factory:
    def __init__(self):
        self.calls = []

    def create_tts(self, provider_type, config):
        assert provider_type == "fake"
        assert config == {"api_key": "x", "voice": "atri"}
        return _TTS(self)


@pytest.mark.asyncio
async def test_synthesize_character_speech_file_writes_and_reuses_cache(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(
        synthesis,
        "get_settings",
        lambda: SimpleNamespace(tts_dir=tmp_path),
    )

    now = datetime(2026, 1, 1, 12, 0, 0)
    character = SimpleNamespace(id="char-001", voice_asset_id=7)
    provider = SimpleNamespace(
        id=3,
        provider_type="fake",
        config_payload={"api_key": "x"},
        updated_at=now,
    )
    voice_asset = SimpleNamespace(
        id=7,
        provider_id=3,
        voice_config={"voice": "atri"},
        updated_at=now,
    )
    db = _Db(
        {
            Character: character,
            TTSProvider: provider,
            VoiceAsset: voice_asset,
        }
    )
    factory = _Factory()

    first_url = await synthesis.synthesize_character_speech_file(
        text="你好",
        character_id="char-001",
        db_session=db,
        language="zh",
        tts_factory=factory,
    )
    second_url = await synthesis.synthesize_character_speech_file(
        text="你好",
        character_id="char-001",
        db_session=db,
        language="zh",
        tts_factory=factory,
    )

    assert first_url == second_url
    assert first_url.startswith("/static/tts/")
    assert (
        tmp_path / first_url.removeprefix("/static/tts/")
    ).read_bytes() == b"wav-data"
    assert factory.calls == [("你好", "zh")]
