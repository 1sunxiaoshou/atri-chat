"""供应商管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import (
    ResponseModel, 
    ProviderConfigRequest, 
    ProviderConfigUpdateRequest
)
from core import AppStorage, ProviderConfig, ModelConfig
from core.dependencies import get_storage, get_agent_coordinator

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
        agent_manager = get_agent_coordinator()
        
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
        agent_manager = get_agent_coordinator()
        template_type = provider.get("template_type", "openai")
        template = agent_manager.model_factory.get_provider_template(template_type)
        
        # Logo 从模板元数据中获取
        logo = template.metadata.logo if template else provider.get("logo")
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "provider_id": provider["provider_id"],
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
        agent_manager = get_agent_coordinator()
        providers = app_storage.list_providers()
        
        data = []
        for p in providers:
            template_type = p.get("template_type", "openai")
            template = agent_manager.model_factory.get_provider_template(template_type)
            
            # Logo 从模板元数据中获取
            logo = template.metadata.logo if template else p.get("logo")
            
            data.append({
                "provider_id": p["provider_id"],
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
            agent_manager = get_agent_coordinator()
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
        agent_manager = get_agent_coordinator()
        
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
        agent_manager = get_agent_coordinator()
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
                ],
                "provider_options_schema": metadata.provider_options_schema
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
                "context_window": m.context_window,
                "max_output": m.max_output,
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


@router.post("/providers/{provider_id}/models/sync", response_model=ResponseModel)
async def sync_provider_models(
    provider_id: str,
    update_existing: bool = False,
    app_storage: AppStorage = Depends(get_storage)
):
    """同步供应商模型列表
    
    从供应商 API 获取所有可用模型，并自动添加到系统中。
    
    查询参数:
    - update_existing: 是否更新已存在的模型信息 (默认 false，只添加新模型)
    
    返回:
    - added: 新添加的模型数量
    - updated: 更新的模型数量
    - skipped: 跳过的模型数量
    - failed: 失败的模型数量
    - errors: 错误详情列表
    """
    try:
        agent_manager = get_agent_coordinator()
        
        # 获取供应商配置
        provider_config_dict = app_storage.get_provider(provider_id)
        if not provider_config_dict:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取 Provider 实例
        template_type = provider_config_dict.get("template_type", "openai")
        provider_template = agent_manager.model_factory.get_provider_template(template_type)
        if not provider_template:
            raise HTTPException(status_code=400, detail=f"不支持的供应商模板类型: {template_type}")
        
        # 构造 ProviderConfig
        from core import ProviderConfig
        provider_config = ProviderConfig(
            provider_id=provider_config_dict["provider_id"],
            config_json=provider_config_dict["config_json"]
        )
        
        # 调用 list_models 获取可用模型
        try:
            available_models = provider_template.list_models(provider_config)
        except Exception as e:
            # API 调用失败，记录日志并返回错误信息
            from core.logger import get_logger
            logger = get_logger(__name__)
            logger.error(f"同步模型失败 [{provider_id}]: {str(e)}")
            
            raise HTTPException(status_code=400, detail=str(e))
        
        # 统计信息
        added_count = 0
        updated_count = 0
        skipped_count = 0
        failed_count = 0
        errors = []
        
        # 遍历所有模型
        for model_info in available_models:
            try:
                # 检查模型是否已存在
                existing_model = app_storage.get_model(provider_id, model_info.model_id)
                
                if existing_model:
                    if update_existing:
                        # 更新已存在的模型
                        model = ModelConfig(
                            provider_id=provider_id,
                            model_id=model_info.model_id,
                            model_type=model_info.type,
                            capabilities=model_info.capabilities,
                            context_window=model_info.context_window,
                            max_output=model_info.max_output,
                            enabled=existing_model.enabled  # 保持原有的启用状态
                        )
                        success = app_storage.update_model(model)
                        if success:
                            updated_count += 1
                        else:
                            failed_count += 1
                            errors.append(f"{model_info.model_id}: 更新失败")
                    else:
                        # 跳过已存在的模型
                        skipped_count += 1
                else:
                    # 添加新模型
                    model = ModelConfig(
                        provider_id=provider_id,
                        model_id=model_info.model_id,
                        model_type=model_info.type,
                        capabilities=model_info.capabilities,
                        context_window=model_info.context_window,
                        max_output=model_info.max_output,
                        enabled=False  # 新模型默认禁用
                    )
                    success = app_storage.add_model(model)
                    if success:
                        added_count += 1
                    else:
                        failed_count += 1
                        errors.append(f"{model_info.model_id}: 添加失败")
            except Exception as e:
                failed_count += 1
                errors.append(f"{model_info.model_id}: {str(e)}")
        
        return ResponseModel(
            code=200,
            message=f"同步完成: 新增 {added_count} 个，更新 {updated_count} 个，跳过 {skipped_count} 个，失败 {failed_count} 个",
            data={
                "provider_id": provider_id,
                "total": len(available_models),
                "added": added_count,
                "updated": updated_count,
                "skipped": skipped_count,
                "failed": failed_count,
                "errors": errors if errors else None
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
async def list_available_models(
    provider_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取供应商所有可用的模型列表（从 API 获取）
    
    此接口会调用供应商的 list_models() 方法，从供应商 API 获取所有可用模型。
    返回的模型包含类型、能力、上下文窗口等信息，可用于添加新模型到系统。
    """
    try:
        agent_manager = get_agent_coordinator()
        
        # 获取供应商配置
        provider_config_dict = app_storage.get_provider(provider_id)
        if not provider_config_dict:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取 Provider 实例
        template_type = provider_config_dict.get("template_type", "openai")
        provider_template = agent_manager.model_factory.get_provider_template(template_type)
        if not provider_template:
            raise HTTPException(status_code=400, detail=f"不支持的供应商模板类型: {template_type}")
        
        # 构造 ProviderConfig
        from core import ProviderConfig
        provider_config = ProviderConfig(
            provider_id=provider_config_dict["provider_id"],
            config_json=provider_config_dict["config_json"]
        )
        
        # 调用 list_models 获取可用模型
        models = provider_template.list_models(provider_config)
        
        # 转换为字典格式
        models_data = [
            {
                "model_id": m.model_id,
                "type": m.type.value,
                "nickname": m.nickname,
                "capabilities": [c.value for c in m.capabilities],
                "context_window": m.context_window,
                "max_output": m.max_output
            }
            for m in models
        ]
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "provider_id": provider_id,
                "models": models_data
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



