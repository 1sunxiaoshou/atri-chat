"""VRM动作管理API"""
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from core.dependencies import get_app_storage
from core.storage import AppStorage
from core.paths import get_path_manager
from core.logger import get_logger

logger = get_logger(__name__, category="API")

router = APIRouter(prefix="/vrm/animations", tags=["VRM Animations"])


# ==================== 请求模型 ====================

class VRMAnimationCreate(BaseModel):
    """创建VRM动作"""
    animation_id: str = Field(..., description="动作ID")
    name: str = Field(..., description="英文ID（唯一）")
    name_cn: str = Field(..., description="中文名")
    description: Optional[str] = Field(None, description="动作描述（供AI理解）")
    duration: Optional[float] = Field(None, description="动作时长（秒）")


class VRMAnimationUpdate(BaseModel):
    """更新VRM动作"""
    name: Optional[str] = Field(None, description="英文ID")
    name_cn: Optional[str] = Field(None, description="中文名")
    description: Optional[str] = Field(None, description="动作描述")
    duration: Optional[float] = Field(None, description="动作时长（秒）")


# ==================== API端点 ====================

@router.post("", summary="创建VRM动作")
async def create_vrm_animation(
    animation: VRMAnimationCreate,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """创建VRM动作"""
    try:
        success = storage.add_vrm_animation(
            animation_id=animation.animation_id,
            name=animation.name,
            name_cn=animation.name_cn,
            description=animation.description,
            duration=animation.duration
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="动作ID或英文名已存在")
        
        logger.info(f"创建VRM动作成功", extra={"animation_id": animation.animation_id, "name": animation.name})
        
        return {
            "success": True,
            "message": "VRM动作创建成功",
            "data": storage.get_vrm_animation(animation.animation_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建VRM动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", summary="获取所有VRM动作")
async def list_vrm_animations(
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """获取所有VRM动作"""
    try:
        animations = storage.list_vrm_animations()
        
        logger.debug(f"获取VRM动作列表", extra={"count": len(animations)})
        
        return {
            "success": True,
            "data": animations
        }
        
    except Exception as e:
        logger.error(f"获取VRM动作列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{animation_id}", summary="获取VRM动作详情")
async def get_vrm_animation(
    animation_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """获取VRM动作详情"""
    try:
        animation = storage.get_vrm_animation(animation_id)
        
        if not animation:
            raise HTTPException(status_code=404, detail="VRM动作不存在")
        
        logger.debug(f"获取VRM动作详情", extra={"animation_id": animation_id})
        
        return {
            "success": True,
            "data": animation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取VRM动作详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{animation_id}", summary="更新VRM动作")
async def update_vrm_animation(
    animation_id: str,
    animation: VRMAnimationUpdate,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """更新VRM动作"""
    try:
        # 检查动作是否存在
        existing = storage.get_vrm_animation(animation_id)
        if not existing:
            raise HTTPException(status_code=404, detail="VRM动作不存在")
        
        # 更新
        updates = animation.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        success = storage.update_vrm_animation(animation_id, **updates)
        
        if not success:
            raise HTTPException(status_code=400, detail="更新失败")
        
        logger.info(f"更新VRM动作成功", extra={"animation_id": animation_id})
        
        return {
            "success": True,
            "message": "VRM动作更新成功",
            "data": storage.get_vrm_animation(animation_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新VRM动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", summary="上传VRM动作文件")
async def upload_vrm_animation(
    file: UploadFile = File(..., description="动作文件(.fbx/.bvh)"),
    name: str = Form(..., description="动作英文名"),
    name_cn: str = Form(..., description="动作中文名"),
    description: Optional[str] = Form(None, description="动作描述"),
    duration: Optional[float] = Form(None, description="动作时长（秒）"),
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """上传VRM动作文件"""
    try:
        # 验证文件类型
        if not (file.filename.endswith('.fbx') or file.filename.endswith('.bvh')):
            raise HTTPException(status_code=400, detail="只支持.fbx或.bvh文件")
        
        # 生成唯一ID和文件名
        animation_id = f"anim-{uuid.uuid4()}"
        file_ext = Path(file.filename).suffix
        filename = f"{name}{file_ext}"
        
        # 保存文件
        path_manager = get_path_manager()
        animations_dir = path_manager.uploads_dir / "vrm_animations"
        animations_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = animations_dir / filename
        
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 保存到数据库
        success = storage.add_vrm_animation(
            animation_id=animation_id,
            name=name,
            name_cn=name_cn,
            description=description,
            duration=duration
        )
        
        if not success:
            # 删除文件
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="保存动作到数据库失败")
        
        logger.info(
            f"上传VRM动作成功",
            extra={
                "animation_id": animation_id,
                "name": name,
                "size": len(content)
            }
        )
        
        return {
            "success": True,
            "message": "上传成功",
            "data": {
                "animation_id": animation_id,
                "animation_path": f"/uploads/vrm_animations/{filename}"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传VRM动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{animation_id}", summary="删除VRM动作")
async def delete_vrm_animation(
    animation_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """删除VRM动作（会级联删除关联关系）"""
    try:
        # 检查动作是否存在
        existing = storage.get_vrm_animation(animation_id)
        if not existing:
            raise HTTPException(status_code=404, detail="VRM动作不存在")
        
        success = storage.delete_vrm_animation(animation_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="删除失败")
        
        logger.info(f"删除VRM动作成功", extra={"animation_id": animation_id})
        
        return {
            "success": True,
            "message": "VRM动作删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除VRM动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{animation_id}/models", summary="获取使用该动作的模型")
async def get_animation_models(
    animation_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """获取使用该动作的所有模型"""
    try:
        # 检查动作是否存在
        animation = storage.get_vrm_animation(animation_id)
        if not animation:
            raise HTTPException(status_code=404, detail="VRM动作不存在")
        
        models = storage.get_animation_models(animation_id)
        
        logger.debug(f"获取动作关联的模型", extra={"animation_id": animation_id, "count": len(models)})
        
        return {
            "success": True,
            "data": models
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取动作关联的模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
