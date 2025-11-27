"""模型管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import ResponseModel, ModelRequest, ModelResponse
from core import AppStorage, ModelConfig, ModelType
from core.dependencies import get_storage

router = APIRouter()


@router.post("/models", response_model=ResponseModel)
async def create_model(
    req: ModelRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建模型"""
    try:
        model = ModelConfig(
            provider_id=req.provider_id,
            model_id=req.model_id,
            model_type=ModelType(req.model_type),
            mode=req.mode,
            enabled=req.enabled
        )
        success = app_storage.add_model(model)
        if not success:
            raise HTTPException(status_code=400, detail="模型已存在")
        return ResponseModel(
            code=200,
            message="模型创建成功",
            data={
                "provider_id": req.provider_id,
                "model_id": req.model_id
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{provider_id}/{model_id}", response_model=ResponseModel)
async def get_model(
    provider_id: str,
    model_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取模型"""
    try:
        model = app_storage.get_model(provider_id, model_id)
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "provider_id": model.provider_id,
                "model_id": model.model_id,
                "model_type": model.model_type.value,
                "mode": model.mode,
                "enabled": model.enabled
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", response_model=ResponseModel)
async def list_models(
    provider_id: str = None,
    model_type: str = None,
    enabled_only: bool = True,
    app_storage: AppStorage = Depends(get_storage)
):
    """列出模型"""
    try:
        model_type_enum = ModelType(model_type) if model_type else None
        models = app_storage.list_models(provider_id, model_type_enum, enabled_only)
        data = [
            {
                "provider_id": m.provider_id,
                "model_id": m.model_id,
                "model_type": m.model_type.value,
                "mode": m.mode,
                "enabled": m.enabled
            }
            for m in models
        ]
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/models/{provider_id}/{model_id}", response_model=ResponseModel)
async def update_model(
    provider_id: str,
    model_id: str,
    req: ModelRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """更新模型"""
    try:
        model = ModelConfig(
            provider_id=provider_id,
            model_id=model_id,
            model_type=ModelType(req.model_type),
            mode=req.mode,
            enabled=req.enabled
        )
        success = app_storage.update_model(model)
        if not success:
            raise HTTPException(status_code=404, detail="模型不存在")
        return ResponseModel(
            code=200,
            message="更新成功",
            data={
                "provider_id": provider_id,
                "model_id": model_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/models/{provider_id}/{model_id}", response_model=ResponseModel)
async def delete_model(
    provider_id: str,
    model_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """删除模型"""
    try:
        success = app_storage.delete_model(provider_id, model_id)
        if not success:
            raise HTTPException(status_code=404, detail="模型不存在")
        return ResponseModel(
            code=200,
            message="删除成功",
            data={
                "provider_id": provider_id,
                "model_id": model_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
