"""VRM模型管理API"""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from core.dependencies import get_app_storage
from core.storage import AppStorage
from core.paths import get_path_manager
from core.logger import get_logger
from core.utils.file_naming import (
    generate_vrm_model_filename,
    generate_vrm_thumbnail_filename,
    extract_short_id_from_model_id,
)

logger = get_logger(__name__, category="API")

router = APIRouter(prefix="/vrm/models", tags=["VRM Models"])


# ==================== 辅助函数 ====================

def build_model_path(filename: str) -> str:
    """构建模型文件的URL路径
    
    Args:
        filename: 文件名
        
    Returns:
        URL路径，如 /uploads/vrm_models/xxx.vrm
    """
    return f"/uploads/vrm_models/{filename}"


def build_thumbnail_path(thumbnail_filename: Optional[str]) -> Optional[str]:
    """构建缩略图的URL路径
    
    Args:
        thumbnail_filename: 缩略图文件名
        
    Returns:
        URL路径，如 /uploads/vrm_thumbnails/xxx.jpg，或 None
    """
    if not thumbnail_filename:
        return None
    return f"/uploads/vrm_thumbnails/{thumbnail_filename}"


def get_file_path_from_filename(filename: str, is_thumbnail: bool = False) -> Path:
    """从文件名获取文件系统路径
    
    Args:
        filename: 文件名
        is_thumbnail: 是否为缩略图
        
    Returns:
        文件系统路径
    """
    path_manager = get_path_manager()
    if is_thumbnail:
        return path_manager.uploads_dir / "vrm_thumbnails" / filename
    else:
        return path_manager.uploads_dir / "vrm_models" / filename


# ==================== 请求模型 ====================

class VRMModelUpdate(BaseModel):
    """更新VRM模型"""
    name: Optional[str] = Field(None, description="模型名称")


# ==================== API端点 ====================


