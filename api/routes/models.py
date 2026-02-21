"""模型管理路由 (ORM 版本)"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api.schemas import ResponseModel, ModelRequest, ModelResponse, ModelUpdateRequest
from core.dependencies import get_db
from core.db import Model as ModelORM, ProviderConfig as ProviderConfigORM
from core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/models", response_model=ResponseModel)
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
            ProviderConfigORM.provider_id == req.provider_id
        ).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="供应商不存在")
        
        # 创建模型
        model = ModelORM(
            provider_id=req.provider_id,
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
                "provider_id": req.provider_id,
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
        logger.error(f"创建模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/detail", response_model=ResponseModel)
async def get_model(
    provider_id: str,
    model_id: str,
    db: Session = Depends(get_db)
):
    """获取模型详情
    
    查询参数:
    - provider_id: 供应商ID
    - model_id: 模型ID
    """
    try:
        model = db.query(ModelORM).filter(
            ModelORM.provider_id == provider_id,
            ModelORM.model_id == model_id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "id": model.id,
                "provider_id": model.provider_id,
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
        logger.error(f"获取模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", response_model=ResponseModel)
async def list_models(
    provider_id: Optional[str] = None,
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
        if provider_id:
            query = query.filter(ModelORM.provider_id == provider_id)
        
        # 按模型类型过滤
        if model_type:
            query = query.filter(ModelORM.model_type == model_type)
        
        # 仅显示启用的模型
        if enabled_only:
            query = query.filter(ModelORM.enabled == True)
        
        # 排序
        models = query.order_by(
            ModelORM.provider_id, ModelORM.created_at.desc()
        ).all()
        
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
            for m in models
        ]
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        logger.error(f"列出模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/models/update", response_model=ResponseModel)
async def update_model(
    provider_id: str,
    model_id: str,
    req: ModelUpdateRequest,
    db: Session = Depends(get_db)
):
    """更新单个模型
    
    查询参数:
    - provider_id: 供应商ID
    - model_id: 模型ID
    
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
        model = db.query(ModelORM).filter(
            ModelORM.provider_id == provider_id,
            ModelORM.model_id == model_id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        # 更新字段
        model.model_type = req.model_type
        model.capabilities = req.capabilities
        model.context_window = req.context_window
        model.max_output = req.max_output
        model.enabled = req.enabled
        
        db.commit()
        db.refresh(model)
        
        return ResponseModel(
            code=200,
            message="更新成功",
            data={
                "id": model.id,
                "provider_id": provider_id,
                "model_id": model_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/models/delete", response_model=ResponseModel)
async def delete_model(
    provider_id: str,
    model_id: str,
    db: Session = Depends(get_db)
):
    """删除模型
    
    查询参数:
    - provider_id: 供应商ID
    - model_id: 模型ID
    """
    try:
        model = db.query(ModelORM).filter(
            ModelORM.provider_id == provider_id,
            ModelORM.model_id == model_id
        ).first()
        
        if not model:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        db.delete(model)
        db.commit()
        
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
        db.rollback()
        logger.error(f"删除模型失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
