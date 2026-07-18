import asyncio

from core.runtime_status import CapabilityRegistry


def test_registry_exposes_manifests_for_core_capabilities():
    registry = CapabilityRegistry()

    manifests = {
        manifest.capability: manifest for manifest in registry.list_manifests()
    }

    assert set(manifests.keys()) == {"agent", "asr", "tts", "vrm"}
    assert manifests["agent"].supports_warmup is True
    assert manifests["vrm"].supports_frontend_feedback is True


def test_registry_reset_clears_vrm_frontend_feedback():
    registry = CapabilityRegistry()
    registry.record_frontend_feedback(
        capability="vrm",
        conversation_id="conv-42",
        kind="perform_actions",
        ok=False,
        error="boom",
        state={"expression": "angry"},
    )

    reset_result = asyncio.run(registry.reset("vrm"))

    assert reset_result is True
    assert "vrm" not in registry._frontend_feedback


def test_registry_reset_returns_false_for_unknown_capability():
    registry = CapabilityRegistry()

    reset_result = asyncio.run(registry.reset("unknown"))

    assert reset_result is False


def test_registry_schedule_startup_warmups_uses_manifest_support_flag(monkeypatch):
    registry = CapabilityRegistry()
    scheduled: list[tuple[str, float]] = []

    def fake_schedule_warmup(capability: str, *, delay_seconds: float = 0.0) -> bool:
        scheduled.append((capability, delay_seconds))
        return True

    monkeypatch.setattr(registry, "schedule_warmup", fake_schedule_warmup)

    result = registry.schedule_startup_warmups()

    assert result == ["agent", "asr", "tts"]
    assert ("agent", 1.5) in scheduled
    assert ("asr", 0.0) in scheduled
    assert ("tts", 0.0) in scheduled


def test_registry_warmup_overlay_marks_status_as_warming():
    registry = CapabilityRegistry()
    registry._mark_warmup_state("agent", status="warming")

    status = registry.get_agent_status()
    overlay_status = registry._apply_lifecycle_overlay("agent", status)

    assert overlay_status.status == "warming"
    assert overlay_status.summary == "后台预热中"
    assert overlay_status.details["warmup"]["status"] == "warming"


def test_registry_records_events_for_feedback_and_reset():
    registry = CapabilityRegistry()
    registry.record_frontend_feedback(
        capability="vrm",
        conversation_id="conv-7",
        kind="perform_actions",
        ok=True,
        state={"motion": "wave"},
    )

    asyncio.run(registry.reset("vrm"))
    events = registry.list_events(limit=10)

    assert events[0]["phase"] == "reset"
    assert events[0]["capability"] == "vrm"
    assert any(
        event["adapter"] == "frontend" and event["thread_id"] == "conv-7"
        for event in events
    )
