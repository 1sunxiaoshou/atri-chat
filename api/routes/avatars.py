"""形象资产管理 API (ORM 版本)"""
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Avatar
from core.db.utils import check_avatar_references
from core.config import get_settings, AppSettings
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
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings)
):
    """获取所有形象
    
    支持分页和搜索
    """
    try:
        import json
        
        query = db.query(Avatar)
        
        # 搜索过滤
        if search:
            query = query.filter(Avatar.name.ilike(f"%{search}%"))
        
        # 分页
        avatars = query.offset(skip).limit(limit).all()
        
        # 构建响应
        data = [
            {
                "id": avatar.id,
                "name": avatar.name,
                "file_url": avatar.file_url,
                "thumbnail_url": avatar.thumbnail_url,
                # 兼容旧字段：在新架构下直接使用属性
                "model_path": avatar.file_url,
                "thumbnail_path": avatar.thumbnail_url,
                "available_expressions": json.loads(avatar.available_expressions) if avatar.available_expressions else [],
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
        
    except Exception:
        logger.exception("获取形象列表失败")
        raise HTTPException(status_code=500, detail="获取列表失败")


@router.get("/{avatar_id}", summary="获取形象详情", response_model=ResponseModel)
async def get_avatar(
    avatar_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取形象详情"""
    try:
        import json
        
        avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
        
        if not avatar:
            raise HTTPException(status_code=404, detail="形象不存在")
        
        # 构建响应
        data = {
            "id": avatar.id,
            "name": avatar.name,
            "file_url": avatar.file_url,
            "thumbnail_url": avatar.thumbnail_url,
            "model_path": avatar.file_url,
            "thumbnail_path": avatar.thumbnail_url,
            "available_expressions": json.loads(avatar.available_expressions) if avatar.available_expressions else [],
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
    except Exception:
        logger.exception("获取形象详情失败")
        raise HTTPException(status_code=500, detail="获取详情失败")


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
        
        # 构建响应
        data = {
            "id": avatar.id,
            "name": avatar.name,
            "file_url": avatar.file_url,
            "thumbnail_url": avatar.thumbnail_url,
            "model_path": avatar.file_url,
            "thumbnail_path": avatar.thumbnail_url,
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
    except Exception:
        db.rollback()
        logger.exception("更新形象失败")
        raise HTTPException(status_code=500, detail="更新失败")


@router.post("/upload", summary="上传形象文件", response_model=ResponseModel)
async def upload_avatar(
    file: UploadFile = File(..., description="VRM文件"),
    name: str = Form(..., description="形象名称"),
    thumbnail: Optional[UploadFile] = File(None, description="缩略图文件（可选）"),
    expressions: Optional[str] = Form(None, description="表情列表（JSON数组字符串）"),
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings)
) -> Dict[str, Any]:
    """上传形象文件（支持可选的缩略图上传和表情列表）"""
    try:
        import json
        
        # 验证文件类型
        if not file.filename.endswith('.vrm'):
            raise HTTPException(status_code=400, detail="只支持.vrm文件")
        
        # 生成唯一ID
        avatar_id = str(uuid.uuid4())
        
        # 解析表情列表
        available_expressions = None
        if expressions:
            try:
                expressions_list = json.loads(expressions)
                if isinstance(expressions_list, list) and len(expressions_list) > 0:
                    available_expressions = expressions
                    logger.info(f"接收到表情列表: {expressions_list}")
            except json.JSONDecodeError:
                logger.warning(f"表情列表解析失败: {expressions}")
        
        # 保存VRM文件
        filename = f"{avatar_id}.vrm"
        file_path = settings.vrm_models_dir / filename
        
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
            thumbnail_file_path = settings.vrm_thumbnails_dir / thumbnail_filename
            
            with open(thumbnail_file_path, 'wb') as f:
                thumbnail_content = await thumbnail.read()
                f.write(thumbnail_content)
            
            has_thumbnail = True
        
        # 保存到数据库
        avatar = Avatar(
            id=avatar_id,
            name=name,
            has_thumbnail=has_thumbnail,
            available_expressions=available_expressions
        )
        
        db.add(avatar)
        db.commit()
        db.refresh(avatar)
        
        # 构建响应
        expressions_list = json.loads(available_expressions) if available_expressions else []
        
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "id": avatar.id,
                "name": avatar.name,
                "file_url": avatar.file_url,
                "thumbnail_url": avatar.thumbnail_url,
                "model_path": avatar.file_url,
                "thumbnail_path": avatar.thumbnail_url,
                "available_expressions": expressions_list,
                "created_at": avatar.created_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        # 清理文件
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink(missing_ok=True)
        if 'thumbnail_file_path' in locals() and thumbnail_file_path.exists():
            thumbnail_file_path.unlink(missing_ok=True)
        
        logger.exception("上传形象过程发生异常")
        raise HTTPException(status_code=500, detail="上传失败")


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
        
        # 删除文件
        deleted_files = []
        
        try:
            # 使用模型自带的方法获取路径
            model_file_path = avatar.get_file_path()
            if model_file_path.exists():
                model_file_path.unlink()
                deleted_files.append("model")
            else:
                logger.warning("模型文件不存在，跳过删除", extra={"path": str(model_file_path)})

            # 删除缩略图文件
            if avatar.has_thumbnail:
                thumbnail_file_path = avatar.get_thumbnail_path()
                if thumbnail_file_path and thumbnail_file_path.exists():
                    thumbnail_file_path.unlink()
                    deleted_files.append("thumbnail")
        except Exception as e:
            logger.exception("清理物理文件失败")
            
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
    except Exception:
        db.rollback()
        logger.exception("从数据库删除形象记录失败")
        raise HTTPException(status_code=500, detail="删除失败")
