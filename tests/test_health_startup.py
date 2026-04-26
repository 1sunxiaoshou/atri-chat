import importlib
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _load_app_module():
    os.environ.setdefault("LOG_LEVEL", "WARNING")
    os.environ.setdefault("ENABLE_HTTP_LOGGING", "false")
    os.environ.setdefault("ENABLE_LLM_CALL_LOGGER", "false")
    return importlib.import_module("main")


def test_health_returns_startup_snapshot():
    app_module = _load_app_module()

    with TestClient(app_module.app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200

    data = payload["data"]
    assert data["status"] == "healthy"

    startup = data["startup"]
    assert isinstance(startup["process_started_at"], str)
    assert isinstance(startup["phases_ms"], dict)
    assert isinstance(startup["health_ready_ms"], (int, float))

    expected_phases = {
        "settings_ready",
        "fastapi_app_created",
        "routes_registered",
        "logging_ready",
        "lifespan_dependencies_ready",
    }
    assert expected_phases.issubset(startup["phases_ms"].keys())

    for phase_name in expected_phases:
        assert startup["phases_ms"][phase_name] >= 0
