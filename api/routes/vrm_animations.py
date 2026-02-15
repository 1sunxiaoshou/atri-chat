"""VRM动作管理API"""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from core.dependencies import get_app_storage
from core.storage import AppStorage
from core.paths import get_path_manager
from core.logger import get_logger
from core.utils.file_naming import generate_animation_filename
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/vrm/animations", tags=["VRM Animations"])


# ==================== 请求模型 ====================

class VRMAnimationUpdate(BaseModel):
    """更新VRM动作"""
    name_cn: Optional[str] = Field(None, description="中文名")
    description: Optional[str] = Field(None, description="动作描述")
    duration: Optional[float] = Field(None, description="动作时长（秒）")


# ==================== API端点 ====================


@router.get("", summary="获取所有VRM动作", response_model=ResponseModel)
async def list_vrm_animations(
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """获取所有VRM动作"""
    try:
        animations = storage.list_vrm_animations()
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=animations
        )
        
    except Exception as e:
        logger.error(f"获取VRM动作列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{animation_id}", summary="获取VRM动作详情", response_model=ResponseModel)
async def get_vrm_animation(
    animation_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """获取VRM动作详情"""
    try:
        animation = storage.get_vrm_animation(animation_id)
        
        if not animation:
            raise HTTPException(status_code=404, detail="VRM动作不存在")
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=animation
        )
        
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
        
        return ResponseModel(
            code=200,
            message="VRM动作更新成功",
            data=storage.get_vrm_animation(animation_id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新VRM动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", summary="上传VRM动作文件")
async def upload_vrm_animation(
    file: UploadFile = File(..., description="动作文件(.vrma)"),
    name: str = Form(..., description="动作英文名"),
    name_cn: str = Form(..., description="动作中文名"),
    description: Optional[str] = Form(None, description="动作描述"),
    duration: Optional[float] = Form(None, description="动作时长（秒）"),
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """上传VRM动作文件"""
    try:
        # 验证文件类型
        if not file.filename.endswith('.vrma'):
            raise HTTPException(status_code=400, detail="只支持.vrma文件")
        
        # 生成唯一ID和文件名（使用新的命名方案）
        file_ext = Path(file.filename).suffix
        animation_id, filename = generate_animation_filename(name, file_ext)
        
        # 保存文件（使用统一路径管理）
        path_manager = get_path_manager()
        file_path = path_manager.get_vrm_animation_path(filename)
        
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
        
        return ResponseModel(
            code=200,
            message="上传成功",
            data={
                "animation_id": animation_id,
                "animation_path": path_manager.build_vrm_animation_url(filename)
            }
        )
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
        
        return ResponseModel(
            code=200,
            message="VRM动作删除成功"
        )
        
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
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=models
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取动作关联的模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
