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
            capabilities=req.capabilities,
            context_window=req.context_window,
            max_output=req.max_output,
            enabled=req.enabled
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
        logger.error("创建模型失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
                "capabilities": model.capabilities,
                "context_window": model.context_window,
                "max_output": model.max_output,
                "enabled": model.enabled,
                "created_at": model.created_at.isoformat(),
                "updated_at": model.updated_at.isoformat()
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取模型失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
                "capabilities": m.capabilities,
                "context_window": m.context_window,
                "max_output": m.max_output,
                "enabled": m.enabled,
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
        logger.error("列出模型失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        
        result = stmt.update({
            "model_type": req.model_type,
            "capabilities": req.capabilities,
            "context_window": req.context_window,
            "max_output": req.max_output,
            "enabled": req.enabled,
            "updated_at": datetime.utcnow()
        })
        
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
        logger.error("更新模型失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        logger.error("删除模型失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        
        metadata = template.metadata
        model_capabilities = set(model.capabilities)
        model_type = model.model_type
        
        # 过滤通用参数
        common_params = {}
        if metadata.common_parameters_schema:
            for param_name, param_schema in metadata.common_parameters_schema.items():
                # 检查 applicable_model_types
                applicable_types = param_schema.get("applicable_model_types", [])
                if applicable_types and model_type not in applicable_types:
                    continue
                
                # 检查 applicable_capabilities
                applicable_caps = param_schema.get("applicable_capabilities", [])
                if applicable_caps:
                    if not any(cap in model_capabilities for cap in applicable_caps):
                        continue
                
                # 复制 schema 以避免修改原始数据
                param_schema_copy = param_schema.copy()
                
                # 如果是 max_tokens 参数，根据模型的 max_output 动态设置最大值和默认值
                if param_name == "max_tokens" and model.max_output:
                    param_schema_copy["max"] = model.max_output
                    if param_schema_copy.get("use_max_as_default"):
                        param_schema_copy["default"] = model.max_output
                
                common_params[param_name] = param_schema_copy
        
        # 按 order 字段排序通用参数
        common_params = dict(sorted(
            common_params.items(),
            key=lambda x: x[1].get("order", 999)
        ))
        
        # 过滤供应商特定参数
        provider_params = {}
        if metadata.provider_options_schema:
            for param_name, param_schema in metadata.provider_options_schema.items():
                # 检查 applicable_capabilities
                applicable_caps = param_schema.get("applicable_capabilities", [])
                if applicable_caps:
                    if not any(cap in model_capabilities for cap in applicable_caps):
                        continue
                
                provider_params[param_name] = param_schema
        
        # 按 order 字段排序供应商参数
        provider_params = dict(sorted(
            provider_params.items(),
            key=lambda x: x[1].get("order", 999)
        ))
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "model_id": model.model_id,
                "provider_config_id": model.provider_config_id,
                "model_type": model.model_type,
                "capabilities": model.capabilities,
                "common_parameters": common_params,
                "provider_parameters": provider_params
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取模型参数 Schema 失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
