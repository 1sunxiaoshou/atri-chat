import importlib
import os
from pathlib import Path
import sys

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _load_app_module():
    os.environ.setdefault("LOG_LEVEL", "WARNING")
    os.environ.setdefault("ENABLE_HTTP_LOGGING", "false")
    os.environ.setdefault("ENABLE_LLM_CALL_LOGGER", "false")
    return importlib.import_module("main")


def test_runtime_status_returns_control_plane_and_capabilities():
    app_module = _load_app_module()

    with TestClient(app_module.app) as client:
        response = client.get("/api/v1/runtime/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200

    data = payload["data"]
    assert data["control_plane"]["status"] == "ready"
    assert "startup" in data["control_plane"]

    capabilities = data["capabilities"]
    capability_names = {capability["capability"] for capability in capabilities}
    assert capability_names == {"agent", "asr", "tts", "vrm"}
    assert all("manifest" in capability for capability in capabilities)
    assert all(capability["manifest"]["capability"] == capability["capability"] for capability in capabilities)

    summary = data["summary"]
    assert summary["total_count"] == 4
    assert isinstance(summary["ready_count"], int)
    assert isinstance(summary["warming_count"], int)
    assert isinstance(summary["failed_count"], int)
    assert isinstance(summary["counts"], dict)
    assert set(summary["statuses"].keys()) == capability_names
