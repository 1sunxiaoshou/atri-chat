"""供应商管理路由 (ORM 版本)"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api.schemas import (
    ResponseModel, 
    ProviderConfigRequest, 
    ProviderConfigUpdateRequest
)
from core.dependencies import get_db, get_agent_coordinator
from core.db import ProviderConfig as ProviderConfigORM, Model as ModelORM
from core import ProviderConfig, ModelConfig
from core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/providers", response_model=ResponseModel)
async def create_provider(
    req: ProviderConfigRequest,
    db: Session = Depends(get_db)
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
        provider = ProviderConfigORM(
            provider_id=req.provider_id,
            config_json=req.config_json,
            logo=logo,
            template_type=template_type
        )
        
        db.add(provider)
        db.commit()
        db.refresh(provider)
        
        return ResponseModel(
            code=200,
            message="供应商创建成功",
            data={
                "id": provider.id,
                "provider_id": req.provider_id,
                "template_type": template_type,
                "logo": logo
            }
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="供应商已存在")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建供应商失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_id}", response_model=ResponseModel)
async def get_provider(
    provider_id: str,
    db: Session = Depends(get_db)
):
    """获取供应商配置"""
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.provider_id == provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取模板元数据
        agent_manager = get_agent_coordinator()
        template = agent_manager.model_factory.get_provider_template(provider.template_type)
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "id": provider.id,
                "provider_id": provider.provider_id,
                "template_type": provider.template_type,
                "description": template.metadata.description if template else "",
                "config_json": provider.config_json,
                "logo": provider.logo,
                "created_at": provider.created_at.isoformat(),
                "updated_at": provider.updated_at.isoformat()
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取供应商失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers", response_model=ResponseModel)
async def list_providers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """列出所有供应商"""
    try:
        agent_manager = get_agent_coordinator()
        
        providers = db.query(ProviderConfigORM).order_by(
            ProviderConfigORM.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        data = []
        for p in providers:
            template = agent_manager.model_factory.get_provider_template(p.template_type)
            
            data.append({
                "id": p.id,
                "provider_id": p.provider_id,
                "template_type": p.template_type,
                "description": template.metadata.description if template else "",
                "config_json": p.config_json,
                "logo": p.logo,
                "model_count": len(p.models),
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat()
            })
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        logger.error(f"列出供应商失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/providers/update", response_model=ResponseModel)
async def update_provider(
    provider_id: str,
    req: ProviderConfigUpdateRequest,
    db: Session = Depends(get_db)
):
    """更新供应商配置
    
    查询参数:
    - provider_id: 供应商ID
    
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
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.provider_id == provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 如果更新了 template_type，验证并自动更新 logo
        if req.template_type:
            agent_manager = get_agent_coordinator()
            template = agent_manager.model_factory.get_provider_template(req.template_type)
            if not template:
                available = agent_manager.model_factory.get_available_templates()
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的 template_type: {req.template_type}，可用模板: {', '.join(available)}"
                )
            provider.template_type = req.template_type
            provider.logo = template.metadata.logo
        
        # 更新配置
        if req.config_json is not None:
            provider.config_json = req.config_json
        
        db.commit()
        db.refresh(provider)
        
        return ResponseModel(
            code=200,
            message="更新成功",
            data={
                "id": provider.id,
                "provider_id": provider.provider_id,
                "logo": provider.logo
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新供应商失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/providers/delete", response_model=ResponseModel)
async def delete_provider(
    provider_id: str,
    db: Session = Depends(get_db)
):
    """删除供应商配置及其下所有模型
    
    查询参数:
    - provider_id: 供应商ID
    
    注意：会级联删除该供应商下的所有模型
    """
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.provider_id == provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 统计信息
        model_count = len(provider.models)
        model_ids = [m.model_id for m in provider.models]
        
        # 删除供应商（会级联删除模型）
        db.delete(provider)
        db.commit()
        
        return ResponseModel(
            code=200,
            message="删除成功",
            data={
                "provider_id": provider_id,
                "deleted_models": model_ids,
                "deleted_count": model_count
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除供应商失败: {e}", exc_info=True)
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
        logger.error(f"获取模板列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_id}/models", response_model=ResponseModel)
async def get_provider_models(
    provider_id: str,
    db: Session = Depends(get_db)
):
    """获取供应商已配置的模型列表"""
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.provider_id == provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        data = [
            {
                "id": m.id,
                "provider_id": m.provider_id,
                "model_id": m.model_id,
                "model_type": m.model_type,
                "capabilities": m.capabilities,
                "context_window": m.context_window,
                "max_output": m.max_output,
                "enabled": m.enabled,
                "created_at": m.created_at.isoformat(),
                "updated_at": m.updated_at.isoformat()
            }
            for m in provider.models
        ]
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取供应商模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/providers/sync-models", response_model=ResponseModel)
async def sync_provider_models(
    provider_id: str,
    update_existing: bool = False,
    db: Session = Depends(get_db)
):
    """同步供应商模型列表
    
    从供应商 API 获取所有可用模型，并自动添加到系统中。
    
    查询参数:
    - provider_id: 供应商ID
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
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.provider_id == provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取 Provider 实例
        provider_template = agent_manager.model_factory.get_provider_template(provider.template_type)
        if not provider_template:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持的供应商模板类型: {provider.template_type}"
            )
        
        # 构造 ProviderConfig
        provider_config = ProviderConfig(
            provider_id=provider.provider_id,
            config_json=provider.config_json
        )
        
        # 调用 list_models 获取可用模型
        try:
            available_models = provider_template.list_models(provider_config)
        except Exception as e:
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
                existing_model = db.query(ModelORM).filter(
                    ModelORM.provider_id == provider_id,
                    ModelORM.model_id == model_info.model_id
                ).first()
                
                if existing_model:
                    if update_existing:
                        # 更新已存在的模型
                        existing_model.model_type = model_info.type.value
                        existing_model.capabilities = [c.value for c in model_info.capabilities]
                        existing_model.context_window = model_info.context_window
                        existing_model.max_output = model_info.max_output
                        updated_count += 1
                    else:
                        # 跳过已存在的模型
                        skipped_count += 1
                else:
                    # 添加新模型
                    new_model = ModelORM(
                        provider_id=provider_id,
                        model_id=model_info.model_id,
                        model_type=model_info.type.value,
                        capabilities=[c.value for c in model_info.capabilities],
                        context_window=model_info.context_window,
                        max_output=model_info.max_output,
                        enabled=False  # 新模型默认禁用
                    )
                    db.add(new_model)
                    added_count += 1
                    
            except Exception as e:
                failed_count += 1
                errors.append(f"{model_info.model_id}: {str(e)}")
        
        # 提交所有更改
        db.commit()
        
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
        db.rollback()
        logger.error(f"同步模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_id}/available-models", response_model=ResponseModel)
async def list_available_models(
    provider_id: str,
    db: Session = Depends(get_db)
):
    """获取供应商所有可用的模型列表（从 API 获取）
    
    此接口会调用供应商的 list_models() 方法，从供应商 API 获取所有可用模型。
    返回的模型包含类型、能力、上下文窗口等信息，可用于添加新模型到系统。
    """
    try:
        agent_manager = get_agent_coordinator()
        
        # 获取供应商配置
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.provider_id == provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取 Provider 实例
        provider_template = agent_manager.model_factory.get_provider_template(provider.template_type)
        if not provider_template:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持的供应商模板类型: {provider.template_type}"
            )
        
        # 构造 ProviderConfig
        provider_config = ProviderConfig(
            provider_id=provider.provider_id,
            config_json=provider.config_json
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
        logger.error(f"获取可用模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
