"""VRM模型-动作关联管理API"""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from core.dependencies import get_app_storage
from core.storage import AppStorage
from core.paths import get_path_manager
from core.logger import get_logger
from core.utils.file_naming import generate_animation_filename
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/vrm/models", tags=["VRM Model Animations"])


# ==================== 请求模型 ====================

class AddAnimationRequest(BaseModel):
    """添加动作请求"""
    animation_id: str = Field(..., description="动作ID")


class BatchAnimationsRequest(BaseModel):
    """批量操作动作请求"""
    animation_ids: List[str] = Field(..., description="动作ID列表")


# ==================== API端点 ====================

@router.post("/{vrm_model_id}/animations", summary="为模型添加动作", response_model=ResponseModel)
async def add_model_animation(
    vrm_model_id: str,
    request: AddAnimationRequest,
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """为模型添加动作"""
    try:
        # 检查模型是否存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        # 检查动作是否存在
        animation = storage.get_vrm_animation(request.animation_id)
        if not animation:
            raise HTTPException(status_code=404, detail="VRM动作不存在")
        
        # 添加关联
        success = storage.add_model_animation(vrm_model_id, request.animation_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="动作已关联到该模型")
        
        return ResponseModel(
            code=200,
            message="动作添加成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"添加模型动作关联失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{vrm_model_id}/animations/batch", summary="批量添加动作", response_model=ResponseModel)
async def batch_add_model_animations(
    vrm_model_id: str,
    request: BatchAnimationsRequest,
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """批量为模型添加动作"""
    try:
        # 检查模型是否存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        # 批量添加
        success_count = storage.batch_add_model_animations(vrm_model_id, request.animation_ids)
        
        return ResponseModel(
            code=200,
            message=f"成功添加 {success_count}/{len(request.animation_ids)} 个动作",
            data={
                "added_count": success_count,
                "total_count": len(request.animation_ids)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量添加模型动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{vrm_model_id}/animations/upload", summary="上传动作并关联到模型", response_model=ResponseModel)
async def upload_and_link_animation(
    vrm_model_id: str,
    file: UploadFile = File(..., description="动作文件(.vrma)"),
    name: str = Form(..., description="动作英文名"),
    name_cn: str = Form(..., description="动作中文名"),
    description: Optional[str] = Form(None, description="动作描述"),
    duration: Optional[float] = Form(None, description="动作时长（秒）"),
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """上传VRM动作文件并自动关联到模型"""
    try:
        # 验证模型存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
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
        
        # 关联到模型
        link_success = storage.add_model_animation(vrm_model_id, animation_id)
        if not link_success:
            logger.warning("动作已关联到模型", extra={"vrm_model_id": vrm_model_id, "animation_id": animation_id})
        
        logger.info(
            "上传并关联VRM动作成功",
            extra={
                "animation_id": animation_id,
                "vrm_model_id": vrm_model_id,
                "name": name,
                "size": len(content)
            }
        )
        
        return ResponseModel(
            code=200,
            message="上传并关联成功",
            data={
                "animation_id": animation_id,
                "animation_path": path_manager.build_vrm_animation_url(filename)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传并关联VRM动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{vrm_model_id}/animations", summary="获取模型的所有动作", response_model=ResponseModel)
async def get_model_animations(
    vrm_model_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """获取模型的所有动作"""
    try:
        # 检查模型是否存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        animations = storage.get_model_animations(vrm_model_id)
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=animations
        
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模型动作列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{vrm_model_id}/animations/{animation_id}", summary="移除模型的动作", response_model=ResponseModel)
async def remove_model_animation(
    vrm_model_id: str,
    animation_id: str,
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """移除模型的动作"""
    try:
        # 检查模型是否存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        # 移除关联
        success = storage.remove_model_animation(vrm_model_id, animation_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="该动作未关联到模型")
        
        return ResponseModel(
            code=200,
            message="动作移除成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"移除模型动作关联失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{vrm_model_id}/animations/batch", summary="批量移除动作", response_model=ResponseModel)
async def batch_remove_model_animations(
    vrm_model_id: str,
    request: BatchAnimationsRequest,
    storage: AppStorage = Depends(get_app_storage)
) -> ResponseModel:
    """批量移除模型的动作"""
    try:
        # 检查模型是否存在
        model = storage.get_vrm_model(vrm_model_id)
        if not model:
            raise HTTPException(status_code=404, detail="VRM模型不存在")
        
        # 批量移除
        removed_count = storage.batch_remove_model_animations(vrm_model_id, request.animation_ids)
        
        return ResponseModel(
            code=200,
            message=f"成功移除 {removed_count}/{len(request.animation_ids)} 个动作",
            data={
                "removed_count": removed_count,
                "total_count": len(request.animation_ids)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量移除模型动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
