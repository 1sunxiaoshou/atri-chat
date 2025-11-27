"""健康检查路由"""
from fastapi import APIRouter
from api.schemas import ResponseModel

router = APIRouter()


@router.get("/health", response_model=ResponseModel)
async def health_check():
    """健康检查"""
    return ResponseModel(
        code=200,
        message="系统正常运行",
        data={"status": "healthy"}
    )
