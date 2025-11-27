"""供应商管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import (
    ResponseModel, 
    ProviderConfigRequest, 
    ProviderConfigUpdateRequest
)
from core import AppStorage, ProviderConfig
from core.dependencies import get_storage, get_agent_manager

router = APIRouter()


@router.post("/providers", response_model=ResponseModel)
async def create_provider(
    req: ProviderConfigRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建供应商配置
    
    请求体示例:
    {
        "provider_id": "openai",
        "config_json": {
            "api_key": "sk-xxx",
            "base_url": "https://api.openai.com/v1"
        }
    }
    """
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
    except HTTPException:
        raise
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
    req: ProviderConfigUpdateRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """更新供应商配置
    
    请求体示例:
    {
        "config_json": {
            "api_key": "sk-xxx",
            "base_url": "https://api.openai.com/v1",
            "temperature": 0.7
        }
    }
    
    注意：temperature 和 max_tokens 等参数可以在这里配置默认值，
    也可以在创建模型时动态传入（优先级：运行时参数 > 配置参数 > 模型默认值）
    """
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
    """删除供应商配置及其下所有模型和依赖的角色"""
    try:
        agent_manager = get_agent_manager()
        
        # 检查依赖
        dependencies = agent_manager.model_factory.check_provider_dependencies(provider_id)
        
        # 删除依赖的模型
        for model_id in dependencies["models"]:
            app_storage.delete_model(provider_id, model_id)
        
        # 删除供应商
        success = app_storage.delete_provider(provider_id)
        if not success:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        return ResponseModel(
            code=200,
            message="删除成功",
            data={
                "provider_id": provider_id,
                "deleted_models": dependencies["models"],
                "affected_characters": dependencies["characters"]
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/supported/list", response_model=ResponseModel)
async def list_supported_providers():
    """获取系统支持的所有供应商类型及其配置字段"""
    try:
        agent_manager = get_agent_manager()
        supported = agent_manager.model_factory.get_all_provider_metadata()
        
        data = [
            {
                "provider_id": metadata.provider_id,
                "name": metadata.name,
                "description": metadata.description,
                "config_fields": [
                    {
                        "field_name": field.field_name,
                        "field_type": field.field_type,
                        "required": field.required,
                        "default_value": field.default_value,
                        "description": field.description
                    }
                    for field in metadata.config_fields
                ]
            }
            for metadata in supported.values()
        ]
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_id}/models", response_model=ResponseModel)
async def get_provider_models(
    provider_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取供应商已配置的模型列表"""
    try:
        models = app_storage.list_models(provider_id=provider_id, enabled_only=False)
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
