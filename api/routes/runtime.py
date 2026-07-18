"""运行时状态路由。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.schemas_runtime import ResponseModel, RuntimeVRMFeedbackRequest
from core.config import AppSettings, get_settings
from core.dependencies import get_db
from core.runtime_status import CapabilityRegistry, get_capability_registry

router = APIRouter()


@router.get("/runtime/status", response_model=ResponseModel)
async def get_runtime_status(
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings),
    registry: CapabilityRegistry = Depends(get_capability_registry),
):
    return ResponseModel(
        code=200,
        message="获取运行时状态成功",
        data=registry.snapshot(db_session=db, settings=settings),
    )


@router.get("/runtime/events", response_model=ResponseModel)
async def get_runtime_events(
    capability: str | None = Query(default=None, description="按能力名称过滤"),
    limit: int = Query(default=50, ge=1, le=200, description="返回事件数量上限"),
    registry: CapabilityRegistry = Depends(get_capability_registry),
):
    return ResponseModel(
        code=200,
        message="获取运行时事件成功",
        data={
            "events": registry.list_events(capability=capability, limit=limit),
        },
    )


@router.post("/runtime/vrm-feedback", response_model=ResponseModel)
async def post_vrm_feedback(
    req: RuntimeVRMFeedbackRequest,
    registry: CapabilityRegistry = Depends(get_capability_registry),
):
    registry.record_frontend_feedback(
        capability="vrm",
        conversation_id=req.conversation_id,
        kind=req.kind,
        ok=req.ok,
        state=req.state,
        error=req.error,
    )
    return ResponseModel(code=200, message="VRM 执行结果已记录", data={"ok": True})
