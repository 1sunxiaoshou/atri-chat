"""健康检查路由"""
from fastapi import APIRouter
from api.schemas_runtime import ResponseModel
from core.startup_metrics import startup_metrics

router = APIRouter()


@router.get("/health", response_model=ResponseModel)
async def health_check():
    """健康检查"""
    startup_metrics.mark_health_ready()
    return ResponseModel(
        code=200,
        message="系统正常运行",
        data={
            "status": "healthy",
            "startup": startup_metrics.snapshot(),
        }
    )
