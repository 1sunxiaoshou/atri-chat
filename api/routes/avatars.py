"""形象资产管理 API (ORM 版本)"""
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Avatar
from core.db.utils import check_avatar_references, safe_delete_avatar, ResourceInUseError
from core.paths import get_path_manager
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/avatars", tags=["Avatars"])


# ==================== Pydantic 模型 ====================

class AvatarUpdate(BaseModel):
    """更新形象"""
    name: Optional[str] = Field(None, description="形象名称")


class AvatarResponse(BaseModel):
    """形象响应"""
    id: str
    name: str
    file_url: str
    thumbnail_url: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


# ==================== API 端点 ====================

@router.get("", summary="获取所有形象", response_model=ResponseModel)
async def list_avatars(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取所有形象
    
    支持分页和搜索
    """
    try:
        query = db.query(Avatar)
        
        # 搜索过滤
        if search:
            query = query.filter(Avatar.name.ilike(f"%{search}%"))
        
        # 分页
        avatars = query.offset(skip).limit(limit).all()
        
        path_manager = get_path_manager()
        
        # 构建响应
        data = [
            {
                "id": avatar.id,
                "name": avatar.name,
                "file_url": avatar.file_url,
                "thumbnail_url": avatar.thumbnail_url,
                "model_path": path_manager.build_url(avatar.file_url),
                "thumbnail_path": path_manager.build_url(avatar.thumbnail_url) if avatar.thumbnail_url else None,
                "created_at": avatar.created_at.isoformat(),
                "updated_at": avatar.updated_at.isoformat(),
            }
            for avatar in avatars
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except Exception as e:
        logger.error(f"获取形象列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{avatar_id}", summary="获取形象详情", response_model=ResponseModel)
async def get_avatar(
    avatar_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取形象详情"""
    try:
        avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
        
        if not avatar:
            raise HTTPException(status_code=404, detail="形象不存在")
        
        path_manager = get_path_manager()
        
        # 构建响应
        data = {
            "id": avatar.id,
            "name": avatar.name,
            "file_url": avatar.file_url,
            "thumbnail_url": avatar.thumbnail_url,
            "model_path": path_manager.build_url(avatar.file_url),
            "thumbnail_path": path_manager.build_url(avatar.thumbnail_url) if avatar.thumbnail_url else None,
            "created_at": avatar.created_at.isoformat(),
            "updated_at": avatar.updated_at.isoformat(),
            # 获取引用该形象的角色
            "referenced_by": [
                {"id": char.id, "name": char.name}
                for char in avatar.characters
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
        logger.error(f"获取形象详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{avatar_id}", summary="更新形象", response_model=ResponseModel)
async def update_avatar(
    avatar_id: str,
    avatar_update: AvatarUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新形象"""
    try:
        # 检查形象是否存在
        avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
        if not avatar:
            raise HTTPException(status_code=404, detail="形象不存在")
        
        # 更新字段
        updates = avatar_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        for key, value in updates.items():
            setattr(avatar, key, value)
        
        db.commit()
        db.refresh(avatar)
        
        path_manager = get_path_manager()
        
        # 构建响应
        data = {
            "id": avatar.id,
            "name": avatar.name,
            "file_url": avatar.file_url,
            "thumbnail_url": avatar.thumbnail_url,
            "model_path": path_manager.build_url(avatar.file_url),
            "thumbnail_path": path_manager.build_url(avatar.thumbnail_url) if avatar.thumbnail_url else None,
            "created_at": avatar.created_at.isoformat(),
            "updated_at": avatar.updated_at.isoformat(),
        }
        
        return {
            "code": 200,
            "message": "形象更新成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新形象失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", summary="上传形象文件", response_model=ResponseModel)
async def upload_avatar(
    file: UploadFile = File(..., description="VRM文件"),
    name: str = Form(..., description="形象名称"),
    thumbnail: Optional[UploadFile] = File(None, description="缩略图文件（可选）"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """上传形象文件（支持可选的缩略图上传）"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.vrm'):
            raise HTTPException(status_code=400, detail="只支持.vrm文件")
        
        # 生成唯一ID
        avatar_id = str(uuid.uuid4())
        
        # 保存VRM文件
        path_manager = get_path_manager()
        filename = f"{avatar_id}.vrm"
        file_path = path_manager.get_vrm_model_path(filename)
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 处理缩略图（如果提供）
        has_thumbnail = False
        if thumbnail and thumbnail.filename:
            # 验证缩略图类型
            allowed_extensions = ['.png', '.jpg', '.jpeg']
            thumbnail_ext = Path(thumbnail.filename).suffix.lower()
            if thumbnail_ext not in allowed_extensions:
                raise HTTPException(status_code=400, detail="缩略图只支持PNG、JPG格式")
            
            # 保存缩略图（统一使用 .jpg）
            thumbnail_filename = f"{avatar_id}.jpg"
            thumbnail_file_path = path_manager.get_vrm_thumbnail_path(thumbnail_filename)
            
            with open(thumbnail_file_path, 'wb') as f:
                thumbnail_content = await thumbnail.read()
                f.write(thumbnail_content)
            
            has_thumbnail = True
        
        # 保存到数据库
        avatar = Avatar(
            id=avatar_id,
            name=name,
            has_thumbnail=has_thumbnail
        )
        
        db.add(avatar)
        db.commit()
        db.refresh(avatar)
        
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "id": avatar.id,
                "name": avatar.name,
                "file_url": avatar.file_url,
                "thumbnail_url": avatar.thumbnail_url,
                "model_path": path_manager.build_url(avatar.file_url),
                "thumbnail_path": path_manager.build_url(avatar.thumbnail_url) if avatar.thumbnail_url else None,
                "created_at": avatar.created_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # 清理文件
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink(missing_ok=True)
        if 'thumbnail_file_path' in locals() and thumbnail_file_path.exists():
            thumbnail_file_path.unlink(missing_ok=True)
        
        logger.error(f"上传形象失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{avatar_id}", summary="删除形象", response_model=ResponseModel)
async def delete_avatar(
    avatar_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除形象（会检查是否被角色引用）"""
    try:
        # 检查形象是否存在
        avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
        if not avatar:
            raise HTTPException(status_code=404, detail="形象不存在")
        
        # 检查是否被引用
        references = check_avatar_references(db, avatar_id)
        if references:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "RESOURCE_IN_USE",
                    "message": f"无法删除形象，因为它被 {len(references)} 个角色引用",
                    "referenced_by": references
                }
            )
        
        path_manager = get_path_manager()
        
        # 删除文件
        deleted_files = []
        
        # 删除模型文件
        try:
            model_filename = f"{avatar_id}.vrm"
            model_file_path = path_manager.get_vrm_model_path(model_filename)
            if model_file_path.exists():
                model_file_path.unlink()
                deleted_files.append("model")
            else:
                logger.warning("模型文件不存在，跳过删除", extra={"path": str(model_file_path)})
        except Exception as e:
            logger.error(f"删除模型文件失败: {e}", exc_info=True)
        
        # 删除缩略图文件
        if avatar.has_thumbnail:
            try:
                thumbnail_filename = f"{avatar_id}.jpg"
                thumbnail_file_path = path_manager.get_vrm_thumbnail_path(thumbnail_filename)
                if thumbnail_file_path.exists():
                    thumbnail_file_path.unlink()
                    deleted_files.append("thumbnail")
                else:
                    logger.warning("缩略图文件不存在，跳过删除", extra={"path": str(thumbnail_file_path)})
            except Exception as e:
                logger.error(f"删除缩略图文件失败: {e}", exc_info=True)
        
        # 删除数据库记录
        db.delete(avatar)
        db.commit()
        
        return {
            "code": 200,
            "message": "形象删除成功",
            "data": {
                "deleted_files": deleted_files
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除形象失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
