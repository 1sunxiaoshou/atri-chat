import pytest

from api.routes.health import health_check


@pytest.mark.asyncio
async def test_health_check_returns_healthy_status():
    response = await health_check()

    assert response.code == 200
    assert response.data == {"status": "healthy"}
