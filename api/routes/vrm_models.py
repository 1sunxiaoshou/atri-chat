"""VRM模型管理API"""
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

router = APIRouter(prefix="/vrm/models", tags=["VRM Models"])


# ==================== 请求模型 ====================

class VRMModelCreate(BaseModel):
    """创建VRM模型"""
    vrm_model_id: str = Field(..., description="模型ID")
    name: str = Field(..., description="模型名称")
    model_path: str = Field(..., description="模型文件路径")
    thumbnail_path: Optional[str] = Field(None, description="缩略图路径")


class VRMModelUpdate(BaseModel):
    """更新VRM模型"""
    name: Optional[str] = Field(None, description="模型名称")
    model_path: Optional[str] = Field(None, description="模型文件路径")
    thumbnail_path: Optional[str] = Field(None, description="缩略图路径")


# ==================== API端点 ====================

@router.post("", summary="创建VRM模型")
async def create_vrm_model(
    model: VRMModelCreate,
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """创建VRM模型"""
    try:
        success = storage.add_vrm_model(
            vrm_model_id=model.vrm_model_id,
            name=model.name,
            model_path=model.model_path,
            thumbnail_path=model.thumbnail_path
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="模型ID已存在")
        
        logger.info(f"创建VRM模型成功", extra={"vrm_model_id": model.vrm_model_id})
        
        return {
            "success": True,
            "message": "VRM模型创建成功",
            "data": storage.get_vrm_model(model.vrm_model_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建VRM模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", summary="获取所有VRM模型")
async def list_vrm_models(
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
    """获取所有VRM模型"""
    try:
        models = storage.list_vrm_models()
        
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
    thumbnail_path: Optional[str] = Form(None, description="缩略图路径"),
    storage: AppStorage = Depends(get_app_storage)
) -> Dict[str, Any]:
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
            thumbnail_path=thumbnail_path
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
            "success": True,
            "message": "上传成功",
            "data": {
                "vrm_model_id": vrm_model_id,
                "model_path": model_path
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
        
        # 删除数据库记录
        success = storage.delete_vrm_model(vrm_model_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="删除失败")
        
        # 删除文件
        try:
            path_manager = get_path_manager()
            file_path = path_manager.root_dir / existing["model_path"].lstrip('/')
            file_path.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"删除模型文件失败: {e}")
        
        logger.info(f"删除VRM模型成功", extra={"vrm_model_id": vrm_model_id})
        
        return {
            "success": True,
            "message": "VRM模型删除成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除VRM模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
