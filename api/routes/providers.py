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
    
    所有供应商通过 template_type 指定使用哪个 Provider 实现类。
    可用的模板类型: openai, anthropic, google, tongyi, local
    
    请求体示例:
    {
        "provider_id": "deepseek",
        "name": "DeepSeek",
        "template_type": "openai",
        "config_json": {
            "api_key": "sk-xxx",
            "base_url": "https://api.deepseek.com/v1"
        }
    }
    """
    try:
        agent_manager = get_agent_manager()
        
        # 确定模板类型
        template_type = req.template_type or "openai"
        
        # 验证模板类型并获取模板
        template = agent_manager.model_factory.get_provider_template(template_type)
        if not template:
            available = agent_manager.model_factory.get_available_templates()
            raise HTTPException(
                status_code=400,
                detail=f"无效的 template_type: {template_type}，可用模板: {', '.join(available)}"
            )
        
        # Logo 从模板元数据中获取
        logo = template.metadata.logo
        
        # 创建供应商配置
        config = ProviderConfig(
            provider_id=req.provider_id,
            config_json=req.config_json
        )
        success = app_storage.add_provider(
            config,
            name=req.name,
            logo=logo,
            template_type=template_type
        )
        if not success:
            raise HTTPException(status_code=400, detail="供应商已存在")
        
        return ResponseModel(
            code=200,
            message="供应商创建成功",
            data={
                "provider_id": req.provider_id,
                "name": req.name,
                "template_type": template_type,
                "logo": logo
            }
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
        
        # 获取模板元数据
        agent_manager = get_agent_manager()
        template_type = provider.get("template_type", "openai")
        template = agent_manager.model_factory.get_provider_template(template_type)
        
        # Logo 从模板元数据中获取
        logo = template.metadata.logo if template else provider.get("logo")
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "provider_id": provider["provider_id"],
                "name": provider["name"],
                "template_type": template_type,
                "description": template.metadata.description if template else "",
                "config_json": provider["config_json"],
                "logo": logo
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
        agent_manager = get_agent_manager()
        providers = app_storage.list_providers()
        
        data = []
        for p in providers:
            template_type = p.get("template_type", "openai")
            template = agent_manager.model_factory.get_provider_template(template_type)
            
            # Logo 从模板元数据中获取
            logo = template.metadata.logo if template else p.get("logo")
            
            data.append({
                "provider_id": p["provider_id"],
                "name": p["name"],
                "template_type": template_type,
                "description": template.metadata.description if template else "",
                "config_json": p["config_json"],
                "logo": logo
            })
        
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
        "name": "OpenAI",
        "template_type": "openai",
        "config_json": {
            "api_key": "sk-xxx",
            "base_url": "https://api.openai.com/v1"
        }
    }
    """
    try:
        # 如果更新了 template_type，验证并自动更新 logo
        logo = None
        if req.template_type:
            agent_manager = get_agent_manager()
            template = agent_manager.model_factory.get_provider_template(req.template_type)
            if not template:
                available = agent_manager.model_factory.get_available_templates()
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的 template_type: {req.template_type}，可用模板: {', '.join(available)}"
                )
            logo = template.metadata.logo
        
        success = app_storage.update_provider(
            provider_id=provider_id,
            name=req.name,
            config_json=req.config_json,
            logo=logo,
            template_type=req.template_type
        )
        if not success:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        return ResponseModel(
            code=200,
            message="更新成功",
            data={"provider_id": provider_id, "logo": logo}
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
    """删除供应商配置及其下所有模型
    
    注意：不会删除使用该供应商的角色，但这些角色的模型引用会失效
    """
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


@router.get("/providers/templates/list", response_model=ResponseModel)
async def list_provider_templates():
    """获取系统支持的所有供应商模板及其配置字段
    
    返回可用的供应商模板列表，用于创建供应商时指定 template_type
    """
    try:
        agent_manager = get_agent_manager()
        templates = agent_manager.model_factory.get_all_template_metadata()
        
        data = [
            {
                "template_type": metadata.provider_id,
                "name": metadata.name,
                "description": metadata.description,
                "logo": metadata.logo,
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
            for metadata in templates.values()
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



