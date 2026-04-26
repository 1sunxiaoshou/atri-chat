"""运行时能力状态注册表。"""

from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy.orm import Session

from . import dependencies
from .asr.model_downloader import get_model_info
from .config import AppSettings
from .db import Avatar, TTSProvider
from .logger import get_logger
from .startup_metrics import startup_metrics

logger = get_logger(__name__)

CapabilityStateLiteral = str
CapabilityStatusResolver = Callable[[Session | None, AppSettings | None], "CapabilityStatus"]
CapabilityLifecycleHook = Callable[[], None | Awaitable[None]]


@dataclass(frozen=True)
class CapabilityManifest:
    capability: str
    label: str
    adapters: list[str]
    modes: list[str]
    runtime_managed: bool
    supports_warmup: bool
    supports_shutdown: bool
    supports_reset: bool
    supports_frontend_feedback: bool


@dataclass
class CapabilityStatus:
    capability: str
    status: CapabilityStateLiteral
    summary: str
    details: dict[str, Any]
    updated_at: str


@dataclass
class CapabilityEvent:
    capability: str
    adapter: str
    thread_id: str | None
    run_id: str | None
    phase: str
    status: str
    payload: dict[str, Any]
    timestamp: str


@dataclass(frozen=True)
class CapabilityDefinition:
    manifest: CapabilityManifest
    resolve_status: CapabilityStatusResolver
    warmup: CapabilityLifecycleHook | None = None
    shutdown: CapabilityLifecycleHook | None = None
    reset: CapabilityLifecycleHook | None = None


