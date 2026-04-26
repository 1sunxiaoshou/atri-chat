"""启动阶段埋点与最小基线快照。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
import time
from typing import Any


@dataclass
class StartupMetrics:
    """记录进程启动关键阶段的耗时。"""

    process_started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    _started_perf: float = field(default_factory=time.perf_counter)
    _phases: dict[str, float] = field(default_factory=dict)
    _health_ready_ms: float | None = None
    _lock: Lock = field(default_factory=Lock)

    def mark(self, phase: str) -> float:
        """记录阶段完成时间（毫秒）。"""
        elapsed_ms = round((time.perf_counter() - self._started_perf) * 1000, 2)
        with self._lock:
            self._phases.setdefault(phase, elapsed_ms)
        return elapsed_ms

    def mark_health_ready(self) -> float:
        """记录首次健康检查可用时间。"""
        elapsed_ms = round((time.perf_counter() - self._started_perf) * 1000, 2)
        with self._lock:
            if self._health_ready_ms is None:
                self._health_ready_ms = elapsed_ms
        return self._health_ready_ms or elapsed_ms

    def snapshot(self) -> dict[str, Any]:
        """导出当前启动阶段快照。"""
        with self._lock:
            return {
                "process_started_at": self.process_started_at.isoformat(),
                "phases_ms": dict(self._phases),
                "health_ready_ms": self._health_ready_ms,
            }


startup_metrics = StartupMetrics()

