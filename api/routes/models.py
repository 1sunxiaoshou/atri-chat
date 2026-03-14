from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api.schemas import ResponseModel, ModelRequest, ModelResponse, ModelUpdateRequest
from core.dependencies import get_db
from core.db import Model as ModelORM, ProviderConfig as ProviderConfigORM
from core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/models", tags=["Models"])


@router.post("", response_model=ResponseModel)
async def create_model(
    req: ModelRequest,
    db: Session = Depends(get_db)
):
    """创建单个模型
    
    请求体示例:
    {
        "provider_id": "openai",
        "model_id": "gpt-4",
        "model_type": "chat",
        "capabilities": ["vision", "tool_use"],
        "context_window": 128000,
        "max_output": 4096,
        "enabled": true
    }
    """
    try:
        # 验证供应商是否存在
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == req.provider_config_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 创建模型
        model = ModelORM(
            provider_config_id=req.provider_config_id,
            model_id=req.model_id,
            model_type=req.model_type,
            has_vision=req.has_vision,
            has_audio=req.has_audio,
            has_video=req.has_video,
            has_reasoning=req.has_reasoning,
            has_tool_use=req.has_tool_use,
            has_document=req.has_document,
            has_structured_output=req.has_structured_output,
            context_window=req.context_window,
            max_output=req.max_output,
            enabled=req.enabled,
            parameters=req.parameters
        )
        
        db.add(model)
        db.commit()
        db.refresh(model)
        
        return ResponseModel(
            code=200,
            message="模型创建成功",
            data={
                "id": model.id,
                "provider_config_id": req.provider_config_id,
                "model_id": req.model_id
            }
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="模型已存在")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建模型失败: {e}")
        raise HTTPException(status_code=500, detail="创建失败")


@router.get("/{id}", response_model=ResponseModel)
async def get_model(
    id: int,
    db: Session = Depends(get_db)
):
    """获取模型详情
    
    路径参数:
    - id: 模型在数据库中的唯一 ID
    """
    try:
        model = db.query(ModelORM).filter(
            ModelORM.id == id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "id": model.id,
                "provider_config_id": model.provider_config_id,
                "model_id": model.model_id,
                "model_type": model.model_type,
                "has_vision": model.has_vision,
                "has_audio": model.has_audio,
                "has_video": model.has_video,
                "has_reasoning": model.has_reasoning,
                "has_tool_use": model.has_tool_use,
                "has_document": model.has_document,
                "has_structured_output": model.has_structured_output,
                "context_window": model.context_window,
                "max_output": model.max_output,
                "enabled": model.enabled,
                "parameters": model.parameters,
                "meta": model.meta,
                "created_at": model.created_at.isoformat(),
                "updated_at": model.updated_at.isoformat()
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模型失败: {e}")
        raise HTTPException(status_code=500, detail="获取模型详情失败")


@router.get("", response_model=ResponseModel)
async def list_models(
    provider_config_id: Optional[int] = None,
    model_type: Optional[str] = None,
    enabled_only: bool = False,
    db: Session = Depends(get_db)
):
    """列出模型
    
    查询参数:
    - provider_id: 供应商ID (可选)
    - model_type: 模型类型 chat/embedding/rerank (可选)
    - enabled_only: 仅显示启用的模型 (默认 false，显示所有模型)
    """
    try:
        query = db.query(ModelORM)
        
        # 按供应商过滤
        if provider_config_id:
            query = query.filter(ModelORM.provider_config_id == provider_config_id)
        
        # 按模型类型过滤
        if model_type:
            query = query.filter(ModelORM.model_type == model_type)
        
        # 仅显示启用的模型
        if enabled_only:
            query = query.filter(ModelORM.enabled == True)
        
        # 排序
        models = query.order_by(
            ModelORM.provider_config_id, ModelORM.created_at.desc()
        ).all()
        
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
                "parameters": m.parameters,
                "created_at": m.created_at.isoformat(),
                "updated_at": m.updated_at.isoformat()
            }
            for m in models
        ]
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        logger.error(f"列出模型失败: {e}")
        raise HTTPException(status_code=500, detail="列出失败")


