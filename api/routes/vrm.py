"""VRM资源管理API"""
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel, Field
from core.dependencies import get_app_storage
from core.storage import AppStorage
from core.paths import get_path_manager
from core.logger import get_logger

logger = get_logger(__name__, category="API")
router = APIRouter()


# ==================== 数据模型 ====================

class VRMModelResponse(BaseModel):
    """VRM模型响应"""
    vrm_model_id: str
    name: str
    model_path: str
    thumbnail_path: Optional[str]
    description: Optional[str]
    created_at: str


class VRMAnimationResponse(BaseModel):
    """VRM动作响应"""
    animation_id: str
    vrm_model_id: str
    name: str
    name_cn: str
    animation_path: str
    duration: Optional[float]
    type: str


class VRMModelDetailResponse(BaseModel):
    """VRM模型详情响应（包含动作列表）"""
    vrm_model_id: str
    name: str
    model_path: str
    thumbnail_path: Optional[str]
    description: Optional[str]
    created_at: str
    animations: list[VRMAnimationResponse]


# ==================== VRM模型管理 ====================

@router.get("/models", summary="列出所有VRM模型")
async def list_vrm_models(storage: AppStorage = Depends(get_app_storage)):
    """列出所有VRM模型"""
    try:
        models = storage.list_vrm_models()
        logger.info(f"获取VRM模型列表", extra={"count": len(models)})
        return {
            "code": 200,
            "message": "获取成功",
            "data": models
        }
    except Exception as e:
        logger.error(f"获取VRM模型列表失败", extra={"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/models/{vrm_model_id}", summary="获取VRM模型详情")
async def get_vrm_model(
    vrm_model_id: str,
    storage: AppStorage = Depends(get_app_storage)
):
    """获取VRM模型详情（包含动作列表）"""
    try:
        # 获取模型信息
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail=f"VRM模型 {vrm_model_id} 不存在")
        
        # 获取动作列表
        animations = storage.list_vrm_animations(vrm_model_id)
        
        logger.info(
            f"获取VRM模型详情",
            extra={"vrm_model_id": vrm_model_id, "animation_count": len(animations)}
        )
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                **model,
                "animations": animations
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"获取VRM模型详情失败",
            extra={"vrm_model_id": vrm_model_id, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/models/upload", summary="上传VRM模型")
async def upload_vrm_model(
    file: UploadFile = File(..., description="VRM文件"),
    name: str = Form(..., description="模型名称"),
    description: Optional[str] = Form(None, description="模型描述"),
    storage: AppStorage = Depends(get_app_storage)
):
    """上传VRM模型文件"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.vrm'):
            raise HTTPException(status_code=400, detail="只支持.vrm文件")
        
        # 生成唯一ID和文件名
        vrm_model_id = f"vrm-{uuid.uuid4()}"
        filename = f"{vrm_model_id}.vrm"
        
        # 保存文件
        path_manager = get_path_manager()
        vrm_models_dir = path_manager.uploads_dir / "vrm_models"
        vrm_models_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = vrm_models_dir / filename
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 保存到数据库
        model_path = f"/uploads/vrm_models/{filename}"
        success = storage.add_vrm_model(
            vrm_model_id=vrm_model_id,
            name=name,
            model_path=model_path,
            description=description
        )
        
        if not success:
            # 删除文件
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="保存到数据库失败")
        
        logger.info(
            f"上传VRM模型成功",
            extra={
                "vrm_model_id": vrm_model_id,
                "name": name,
                "size": len(content)
            }
        )
        
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "vrm_model_id": vrm_model_id,
                "model_path": model_path
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传VRM模型失败", extra={"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.delete("/models/{vrm_model_id}", summary="删除VRM模型")
async def delete_vrm_model(
    vrm_model_id: str,
    storage: AppStorage = Depends(get_app_storage)
):
    """删除VRM模型（同时删除关联的动作）"""
    try:
        # 获取模型信息
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail=f"VRM模型 {vrm_model_id} 不存在")
        
        # 删除数据库记录
        success = storage.delete_vrm_model(vrm_model_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除失败")
        
        # 删除文件
        path_manager = get_path_manager()
        file_path = path_manager.root_dir / model["model_path"].lstrip('/')
        file_path.unlink(missing_ok=True)
        
        logger.info(f"删除VRM模型成功", extra={"vrm_model_id": vrm_model_id})
        
        return {
            "code": 200,
            "message": "删除成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"删除VRM模型失败",
            extra={"vrm_model_id": vrm_model_id, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


# ==================== VRM动作管理 ====================

@router.get("/models/{vrm_model_id}/animations", summary="列出VRM模型的动作")
async def list_vrm_animations(
    vrm_model_id: str,
    storage: AppStorage = Depends(get_app_storage)
):
    """列出指定VRM模型的所有动作"""
    try:
        # 验证模型存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail=f"VRM模型 {vrm_model_id} 不存在")
        
        animations = storage.list_vrm_animations(vrm_model_id)
        
        logger.info(
            f"获取VRM动作列表",
            extra={"vrm_model_id": vrm_model_id, "count": len(animations)}
        )
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": animations
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"获取VRM动作列表失败",
            extra={"vrm_model_id": vrm_model_id, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/models/{vrm_model_id}/animations/upload", summary="上传VRM动作")
async def upload_vrm_animation(
    vrm_model_id: str,
    file: UploadFile = File(..., description="动作文件(.fbx/.bvh)"),
    name: str = Form(..., description="动作英文名"),
    name_cn: str = Form(..., description="动作中文名"),
    duration: Optional[float] = Form(None, description="动作时长（秒）"),
    anim_type: str = Form("short", description="动作类型: short/medium/long"),
    storage: AppStorage = Depends(get_app_storage)
):
    """上传VRM动作文件"""
    try:
        # 验证模型存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail=f"VRM模型 {vrm_model_id} 不存在")
        
        # 验证文件类型
        if not (file.filename.endswith('.fbx') or file.filename.endswith('.bvh')):
            raise HTTPException(status_code=400, detail="只支持.fbx或.bvh文件")
        
        # 生成唯一ID和文件名
        animation_id = f"anim-{uuid.uuid4()}"
        file_ext = Path(file.filename).suffix
        filename = f"{name}{file_ext}"
        
        # 保存文件
        path_manager = get_path_manager()
        animations_dir = path_manager.uploads_dir / "vrm_animations" / vrm_model_id
        animations_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = animations_dir / filename
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 保存到数据库
        animation_path = f"/uploads/vrm_animations/{vrm_model_id}/{filename}"
        success = storage.add_vrm_animation(
            animation_id=animation_id,
            vrm_model_id=vrm_model_id,
            name=name,
            name_cn=name_cn,
            animation_path=animation_path,
            duration=duration,
            anim_type=anim_type
        )
        
        if not success:
            # 删除文件
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="保存到数据库失败")
        
        logger.info(
            f"上传VRM动作成功",
            extra={
                "animation_id": animation_id,
                "vrm_model_id": vrm_model_id,
                "name": name,
                "size": len(content)
            }
        )
        
        return {
            "code": 200,
            "message": "上传成功",
            "data": {
                "animation_id": animation_id,
                "animation_path": animation_path
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"上传VRM动作失败",
            extra={"vrm_model_id": vrm_model_id, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.delete("/animations/{animation_id}", summary="删除VRM动作")
async def delete_vrm_animation(
    animation_id: str,
    storage: AppStorage = Depends(get_app_storage)
):
    """删除VRM动作"""
    try:
        # 获取动作信息
        animation = storage.get_vrm_animation(animation_id)
        if not animation:
            raise HTTPException(status_code=404, detail=f"VRM动作 {animation_id} 不存在")
        
        # 删除数据库记录
        success = storage.delete_vrm_animation(animation_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除失败")
        
        # 删除文件
        path_manager = get_path_manager()
        file_path = path_manager.root_dir / animation["animation_path"].lstrip('/')
        file_path.unlink(missing_ok=True)
        
        logger.info(f"删除VRM动作成功", extra={"animation_id": animation_id})
        
        return {
            "code": 200,
            "message": "删除成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"删除VRM动作失败",
            extra={"animation_id": animation_id, "error": str(e)},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
