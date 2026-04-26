from fastapi.testclient import TestClient

from main import app


def test_runtime_vrm_feedback_updates_registry():
    client = TestClient(app)

    response = client.post(
        "/api/v1/runtime/vrm-feedback",
        json={
            "conversation_id": "conv-1",
            "kind": "perform_actions",
            "ok": True,
            "state": {"expression": "happy"},
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["ok"] is True

    status_response = client.get("/api/v1/runtime/status")
    vrm_status = next(
        item
        for item in status_response.json()["data"]["capabilities"]
        if item["capability"] == "vrm"
    )
    assert vrm_status["details"]["latest_feedback"]["conversation_id"] == "conv-1"
    assert vrm_status["details"]["latest_feedback"]["state"]["expression"] == "happy"

    events_response = client.get("/api/v1/runtime/events", params={"capability": "vrm", "limit": 10})
    assert events_response.status_code == 200
    events = events_response.json()["data"]["events"]
    assert any(event["adapter"] == "frontend" for event in events)
    assert any(event["thread_id"] == "conv-1" for event in events)
