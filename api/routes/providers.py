"""供应商管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import ResponseModel, ProviderConfigRequest, ProviderConfigResponse
from core import AppStorage, ProviderConfig
from core.dependencies import get_storage

router = APIRouter()


@router.post("/providers", response_model=ResponseModel)
async def create_provider(
    req: ProviderConfigRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建供应商配置"""
    try:
        config = ProviderConfig(
            provider_id=req.provider_id,
            config_json=req.config_json
        )
        success = app_storage.add_provider(config)
        if not success:
            raise HTTPException(status_code=400, detail="供应商已存在")
        return ResponseModel(
            code=200,
            message="供应商创建成功",
            data={"provider_id": req.provider_id}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_id}", response_model=ResponseModel)
async def get_provider(
    provider_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取供应商配置"""
    try:
        provider = app_storage.get_provider(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "provider_id": provider.provider_id,
                "config_json": provider.config_json
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers", response_model=ResponseModel)
async def list_providers(app_storage: AppStorage = Depends(get_storage)):
    """列出所有供应商"""
    try:
        providers = app_storage.list_providers()
        data = [
            {
                "provider_id": p.provider_id,
                "config_json": p.config_json
            }
            for p in providers
        ]
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/providers/{provider_id}", response_model=ResponseModel)
async def update_provider(
    provider_id: str,
    req: ProviderConfigRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """更新供应商配置"""
    try:
        config = ProviderConfig(
            provider_id=provider_id,
            config_json=req.config_json
        )
        success = app_storage.update_provider(config)
        if not success:
            raise HTTPException(status_code=404, detail="供应商不存在")
        return ResponseModel(
            code=200,
            message="更新成功",
            data={"provider_id": provider_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/providers/{provider_id}", response_model=ResponseModel)
async def delete_provider(
    provider_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """删除供应商配置"""
    try:
        success = app_storage.delete_provider(provider_id)
        if not success:
            raise HTTPException(status_code=404, detail="供应商不存在")
        return ResponseModel(
            code=200,
            message="删除成功",
            data={"provider_id": provider_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