@router.put("/{id}", response_model=ResponseModel)
async def update_model(
    id: int,
    req: ModelUpdateRequest,
    db: Session = Depends(get_db)
):
    """更新单个模型
    
    路径参数:
    - id: 模型在数据库中的唯一 ID
    
    请求体示例:
    {
        "model_type": "chat",
        "capabilities": ["vision", "tool_use"],
        "context_window": 128000,
        "max_output": 4096,
        "enabled": false
    }
    """
    try:
        # 使用更直接的 update 语句减少往返和内存开销
        stmt = db.query(ModelORM).filter(
            ModelORM.id == id
        )
        
        update_data = {
            "model_type": req.model_type,
            "context_window": req.context_window,
            "max_output": req.max_output,
            "enabled": req.enabled,
            "updated_at": datetime.utcnow()
        }
        
        # 仅在请求中存在时更新布尔值（支持局部更新，虽然 req 是全部字段，但 Optional 可控）
        for field in ["has_vision", "has_audio", "has_video", "has_reasoning", "has_tool_use", "has_document", "has_structured_output"]:
            val = getattr(req, field)
            if val is not None:
                update_data[field] = val

        if req.parameters is not None:
            update_data["parameters"] = req.parameters

        result = stmt.update(update_data)
        
        if result == 0:
            raise HTTPException(status_code=404, detail="模型不存在")
            
        db.commit()
        
        return ResponseModel(
            code=200,
            message="更新成功",
            data={
                "id": id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新模型失败: {e}")
        raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/{id}", response_model=ResponseModel)
async def delete_model(
    id: int,
    db: Session = Depends(get_db)
):
    """删除模型
    
    路径参数:
    - id: 模型在数据库中的唯一 ID
    """
    try:
        model = db.query(ModelORM).filter(
            ModelORM.id == id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        db.delete(model)
        db.commit()
        
        return ResponseModel(
            code=200,
            message="删除成功",
            data={
                "id": id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除模型失败: {e}")
        raise HTTPException(status_code=500, detail="删除失败")


@router.get("/{id}/parameter-schema", response_model=ResponseModel)
async def get_model_parameter_schema(
    id: int,
    db: Session = Depends(get_db)
):
    """获取模型的参数 Schema
    
    返回该模型可配置的所有参数，包括：
    1. 通用参数（temperature, max_tokens 等）
    2. 供应商特定参数（reasoning_effort 等）
    
    参数会根据模型的 capabilities 和 model_type 进行过滤
    
    路径参数:
    - model_uuid: 模型的 UUID
    """
    try:
        from core.dependencies import get_model_factory
        
        # 获取模型
        model = db.query(ModelORM).filter(ModelORM.id == id).first()
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        # 获取 Provider 模板
        model_factory = get_model_factory()
        provider = db.query(ProviderConfigORM).filter(
            ProviderConfigORM.id == model.provider_config_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        template = model_factory.get_provider_template(provider.provider_type)
        if not template:
            raise HTTPException(status_code=400, detail=f"不支持的供应商模板: {provider.provider_type}")
        
        # 调用模板的参数生成逻辑
        full_schema = template.get_parameters_schema(model.model_id, model.has_reasoning)
        
        # 将 schema 拆分为 common 和 provider 供前端分块展示
        common_keys = template.get_common_parameters_schema().keys()
        common_params = {k: v for k, v in full_schema.items() if k in common_keys}
        provider_params = {k: v for k, v in full_schema.items() if k not in common_keys}

        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "model_id": model.model_id,
                "provider_config_id": model.provider_config_id,
                "model_type": model.model_type,
                "has_vision": model.has_vision,
                "has_reasoning": model.has_reasoning,
                "common_parameters": common_params,
                "provider_parameters": provider_params
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模型参数 Schema 失败: {e}")
        raise HTTPException(status_code=500, detail="获取参数 Schema 失败")
