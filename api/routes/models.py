"""模型管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import ResponseModel, ModelRequest, ModelResponse, ModelUpdateRequest
from core import AppStorage, ModelConfig, ModelType, Capability
from core.dependencies import get_storage

router = APIRouter()


@router.post("/models", response_model=ResponseModel)
async def create_model(
    req: ModelRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建模型
    
    请求体示例:
    {
        "provider_id": "openai",
        "model_id": "gpt-4",
        "model_type": "text",
        "capabilities": ["base", "chat", "vision"],
        "enabled": true
    }
    """
    try:
        capabilities = [Capability(c) for c in req.capabilities]
        model = ModelConfig(
            provider_id=req.provider_id,
            model_id=req.model_id,
            model_type=ModelType(req.model_type),
            capabilities=capabilities,
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的参数: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{provider_id}/{model_id}", response_model=ResponseModel)
async def get_model(
    provider_id: str,
    model_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取模型详情"""
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
                "capabilities": [c.value for c in model.capabilities],
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
    enabled_only: bool = False,
    app_storage: AppStorage = Depends(get_storage)
):
    """列出模型
    
    查询参数:
    - provider_id: 供应商ID (可选)
    - model_type: 模型类型 text/embedding/rerank (可选)
    - enabled_only: 仅显示启用的模型 (默认 false，显示所有模型)
    """
    try:
        model_type_enum = ModelType(model_type) if model_type else None
        models = app_storage.list_models(provider_id, model_type_enum, enabled_only)
        data = [
            {
                "provider_id": m.provider_id,
                "model_id": m.model_id,
                "model_type": m.model_type.value,
                "capabilities": [c.value for c in m.capabilities],
                "enabled": m.enabled
            }
            for m in models
        ]
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的参数: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/models/{provider_id}/{model_id}", response_model=ResponseModel)
async def update_model(
    provider_id: str,
    model_id: str,
    req: ModelUpdateRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """更新模型
    
    请求体示例:
    {
        "model_type": "text",
        "capabilities": ["vision", "function_calling"],
        "enabled": false
    }
    """
    try:
        capabilities = [Capability(c) for c in req.capabilities]
        model = ModelConfig(
            provider_id=provider_id,
            model_id=model_id,
            model_type=ModelType(req.model_type),
            capabilities=capabilities,
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的参数: {str(e)}")
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
