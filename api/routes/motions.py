"""动作资产管理 API (ORM 版本)"""
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Motion
from core.config import get_settings, AppSettings
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/motions", tags=["Motions"])


# ==================== Pydantic 模型 ====================

class MotionUpdate(BaseModel):
    """更新动作"""
    name: Optional[str] = Field(None, description="动作名称")
    description: Optional[str] = Field(None, description="动作描述")
    tags: Optional[List[str]] = Field(None, description="标签列表")


class MotionResponse(BaseModel):
    """动作响应"""
    id: str
    name: str
    file_url: str
    duration_ms: int
    description: Optional[str]
    tags: Optional[List[str]]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


# ==================== API 端点 ====================

@router.get("", summary="获取所有动作", response_model=ResponseModel)
async def list_motions(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    tags: Optional[str] = None,  # 逗号分隔的标签
    duration_min: Optional[int] = None,  # 最小持续时间（毫秒）
    duration_max: Optional[int] = None,  # 最大持续时间（毫秒）
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings)
) -> Dict[str, Any]:
    """获取所有动作
    
    支持分页、搜索和过滤
    """
    try:
        query = db.query(Motion)
        
        # 搜索过滤
        if search:
            query = query.filter(Motion.name.ilike(f"%{search}%"))
        
        # 持续时间过滤
        if duration_min is not None:
            query = query.filter(Motion.duration_ms >= duration_min)
        if duration_max is not None:
            query = query.filter(Motion.duration_ms <= duration_max)
        
        # 标签过滤（简单实现，检查 JSON 字段）
        if tags:
            tag_list = [t.strip() for t in tags.split(",")]
            for tag in tag_list:
                query = query.filter(Motion.tags.contains(tag))
        
        # 分页
        motions = query.offset(skip).limit(limit).all()
        
        # 构建响应
        data = [
            {
                "id": motion.id,
                "name": motion.name,
                "file_url": motion.file_url,
                "animation_path": motion.file_url,
                "duration_ms": motion.duration_ms,
                "description": motion.description,
                "tags": motion.tags if motion.tags else [],
                "created_at": motion.created_at.isoformat(),
                "updated_at": motion.updated_at.isoformat(),
            }
            for motion in motions
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except Exception as e:
        logger.error("获取动作列表失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{motion_id}", summary="获取动作详情", response_model=ResponseModel)
async def get_motion(
    motion_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取动作详情"""
    try:
        motion = db.query(Motion).filter(Motion.id == motion_id).first()
        
        if not motion:
            raise HTTPException(status_code=404, detail="动作不存在")
        
        # 构建响应
        data = {
            "id": motion.id,
            "name": motion.name,
            "file_url": motion.file_url,
            "animation_path": motion.file_url,
            "duration_ms": motion.duration_ms,
            "description": motion.description,
            "tags": motion.tags if motion.tags else [],
            "created_at": motion.created_at.isoformat(),
            "updated_at": motion.updated_at.isoformat(),
            # 获取绑定该动作的角色
            "bound_characters": [
                {
                    "id": binding.character.id,
                    "name": binding.character.name,
                    "category": binding.category
                }
                for binding in motion.bindings
            ]
        }
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取动作详情失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{motion_id}", summary="更新动作", response_model=ResponseModel)
async def update_motion(
    motion_id: str,
    motion_update: MotionUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新动作"""
    try:
        # 检查动作是否存在
        motion = db.query(Motion).filter(Motion.id == motion_id).first()
        if not motion:
            raise HTTPException(status_code=404, detail="动作不存在")
        
        # 更新字段
        updates = motion_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        for key, value in updates.items():
            setattr(motion, key, value)
        
        db.commit()
        db.refresh(motion)
        
        # 构建响应
        data = {
            "id": motion.id,
            "name": motion.name,
            "file_url": motion.file_url,
            "animation_path": motion.file_url,
            "duration_ms": motion.duration_ms,
            "description": motion.description,
            "tags": motion.tags if motion.tags else [],
            "created_at": motion.created_at.isoformat(),
            "updated_at": motion.updated_at.isoformat(),
        }
        
        return {
            "code": 200,
            "message": "动作更新成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("更新动作失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", summary="上传动作文件", response_model=ResponseModel)
async def upload_motion(
    file: UploadFile = File(..., description="动作文件(.vrma)"),
    name: str = Form(..., description="动作名称"),
    description: Optional[str] = Form(None, description="动作描述"),
    tags: Optional[str] = Form(None, description="标签（逗号分隔）"),
    duration_ms: Optional[int] = Form(None, description="动作时长（毫秒）"),
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings)
) -> Dict[str, Any]:
    """上传动作文件"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.vrma'):
            raise HTTPException(status_code=400, detail="只支持.vrma文件")
        
        # 生成唯一的 5 位短 UUID
        from core.utils.short_uuid import generate_short_uuid
        
        motion_id = generate_short_uuid(5)
        
        # 检查 ID 是否已存在（极小概率冲突）
        while db.query(Motion).filter(Motion.id == motion_id).first():
            motion_id = generate_short_uuid(5)
        
        # 保存文件
        filename = f"{motion_id}.vrma"
        file_path = settings.vrm_motions_dir / filename
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 解析标签
        tag_list = []
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        
        # 如果没有提供持续时间，使用默认值
        if duration_ms is None:
            duration_ms = 2500  # 默认 2.5 秒
        
        # 保存到数据库
        motion = Motion(
            id=motion_id,
            name=name,
            duration_ms=duration_ms,
            description=description,
            tags=tag_list if tag_list else None
        )
        
        db.add(motion)
        db.commit()
        db.refresh(motion)
        
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "id": motion.id,
                "name": motion.name,
                "file_url": motion.file_url,
                "animation_path": motion.file_url,
                "duration_ms": motion.duration_ms,
                "description": motion.description,
                "tags": motion.tags if motion.tags else [],
                "created_at": motion.created_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # 清理文件
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink(missing_ok=True)
        
        logger.error("上传动作失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{motion_id}", summary="删除动作", response_model=ResponseModel)
async def delete_motion(
    motion_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除动作（会检查是否被角色绑定）"""
    try:
        # 检查动作是否存在
        motion = db.query(Motion).filter(Motion.id == motion_id).first()
        if not motion:
            raise HTTPException(status_code=404, detail="动作不存在")
        
        # 检查是否被引用
        references = check_motion_references(db, motion_id)
        if references:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "RESOURCE_IN_USE",
                    "message": f"无法删除动作，因为它被 {len(references)} 个角色绑定",
                    "referenced_by": references
                }
            )
        
        # 删除文件
        try:
            file_path = motion.get_file_path()
            if file_path.exists():
                file_path.unlink()
                logger.info(f"删除动作文件: {file_path}")
            else:
                logger.warning("动作文件不存在，跳过删除", extra={"path": str(file_path)})
        except Exception as e:
            logger.error("删除动作文件失败: {}", str(e), exc_info=True)
        
        # 删除数据库记录
        db.delete(motion)
        db.commit()
        
        return {
            "code": 200,
            "message": "动作删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("删除动作失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