@router.get("", summary="获取所有VRM模型")
async def list_vrm_models(
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """获取所有VRM模型"""
    try:
        models = storage.list_vrm_models()
        
        # 为每个模型添加完整路径
        for model in models:
            model["model_path"] = build_model_path(model["filename"])
            model["thumbnail_path"] = build_thumbnail_path(model.get("thumbnail_filename"))
        
        logger.debug(f"获取VRM模型列表", extra={"count": len(models)})
        
        return {
            "success": True,
            "data": models
        }
        
    except Exception as e:
        logger.error(f"获取VRM模型列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{vrm_model_id}", summary="获取VRM模型详情")
async def get_vrm_model(
    vrm_model_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """获取VRM模型详情"""
    try:
        model = storage.get_vrm_model(vrm_model_id)
        
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        # 添加完整路径
        model["model_path"] = build_model_path(model["filename"])
        model["thumbnail_path"] = build_thumbnail_path(model.get("thumbnail_filename"))
        
        logger.debug(f"获取VRM模型详情", extra={"vrm_model_id": vrm_model_id})
        
        return {
            "success": True,
            "data": model
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取VRM模型详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{vrm_model_id}", summary="更新VRM模型")
async def update_vrm_model(
    vrm_model_id: str,
    model: VRMModelUpdate,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """更新VRM模型"""
    try:
        # 检查模型是否存在
        existing = storage.get_vrm_model(vrm_model_id)
        if not existing:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        # 更新
        updates = model.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        success = storage.update_vrm_model(vrm_model_id, **updates)
        
        if not success:
            raise HTTPException(status_code=400, detail="更新失败")
        
        logger.info(f"更新VRM模型成功", extra={"vrm_model_id": vrm_model_id})
        
        return {
            "success": True,
            "message": "VRM模型更新成功",
            "data": storage.get_vrm_model(vrm_model_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新VRM模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", summary="上传VRM模型文件")
async def upload_vrm_model(
    file: UploadFile = File(..., description="VRM文件"),
    name: str = Form(..., description="模型名称"),
    thumbnail: Optional[UploadFile] = File(None, description="缩略图文件（可选）"),
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """上传VRM模型文件（支持可选的缩略图上传）"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.vrm'):
            raise HTTPException(status_code=400, detail="只支持.vrm文件")
        
        # 生成唯一ID和文件名（使用新的命名方案）
        vrm_model_id, filename = generate_vrm_model_filename(name)
        
        # 保存VRM文件
        path_manager = get_path_manager()
        vrm_models_dir = path_manager.uploads_dir / "vrm_models"
        vrm_models_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = vrm_models_dir / filename
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 处理缩略图（如果提供）
        thumbnail_filename = None
        if thumbnail and thumbnail.filename:
            # 验证缩略图类型
            allowed_extensions = ['.png', '.jpg', '.jpeg']
            thumbnail_ext = Path(thumbnail.filename).suffix.lower()
            if thumbnail_ext not in allowed_extensions:
                raise HTTPException(status_code=400, detail="缩略图只支持PNG、JPG格式")
            
            # 保存缩略图（与模型文件同名）
            thumbnails_dir = path_manager.uploads_dir / "vrm_thumbnails"
            thumbnails_dir.mkdir(parents=True, exist_ok=True)
            
            short_id = extract_short_id_from_model_id(vrm_model_id)
            thumbnail_filename = generate_vrm_thumbnail_filename(name, short_id, thumbnail_ext)
            thumbnail_file_path = thumbnails_dir / thumbnail_filename
            
            with open(thumbnail_file_path, 'wb') as f:
                thumbnail_content = await thumbnail.read()
                f.write(thumbnail_content)
            
            logger.info(f"保存缩略图成功", extra={"thumbnail_filename": thumbnail_filename})
        
        # 保存到数据库（只存储文件名）
        success = storage.add_vrm_model(
            vrm_model_id=vrm_model_id,
            name=name,
            filename=filename,
            thumbnail_filename=thumbnail_filename if thumbnail else None
        )
        
        if not success:
            # 删除文件
            file_path.unlink(missing_ok=True)
            if thumbnail_filename:
                thumbnail_file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="保存到数据库失败")
        
        logger.info(
            f"上传VRM模型成功",
            extra={
                "vrm_model_id": vrm_model_id,
                "name": name,
                "filename": filename,
                "size": len(content),
                "has_thumbnail": thumbnail_filename is not None
            }
        )
        
        return {
            "success": True,
            "message": "上传成功",
            "data": {
                "vrm_model_id": vrm_model_id,
                "model_path": build_model_path(filename),
                "thumbnail_path": build_thumbnail_path(thumbnail_filename) if thumbnail_filename else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传VRM模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{vrm_model_id}", summary="删除VRM模型")
async def delete_vrm_model(
    vrm_model_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """删除VRM模型（会级联删除关联关系）"""
    try:
        # 检查模型是否存在
        existing = storage.get_vrm_model(vrm_model_id)
        if not existing:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        logger.info(
            f"准备删除VRM模型",
            extra={
                "vrm_model_id": vrm_model_id,
                "filename": existing.get("filename"),
                "thumbnail_filename": existing.get("thumbnail_filename")
            }
        )
        
        # 先删除文件，再删除数据库记录（这样如果文件删除失败，数据库记录还在）
        deleted_files = []
        
        # 删除模型文件
        try:
            model_file_path = get_file_path_from_filename(existing["filename"])
            logger.debug(
                f"尝试删除模型文件",
                extra={
                    "filename": existing["filename"],
                    "full_path": str(model_file_path),
                    "exists": model_file_path.exists()
                }
            )
            if model_file_path.exists():
                model_file_path.unlink()
                deleted_files.append("model")
                logger.info(f"删除模型文件成功", extra={"path": str(model_file_path)})
            else:
                logger.warning(f"模型文件不存在，跳过删除", extra={"path": str(model_file_path)})
        except Exception as e:
            logger.error(f"删除模型文件失败: {e}", exc_info=True)
        
        # 删除缩略图文件
        if existing.get("thumbnail_filename"):
            try:
                thumbnail_file_path = get_file_path_from_filename(existing["thumbnail_filename"], is_thumbnail=True)
                logger.debug(
                    f"尝试删除缩略图文件",
                    extra={
                        "thumbnail_filename": existing["thumbnail_filename"],
                        "full_path": str(thumbnail_file_path),
                        "exists": thumbnail_file_path.exists()
                    }
                )
                if thumbnail_file_path.exists():
                    thumbnail_file_path.unlink()
                    deleted_files.append("thumbnail")
                    logger.info(f"删除缩略图文件成功", extra={"path": str(thumbnail_file_path)})
                else:
                    logger.warning(f"缩略图文件不存在，跳过删除", extra={"path": str(thumbnail_file_path)})
            except Exception as e:
                logger.error(f"删除缩略图文件失败: {e}", exc_info=True)
        
        # 删除数据库记录
        success = storage.delete_vrm_model(vrm_model_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="删除数据库记录失败")
        
        logger.info(
            f"删除VRM模型成功",
            extra={
                "vrm_model_id": vrm_model_id,
                "deleted_files": deleted_files
            }
        )
        
        return {
            "success": True,
            "message": "VRM模型删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除VRM模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
