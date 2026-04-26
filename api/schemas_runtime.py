"""启动关键路径使用的轻量 Schema。"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ResponseModel(BaseModel):
    """通用响应模型。"""

    code: int = Field(200, description="状态码")
    message: str = Field("success", description="消息")
    data: Optional[Any] = Field(None, description="数据")


class RuntimeVRMFeedbackRequest(BaseModel):
    """前端 VRM 执行回报。"""

    conversation_id: str = Field(..., description="会话ID（UUID）")
    kind: str = Field(..., description="反馈类型")
    ok: bool = Field(..., description="执行是否成功")
    error: Optional[str] = Field(None, description="错误信息")
    state: Optional[dict[str, Any]] = Field(None, description="当前前端状态快照")
