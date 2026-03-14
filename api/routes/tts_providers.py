"""TTS 供应商管理 API (ORM 版本)"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import TTSProvider, VoiceAsset
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/tts-providers", tags=["TTS Providers"])


# ==================== Pydantic 模型 ====================

class TTSProviderCreate(BaseModel):
    """创建 TTS 供应商"""
    provider_type: str = Field(..., description="供应商类型（openai/gpt_sovits/azure）")
    name: str = Field(..., description="供应商名称")
    config_payload: Dict[str, Any] = Field(..., description="供应商级别配置 JSON")


class TTSProviderUpdate(BaseModel):
    """更新 TTS 供应商"""
    name: Optional[str] = Field(None, description="供应商名称")
    config_payload: Optional[Dict[str, Any]] = Field(None, description="供应商级别配置 JSON")


class TTSProviderResponse(BaseModel):
    """TTS 供应商响应"""
    id: int
    provider_type: str
    name: str
    config_payload: Dict[str, Any]
    created_at: str
    updated_at: str
    voice_count: int = Field(0, description="该供应商下的音色数量")
    
    class Config:
        from_attributes = True


# ==================== API 端点 ====================

@router.get("", summary="获取所有 TTS 供应商", response_model=ResponseModel)
async def list_providers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    provider_type: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取所有 TTS 供应商
    
    支持分页、搜索和过滤
    """
    try:
        query = db.query(TTSProvider)
        
        # 搜索过滤
        if search:
            query = query.filter(TTSProvider.name.ilike(f"%{search}%"))
        
        if provider_type:
            query = query.filter(TTSProvider.provider_type == provider_type)
        
        # 分页
        providers = query.offset(skip).limit(limit).all()
        
        # 构建响应
        data = [
            {
                "id": provider.id,
                "provider_type": provider.provider_type,
                "name": provider.name,
                "config_payload": provider.config_payload,
                "updated_at": provider.updated_at.isoformat(),
                "voice_count": len(provider.voices)
            }
            for provider in providers
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except Exception:
        logger.exception("获取 TTS 供应商列表失败")
        raise HTTPException(status_code=500, detail="获取列表失败")


@router.get("/{provider_id}", summary="获取 TTS 供应商详情", response_model=ResponseModel)
async def get_provider(
    provider_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取 TTS 供应商详情"""
    try:
        provider = db.query(TTSProvider).filter(TTSProvider.id == provider_id).first()
        
        if not provider:
            raise HTTPException(status_code=404, detail="TTS 供应商不存在")
        
        # 构建响应
        data = {
            "id": provider.id,
            "provider_type": provider.provider_type,
            "name": provider.name,
            "config_payload": provider.config_payload,
            "updated_at": provider.updated_at.isoformat(),
            "voice_count": len(provider.voices),
            # 获取该供应商下的所有音色
            "voices": [
                {
                    "id": voice.id,
                    "name": voice.name,
                    "created_at": voice.created_at.isoformat()
                }
                for voice in provider.voices
            ]
        }
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("获取 TTS 供应商详情失败")
        raise HTTPException(status_code=500, detail="获取详情失败")


@router.post("", summary="创建 TTS 供应商", response_model=ResponseModel)
async def create_provider(
    provider_create: TTSProviderCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """创建 TTS 供应商"""
    try:
        # 验证供应商类型
        from core.tts.registry import TTSRegistry
        try:
            TTSRegistry.get_provider_class(provider_create.provider_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"无效的供应商类型: {provider_create.provider_type}"
            )
        
        # 创建供应商
        provider = TTSProvider(
            provider_type=provider_create.provider_type,
            name=provider_create.name,
            config_payload=provider_create.config_payload
        )
        
        db.add(provider)
        db.commit()
        db.refresh(provider)
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": {
                "id": provider.id,
                "provider_type": provider.provider_type,
                "name": provider.name,
                "config_payload": provider.config_payload,
                "updated_at": provider.updated_at.isoformat(),
                "voice_count": 0
            }
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("创建 TTS 供应商失败")
        raise HTTPException(status_code=500, detail="创建失败")


@router.put("/{provider_id}", summary="更新 TTS 供应商", response_model=ResponseModel)
async def update_provider(
    provider_id: int,
    provider_update: TTSProviderUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新 TTS 供应商"""
    try:
        # 检查供应商是否存在
        provider = db.query(TTSProvider).filter(TTSProvider.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="TTS 供应商不存在")
        
        # 更新字段
        updates = provider_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        for key, value in updates.items():
            setattr(provider, key, value)
        
        db.commit()
        db.refresh(provider)
        
        # 构建响应
        data = {
            "id": provider.id,
            "provider_type": provider.provider_type,
            "name": provider.name,
            "config_payload": provider.config_payload,
            "updated_at": provider.updated_at.isoformat(),
            "voice_count": len(provider.voices)
        }
        
        return {
            "code": 200,
            "message": "TTS 供应商更新成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("更新 TTS 供应商失败")
        raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/{provider_id}", summary="删除 TTS 供应商", response_model=ResponseModel)
async def delete_provider(
    provider_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除 TTS 供应商（级联删除所有音色）"""
    try:
        # 检查供应商是否存在
        provider = db.query(TTSProvider).filter(TTSProvider.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="TTS 供应商不存在")
        
        # 检查是否有音色被角色引用
        voice_ids = [voice.id for voice in provider.voices]
        if voice_ids:
            from core.db import Character
            referenced_characters = db.query(Character).filter(
                Character.voice_asset_id.in_(voice_ids)
            ).all()
            
            if referenced_characters:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error": "RESOURCE_IN_USE",
                        "message": f"无法删除供应商，因为其音色被 {len(referenced_characters)} 个角色引用",
                        "referenced_by": [
                            {"id": char.id, "name": char.name}
                            for char in referenced_characters
                        ]
                    }
                )
        
        # 删除供应商（级联删除音色）
        db.delete(provider)
        db.commit()
        
        return {
            "code": 200,
            "message": "TTS 供应商删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("删除 TTS 供应商失败")
        raise HTTPException(status_code=500, detail="删除失败")


@router.get("/types/list", summary="获取支持的供应商类型列表", response_model=ResponseModel)
async def list_provider_types() -> Dict[str, Any]:
    """获取支持的 TTS 供应商类型列表（从注册中心动态获取）"""
    from core.tts.registry import TTSRegistry
    
    types = []
    for provider_id, (provider_class, display_name) in TTSRegistry.get_all_providers().items():
        types.append({
            "id": provider_id,
            "name": display_name,
            "description": f"{display_name} 语音服务"
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": types
    }


@router.get("/types/{provider_type}/template", summary="获取供应商配置模板", response_model=ResponseModel)
async def get_provider_template(provider_type: str) -> Dict[str, Any]:
    """获取指定供应商类型的配置模板（UI 元数据）
    
    用于前端动态生成配置表单
    
    注意：模板中的 level 字段用于指导前端：
    - level="provider": 应该保存到 TTSProvider.config_payload
    - level="voice": 应该保存到 VoiceAsset.voice_config
    """
    from core.tts.registry import TTSRegistry
    
    try:
        provider_class = TTSRegistry.get_provider_class(provider_type)
        template = provider_class.get_config_template()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "provider_type": provider_type,
                "provider_name": TTSRegistry.get_provider_name(provider_type),
                "template": template
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        logger.exception("获取配置模板失败")
        raise HTTPException(status_code=500, detail="获取模板失败")


@router.post("/{provider_id}/test", summary="测试 TTS 供应商配置", response_model=ResponseModel)
async def test_provider(
    provider_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """测试 TTS 供应商配置是否可用"""
    from core.tts.factory import TTSFactory
    
    try:
        # 获取供应商
        provider = db.query(TTSProvider).filter(TTSProvider.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="TTS 供应商不存在")
        
        # 创建临时实例测试
        factory = TTSFactory()
        tts_instance = factory.create_tts(
            provider_type=provider.provider_type,
            config=provider.config_payload
        )
        
        # 测试连接
        result = await tts_instance.test_connection()
        
        return {
            "code": 200 if result["success"] else 400,
            "message": result["message"],
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("测试 TTS 供应商失败")
        return {
            "code": 500,
            "message": f"测试失败: {str(e)}",
            "data": {"success": False}
        }