class CapabilityRegistry:
    """统一聚合核心能力状态和生命周期入口。"""

    def __init__(self):
        self._frontend_feedback: dict[str, dict[str, Any]] = {}
        self._definitions: dict[str, CapabilityDefinition] = {}
        self._warmup_state: dict[str, dict[str, Any]] = {}
        self._background_tasks: dict[str, asyncio.Task[None]] = {}
        self._events: deque[CapabilityEvent] = deque(maxlen=200)
        self._register_defaults()

    def _timestamp(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _build_status(
        self,
        capability: str,
        status: CapabilityStateLiteral,
        summary: str,
        details: dict[str, Any],
    ) -> CapabilityStatus:
        return CapabilityStatus(
            capability=capability,
            status=status,
            summary=summary,
            details=details,
            updated_at=self._timestamp(),
        )

    def _register_defaults(self) -> None:
        self.register(
            CapabilityDefinition(
                manifest=CapabilityManifest(
                    capability="agent",
                    label="Agent",
                    adapters=["api", "stream"],
                    modes=["text", "vrm"],
                    runtime_managed=True,
                    supports_warmup=True,
                    supports_shutdown=False,
                    supports_reset=True,
                    supports_frontend_feedback=False,
                ),
                resolve_status=lambda _db, _settings: self.get_agent_status(),
                warmup=self._warmup_agent,
                reset=self._reset_agent,
            )
        )
        self.register(
            CapabilityDefinition(
                manifest=CapabilityManifest(
                    capability="asr",
                    label="ASR",
                    adapters=["api", "ui"],
                    modes=["audio"],
                    runtime_managed=True,
                    supports_warmup=True,
                    supports_shutdown=False,
                    supports_reset=True,
                    supports_frontend_feedback=False,
                ),
                resolve_status=lambda _db, settings: self.get_asr_status(settings),
                warmup=self._warmup_asr,
                reset=self._reset_asr,
            )
        )
        self.register(
            CapabilityDefinition(
                manifest=CapabilityManifest(
                    capability="tts",
                    label="TTS",
                    adapters=["api", "ui", "agent"],
                    modes=["audio", "vrm"],
                    runtime_managed=True,
                    supports_warmup=True,
                    supports_shutdown=False,
                    supports_reset=True,
                    supports_frontend_feedback=False,
                ),
                resolve_status=lambda db, _settings: self.get_tts_status(db),
                warmup=self._warmup_tts,
                reset=self._reset_tts,
            )
        )
        self.register(
            CapabilityDefinition(
                manifest=CapabilityManifest(
                    capability="vrm",
                    label="VRM",
                    adapters=["ui", "agent"],
                    modes=["vrm"],
                    runtime_managed=True,
                    supports_warmup=False,
                    supports_shutdown=False,
                    supports_reset=True,
                    supports_frontend_feedback=True,
                ),
                resolve_status=lambda db, _settings: self.get_vrm_status(db),
                reset=self._reset_vrm,
            )
        )

    def register(self, definition: CapabilityDefinition) -> None:
        self._definitions[definition.manifest.capability] = definition

    def list_manifests(self) -> list[CapabilityManifest]:
        return [definition.manifest for definition in self._definitions.values()]

    def _get_warmup_state(self, capability: str) -> dict[str, Any]:
        return self._warmup_state.get(capability, {})

    def _mark_warmup_state(
        self,
        capability: str,
        *,
        status: str,
        error: str | None = None,
    ) -> None:
        state = self._warmup_state.setdefault(capability, {})
        state["status"] = status
        state["updated_at"] = self._timestamp()
        if status == "warming":
            state["last_started_at"] = state["updated_at"]
            state["error"] = None
        elif status == "ready":
            state["last_finished_at"] = state["updated_at"]
            state["error"] = None
        elif status == "failed":
            state["last_finished_at"] = state["updated_at"]
            state["error"] = error

    def emit_event(
        self,
        *,
        capability: str,
        adapter: str,
        phase: str,
        status: str,
        payload: dict[str, Any] | None = None,
        thread_id: str | None = None,
        run_id: str | None = None,
    ) -> CapabilityEvent:
        event = CapabilityEvent(
            capability=capability,
            adapter=adapter,
            thread_id=thread_id,
            run_id=run_id,
            phase=phase,
            status=status,
            payload=payload or {},
            timestamp=self._timestamp(),
        )
        self._events.append(event)
        return event

    def list_events(
        self,
        *,
        capability: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        events = list(self._events)
        if capability is not None:
            events = [event for event in events if event.capability == capability]
        if limit > 0:
            events = events[-limit:]
        return [asdict(event) for event in reversed(events)]

    def _merge_lifecycle_details(self, capability: str, details: dict[str, Any]) -> dict[str, Any]:
        warmup_state = self._get_warmup_state(capability)
        if not warmup_state:
            return details
        return {
            **details,
            "warmup": warmup_state,
        }

    def _apply_lifecycle_overlay(self, capability: str, status: CapabilityStatus) -> CapabilityStatus:
        warmup_state = self._get_warmup_state(capability)
        if not warmup_state:
            return status

        merged_details = self._merge_lifecycle_details(capability, status.details)
        lifecycle_status = warmup_state.get("status")
        if lifecycle_status == "warming":
            return self._build_status(
                capability=capability,
                status="warming",
                summary="后台预热中",
                details=merged_details,
            )
        if lifecycle_status == "failed":
            return self._build_status(
                capability=capability,
                status="failed",
                summary="后台预热失败",
                details=merged_details,
            )
        if lifecycle_status == "ready":
            return self._build_status(
                capability=capability,
                status=status.status,
                summary=status.summary,
                details=merged_details,
            )
        return status

    async def _run_warmup(self, capability: str) -> None:
        definition = self._definitions.get(capability)
        if definition is None or definition.warmup is None:
            return

        self._mark_warmup_state(capability, status="warming")
        self.emit_event(
            capability=capability,
            adapter="runtime",
            phase="warmup",
            status="warming",
        )
        try:
            result = definition.warmup()
            if result is not None:
                await result
            self._mark_warmup_state(capability, status="ready")
            self.emit_event(
                capability=capability,
                adapter="runtime",
                phase="warmup",
                status="ready",
            )
            logger.info(f"能力预热完成: {capability}")
        except Exception as exc:
            self._mark_warmup_state(capability, status="failed", error=f"{type(exc).__name__}: {exc}")
            self.emit_event(
                capability=capability,
                adapter="runtime",
                phase="warmup",
                status="failed",
                payload={"error": f"{type(exc).__name__}: {exc}"},
            )
            logger.error(f"能力预热失败: {capability}: {exc}")
        finally:
            self._background_tasks.pop(capability, None)

    async def warmup(self, capability: str) -> bool:
        definition = self._definitions.get(capability)
        if definition is None or definition.warmup is None:
            return False
        await self._run_warmup(capability)
        return True

    def schedule_warmup(self, capability: str, *, delay_seconds: float = 0.0) -> bool:
        definition = self._definitions.get(capability)
        existing_task = self._background_tasks.get(capability)
        if definition is None or definition.warmup is None:
            return False
        if existing_task is not None and not existing_task.done():
            return True

        async def runner() -> None:
            if delay_seconds > 0:
                await asyncio.sleep(delay_seconds)
            await self._run_warmup(capability)

        self._background_tasks[capability] = asyncio.create_task(runner(), name=f"capability-warmup:{capability}")
        return True

    def schedule_startup_warmups(self) -> list[str]:
        scheduled: list[str] = []
        for definition in self._definitions.values():
            if not definition.manifest.supports_warmup:
                continue
            capability = definition.manifest.capability
            if self.schedule_warmup(capability, delay_seconds=1.5 if capability == "agent" else 0.0):
                scheduled.append(capability)
        return scheduled

    async def cancel_background_tasks(self) -> None:
        tasks = [task for task in self._background_tasks.values() if not task.done()]
        self._background_tasks.clear()
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def shutdown(self, capability: str) -> bool:
        definition = self._definitions.get(capability)
        if definition is None or definition.shutdown is None:
            return False
        result = definition.shutdown()
        if result is not None:
            await result
        return True

    async def reset(self, capability: str) -> bool:
        definition = self._definitions.get(capability)
        if definition is None or definition.reset is None:
            return False
        result = definition.reset()
        if result is not None:
            await result
        self.emit_event(
            capability=capability,
            adapter="runtime",
            phase="reset",
            status="ready",
        )
        return True

    def collect_statuses(
        self,
        *,
        db_session: Session | None,
        settings: AppSettings | None,
    ) -> list[CapabilityStatus]:
        statuses: list[CapabilityStatus] = []
        for definition in self._definitions.values():
            capability = definition.manifest.capability
            if capability in {"tts", "vrm"} and db_session is None:
                raise ValueError(f"{capability} 状态查询需要 db_session")
            if capability == "asr" and settings is None:
                raise ValueError("asr 状态查询需要 settings")
            statuses.append(self._apply_lifecycle_overlay(capability, definition.resolve_status(db_session, settings)))
        return statuses

    def get_agent_status(self) -> CapabilityStatus:
        coordinator_cached = dependencies.get_agent_coordinator.cache_info().currsize > 0
        has_checkpointer = dependencies._checkpointer_instance is not None

        if coordinator_cached and has_checkpointer:
            status = "ready"
            summary = "Agent 协调器已创建"
        elif has_checkpointer:
            status = "uninitialized"
            summary = "Agent 协调器尚未创建"
        else:
            status = "warming"
            summary = "Checkpointer 尚未完成初始化"

        return self._build_status(
            capability="agent",
            status=status,
            summary=summary,
            details={
                "coordinator_cached": coordinator_cached,
                "checkpointer_ready": has_checkpointer,
            },
        )

    def _warmup_agent(self) -> Awaitable[None]:
        coordinator = dependencies.get_agent_coordinator()
        return coordinator.warm_up()

    def _reset_agent(self) -> None:
        dependencies.get_agent_coordinator.cache_clear()

    def get_tts_status(self, db_session: Session | None) -> CapabilityStatus:
        if db_session is None:
            raise ValueError("tts 状态查询需要 db_session")

        providers = db_session.query(TTSProvider).all()
        provider_count = len(providers)
        factory = dependencies.get_tts_factory()
        cached_instances = len(factory._instances)

        if provider_count == 0:
            status = "disabled"
            summary = "未配置 TTS 供应商"
        elif cached_instances > 0:
            status = "ready"
            summary = "TTS 实例缓存已就绪"
        else:
            status = "uninitialized"
            summary = "TTS 已配置但尚未初始化实例"

        return self._build_status(
            capability="tts",
            status=status,
            summary=summary,
            details={
                "provider_count": provider_count,
                "cached_instances": cached_instances,
                "providers": [
                    {
                        "id": provider.id,
                        "name": provider.name,
                        "provider_type": provider.provider_type,
                    }
                    for provider in providers
                ],
            },
        )

    def _warmup_tts(self) -> None:
        try:
            dependencies.get_tts_factory().get_default_tts()
        except ValueError as exc:
            logger.debug(f"跳过 TTS 预热: {exc}")

    def _reset_tts(self) -> None:
        dependencies.get_tts_factory().clear_cache()

    def get_asr_status(self, settings: AppSettings | None) -> CapabilityStatus:
        if settings is None:
            raise ValueError("asr 状态查询需要 settings")

        model_dir = settings.asr_models_dir / "sensevoice"
        model_info = get_model_info(model_dir)
        engine_cached = dependencies.get_asr_engine.cache_info().currsize > 0

        if not model_info["exists"]:
            status = "disabled"
            summary = "ASR 模型资源尚未安装"
        elif engine_cached:
            status = "ready"
            summary = "ASR 引擎已初始化"
        else:
            status = "uninitialized"
            summary = "ASR 模型已就绪但引擎尚未初始化"

        return self._build_status(
            capability="asr",
            status=status,
            summary=summary,
            details={
                "model_exists": model_info["exists"],
                "int8_ready": model_info["int8"],
                "fp32_ready": model_info["fp32"],
                "engine_cached": engine_cached,
                "total_size_mb": model_info["total_size_mb"],
            },
        )

    def _warmup_asr(self) -> None:
        dependencies.get_asr_engine()

    def _reset_asr(self) -> None:
        dependencies.get_asr_engine.cache_clear()

    def get_vrm_status(self, db_session: Session | None) -> CapabilityStatus:
        if db_session is None:
            raise ValueError("vrm 状态查询需要 db_session")

        avatar_count = db_session.query(Avatar).count()
        coordinator_cached = dependencies.get_agent_coordinator.cache_info().currsize > 0
        latest_feedback = self._frontend_feedback.get("vrm", {})

        if avatar_count == 0:
            status = "disabled"
            summary = "未配置 VRM 形象资源"
        elif coordinator_cached:
            status = "ready"
            summary = "VRM 服务可通过协调器访问"
        else:
            status = "uninitialized"
            summary = "VRM 资源已配置，等待协调器初始化"

        if latest_feedback.get("ok") is False:
            status = "failed"
            summary = "前端最近一次 VRM 执行失败"

        return self._build_status(
            capability="vrm",
            status=status,
            summary=summary,
            details={
                "avatar_count": avatar_count,
                "coordinator_cached": coordinator_cached,
                "latest_feedback": latest_feedback,
            },
        )

    def _reset_vrm(self) -> None:
        self._frontend_feedback.pop("vrm", None)

    def record_frontend_feedback(
        self,
        *,
        capability: str,
        conversation_id: str,
        kind: str,
        ok: bool,
        state: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        self._frontend_feedback[capability] = {
            "conversation_id": conversation_id,
            "kind": kind,
            "ok": ok,
            "state": state or {},
            "error": error,
            "updated_at": self._timestamp(),
        }
        self.emit_event(
            capability=capability,
            adapter="frontend",
            thread_id=conversation_id,
            phase=kind,
            status="ready" if ok else "failed",
            payload={
                "state": state or {},
                "error": error,
            },
        )

    def snapshot(self, *, db_session: Session, settings: AppSettings) -> dict[str, Any]:
        capabilities = self.collect_statuses(db_session=db_session, settings=settings)

        statuses = {item.capability: item.status for item in capabilities}
        counts: dict[str, int] = {}
        for status in statuses.values():
            counts[status] = counts.get(status, 0) + 1

        return {
            "control_plane": {
                "status": "ready",
                "startup": startup_metrics.snapshot(),
            },
            "capabilities": [
                {
                    **asdict(item),
                    "manifest": asdict(self._definitions[item.capability].manifest),
                }
                for item in capabilities
            ],
            "summary": {
                "total_count": len(capabilities),
                "ready_count": sum(1 for status in statuses.values() if status == "ready"),
                "warming_count": sum(1 for status in statuses.values() if status == "warming"),
                "failed_count": sum(1 for status in statuses.values() if status == "failed"),
                "counts": counts,
                "statuses": statuses,
            },
        }


_capability_registry = CapabilityRegistry()


def get_capability_registry() -> CapabilityRegistry:
    return _capability_registry
