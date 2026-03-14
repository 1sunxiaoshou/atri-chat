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
router = APIRouter(prefix="/providers", tags=["Providers"])


@router.post("", response_model=ResponseModel)
async def create_provider(
    req: ProviderConfigRequest,
    db: Session = Depends(get_db)
):
    """创建供应商配置
    
    所有供应商通过 provider_type 指定使用哪个 Provider 实现类。
    可用的模板类型: openai, anthropic, google, qwen, local
    
    请求体示例:
    {
        "name": "DeepSeek",
        "provider_type": "openai",
        "config_payload": {
            "api_key": "sk-xxx",
            "base_url": "https://api.deepseek.com/v1"
        }
    }
    """
    try:
        agent_manager = get_agent_coordinator()
        
        # 确定模板类型
        provider_type = req.provider_type or "openai"
        
        # 验证模板类型并获取模板
        template = agent_manager.model_factory.get_provider_template(provider_type)
        if not template:
            available = agent_manager.model_factory.get_available_templates()
            raise HTTPException(
                status_code=400,
                detail=f"无效的 provider_type: {provider_type}，可用模板: {', '.join(available)}"
            )
        
        # 创建供应商配置
        provider = ProviderConfigORM(
            name=req.name,
            config_payload=req.config_payload,
            provider_type=provider_type
        )
        
        db.add(provider)
        db.commit()
        db.refresh(provider)
        
        return ResponseModel(
            code=200,
            message="供应商创建成功",
            data={
                "id": provider.id,
                "name": provider.name,
                "provider_type": provider_type
            }
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="供应商已存在")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建供应商失败: {e}")
        raise HTTPException(status_code=500, detail="创建失败")


@router.get("/{id}", response_model=ResponseModel)
async def get_provider(
    id: int,
    db: Session = Depends(get_db)
):
    """获取供应商配置"""
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取模板元数据
        agent_manager = get_agent_coordinator()
        template = agent_manager.model_factory.get_provider_template(provider.provider_type)
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "id": provider.id,
                "name": provider.name,
                "provider_type": provider.provider_type,
                "description": template.metadata.description if template else "",
                "config_payload": provider.config_payload,
                "created_at": provider.created_at.isoformat(),
                "updated_at": provider.updated_at.isoformat()
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取供应商失败: {e}")
        raise HTTPException(status_code=500, detail="获取失败")


