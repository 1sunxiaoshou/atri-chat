"""Internal TTS synthesis helpers for agent tools."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from core.config import get_settings
from core.db import Character, TTSProvider, VoiceAsset
from core.dependencies import get_tts_factory

if TYPE_CHECKING:
    from core.tts.factory import TTSFactory


def _stamp(value) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _build_tts_cache_name(
    *,
    text: str,
    language: str | None,
    character: Character,
    provider: TTSProvider,
    voice_asset: VoiceAsset,
) -> str:
    raw = "|".join(
        [
            str(character.id),
            str(voice_asset.id),
            str(provider.id),
            _stamp(provider.updated_at),
            _stamp(voice_asset.updated_at),
            language or "",
            text,
        ]
    )
    return f"{hashlib.sha256(raw.encode('utf-8')).hexdigest()}.wav"


async def synthesize_character_speech_file(
    *,
    text: str,
    character_id: str,
    db_session: Session,
    language: str | None = None,
    tts_factory: TTSFactory | None = None,
) -> str:
    """Synthesize speech for a character and return a static audio URL."""
    character = db_session.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise ValueError(f"角色不存在: {character_id}")
    if not character.voice_asset_id:
        raise ValueError(f"角色未配置音色: {character_id}")

    voice_asset = (
        db_session.query(VoiceAsset)
        .filter(VoiceAsset.id == character.voice_asset_id)
        .first()
    )
    if not voice_asset:
        raise ValueError(f"角色音色不存在: {character.voice_asset_id}")

    provider = (
        db_session.query(TTSProvider)
        .filter(TTSProvider.id == voice_asset.provider_id)
        .first()
    )
    if not provider:
        raise ValueError(f"音色供应商不存在: {voice_asset.provider_id}")

    settings = get_settings()
    settings.tts_dir.mkdir(parents=True, exist_ok=True)
    filename = _build_tts_cache_name(
        text=text,
        language=language,
        character=character,
        provider=provider,
        voice_asset=voice_asset,
    )
    audio_path: Path = settings.tts_dir / filename
    if not audio_path.exists():
        factory = tts_factory or get_tts_factory()
        config = {**provider.config_payload, **voice_asset.voice_config}
        tts = factory.create_tts(
            provider_type=provider.provider_type,
            config=config,
        )
        audio_path.write_bytes(await tts.synthesize_async(text, language))

    return f"/static/tts/{filename}"
