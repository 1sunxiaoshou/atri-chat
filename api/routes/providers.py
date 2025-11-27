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
    
    支持内置供应商和自定义 OpenAI 兼容供应商：
    - 内置供应商: openai, anthropic, google, tongyi, local
    - 自定义供应商: 任意名称，自动注册为 OpenAI 兼容供应商
    
    请求体示例:
    {
        "provider_id": "deepseek",  // 可以是任意名称
        "config_json": {
            "api_key": "sk-xxx",
            "base_url": "https://api.deepseek.com/v1"  // 自定义供应商需要提供 base_url
        }
    }
    """
    try:
        agent_manager = get_agent_manager()
        
        # 检查是否为内置供应商
        builtin_providers = ["openai", "anthropic", "google", "tongyi", "local"]
        is_builtin = req.provider_id in builtin_providers
        
        # 如果不是内置供应商，自动注册为 OpenAI 兼容供应商
        if not is_builtin:
            # 检查是否已注册
            if not agent_manager.model_factory.is_custom_openai_provider(req.provider_id):
                # 自动注册
                agent_manager.model_factory.register_custom_openai_provider(
                    provider_id=req.provider_id,
                    name=req.provider_id.title(),
                    description=f"Custom OpenAI-compatible provider"
                )
            
            # 验证必需的配置字段
            if "base_url" not in req.config_json:
                raise HTTPException(
                    status_code=400, 
                    detail="自定义供应商必须提供 base_url 配置"
                )
        
        # 创建供应商配置
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
            data={
                "provider_id": req.provider_id,
                "type": "builtin" if is_builtin else "custom_openai_compatible",
                "auto_registered": not is_builtin
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


@router.post("/providers/custom/openai-compatible", response_model=ResponseModel)
async def register_custom_openai_provider(
    provider_id: str,
    name: str,
    description: str = "",
    app_storage: AppStorage = Depends(get_storage)
):
    """预注册自定义 OpenAI 兼容供应商（可选）
    
    注意：通常不需要调用此接口，直接使用 POST /providers 即可自动注册
    
    此接口用于提前注册供应商，以便在 GET /providers/supported/list 中显示
    
    查询参数:
    - provider_id: 自定义供应商ID（如 "deepseek", "moonshot"）
    - name: 供应商名称（如 "DeepSeek", "Moonshot AI"）
    - description: 供应商描述（可选）
    """
    try:
        agent_manager = get_agent_manager()
        
        # 注册到 ModelFactory
        success = agent_manager.model_factory.register_custom_openai_provider(
            provider_id=provider_id,
            name=name,
            description=description
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="供应商ID已被注册")
        
        return ResponseModel(
            code=200,
            message="自定义供应商预注册成功",
            data={
                "provider_id": provider_id,
                "name": name,
                "description": description,
                "compatible_with": "openai",
                "note": "现在可以使用 POST /providers 创建配置"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/custom/openai-compatible", response_model=ResponseModel)
async def list_custom_openai_providers():
    """列出所有已注册的自定义 OpenAI 兼容供应商"""
    try:
        agent_manager = get_agent_manager()
        custom_providers = agent_manager.model_factory.list_custom_openai_providers()
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "custom_providers": custom_providers,
                "count": len(custom_providers)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