@router.get("", response_model=ResponseModel)
async def list_providers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """列出所有供应商"""
    try:
        from sqlalchemy.orm import joinedload
        
        # 预加载 models 关系，避免 N+1 查询
        providers = db.query(ProviderConfigORM).options(
            joinedload(ProviderConfigORM.models)
        ).order_by(
            ProviderConfigORM.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        # 一次性获取所有模板元数据（而不是在循环中逐个获取）
        agent_manager = get_agent_coordinator()
        all_templates = agent_manager.model_factory.get_all_template_metadata()
        
        data = []
        for p in providers:
            template_metadata = all_templates.get(p.provider_type)
            
            data.append({
                "id": p.id,
                "name": p.name,
                "provider_type": p.provider_type,
                "description": template_metadata.description if template_metadata else "",
                "config_payload": p.config_payload,
                "model_count": len(p.models),  # 已预加载，不会触发查询
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat()
            })
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        logger.error(f"列出供应商失败: {e}")
        raise HTTPException(status_code=500, detail="列出失败")


@router.put("/{id}", response_model=ResponseModel)
async def update_provider(
    id: int,
    req: ProviderConfigUpdateRequest,
    db: Session = Depends(get_db)
):
    """更新供应商配置"""
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 如果更新了名称
        if req.name is not None:
            provider.name = req.name

        # 如果更新了 provider_type，验证
        if req.provider_type:
            agent_manager = get_agent_coordinator()
            template = agent_manager.model_factory.get_provider_template(req.provider_type)
            if not template:
                available = agent_manager.model_factory.get_available_templates()
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的 provider_type: {req.provider_type}，可用模板: {', '.join(available)}"
                )
            provider.provider_type = req.provider_type
        
        # 更新配置
        if req.config_payload is not None:
            provider.config_payload = req.config_payload
        
        db.commit()
        db.refresh(provider)
        
        return ResponseModel(
            code=200,
            message="更新成功",
            data={
                "id": provider.id,
                "name": provider.name
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新供应商失败: {e}")
        raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/{id}", response_model=ResponseModel)
async def delete_provider(
    id: int,
    db: Session = Depends(get_db)
):
    """删除供应商配置及其下所有模型"""
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == id
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
                "config_id": id,
                "deleted_models": model_ids,
                "deleted_count": model_count
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除供应商失败: {e}")
        raise HTTPException(status_code=500, detail="删除失败")


@router.get("/templates/list", response_model=ResponseModel)
async def list_provider_templates():
    """获取系统支持的所有供应商模板及其配置字段
    
    返回可用的供应商模板列表，用于创建供应商时指定 provider_type
    """
    try:
        agent_manager = get_agent_coordinator()
        templates = agent_manager.model_factory.get_all_template_metadata()
        
        data = [
            {
                "provider_type": metadata.provider_id,
                "name": metadata.name,
                "description": metadata.description,
                "config_fields": [
                    {
                        "field_name": field.field_name,
                        "field_type": field.field_type,
                        "required": field.required,
                        "sensitive": field.sensitive,
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
        logger.error(f"获取模板列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取模板列表失败")


@router.get("/{id}/models", response_model=ResponseModel)
async def get_provider_models(
    id: int,
    db: Session = Depends(get_db)
):
    """获取供应商已配置的模型列表"""
    try:
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        data = [
            {
                "id": m.id,
                "provider_config_id": m.provider_config_id,
                "model_id": m.model_id,
                "model_type": m.model_type,
                "has_vision": m.has_vision,
                "has_audio": m.has_audio,
                "has_video": m.has_video,
                "has_reasoning": m.has_reasoning,
                "has_tool_use": m.has_tool_use,
                "has_document": m.has_document,
                "has_structured_output": m.has_structured_output,
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
        logger.error(f"获取供应商模型失败: {e}")
        raise HTTPException(status_code=500, detail="获取模型失败")



@router.post("/{id}/sync", response_model=ResponseModel)
async def sync_provider_models(
    id: int,
    update_existing: bool = False,
    db: Session = Depends(get_db)
):
    """同步供应商模型列表"""
    try:
        from core.services.sync_service import ModelSyncService
        from core.dependencies import get_model_factory
        
        sync_service = ModelSyncService(db, get_model_factory())
        stats = sync_service.sync_provider_models(id, update_existing)
        
        return ResponseModel(
            code=200,
            message=f"同步完成: 新增 {stats['added']} 个，更新 {stats['updated']} 个，跳过 {stats['skipped']} 个，失败 {stats['failed']} 个",
            data=stats
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"同步模型过程异常: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}/available-models", response_model=ResponseModel)
async def list_available_models(
    id: int,
    db: Session = Depends(get_db)
):
    """获取供应商所有可用的模型列表（从 API 获取）"""
    try:
        agent_manager = get_agent_coordinator()
        
        # 获取供应商配置
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 获取 Provider 实例
        provider_template = agent_manager.model_factory.get_provider_template(provider.provider_type)
        if not provider_template:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持的供应商模板类型: {provider.provider_type}"
            )
        
        # 构造 ProviderConfig
        from core import ProviderConfig
        provider_instance_config = ProviderConfig(
            provider_id=provider.id,
            config_payload=provider.config_payload
        )
        
        # 调用 list_models 获取可用模型
        models = provider_template.list_models(provider_instance_config)
        
        # 转换为字典格式
        models_data = [
            {
                "model_id": m.model_id,
                "type": m.type.value,
                "nickname": m.nickname,
                "has_vision": m.has_vision,
                "has_audio": m.has_audio,
                "has_video": m.has_video,
                "has_reasoning": m.has_reasoning,
                "has_tool_use": m.has_tool_use,
                "has_document": m.has_document,
                "has_structured_output": m.has_structured_output,
                "context_window": m.context_window,
                "max_output": m.max_output
            }
            for m in models
        ]
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "config_id": id,
                "models": models_data
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取可用模型失败: {e}")
        raise HTTPException(status_code=500, detail="获取失败")
