"""音色资产管理 API (ORM 版本 - 新架构)"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from api.schemas import ResponseModel
from core.db import Character, TTSProvider, VoiceAsset
from core.dependencies import get_db
from core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/voice-assets", tags=["Voice Assets"])


# ==================== Pydantic 模型 ====================


class VoiceAssetCreate(BaseModel):
    """创建音色资产"""

    provider_id: int = Field(..., description="所属供应商 ID")
    name: str = Field(..., description="音色名称")
    voice_config: dict[str, Any] = Field(..., description="音色级别配置 JSON")


class VoiceAssetUpdate(BaseModel):
    """更新音色资产"""

    name: str | None = Field(None, description="音色名称")
    voice_config: dict[str, Any] | None = Field(None, description="音色级别配置 JSON")


class VoiceAssetResponse(BaseModel):
    """音色资产响应"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    name: str
    voice_config: dict[str, Any]
    created_at: str
    updated_at: str


# ==================== API 端点 ====================


@router.get("", summary="获取所有音色资产", response_model=ResponseModel)
async def list_voice_assets(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    provider_id: int | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """获取所有音色资产

    支持分页、搜索和按供应商过滤
    """
    try:
        query = db.query(VoiceAsset)

        # 搜索过滤
        if search:
            query = query.filter(VoiceAsset.name.ilike(f"%{search}%"))

        # 供应商过滤
        if provider_id:
            query = query.filter(VoiceAsset.provider_id == provider_id)

        # 分页
        voices = query.offset(skip).limit(limit).all()

        # 构建响应
        data = [
            {
                "id": voice.id,
                "provider_id": voice.provider_id,
                "name": voice.name,
                "voice_config": voice.voice_config,
                "created_at": voice.created_at.isoformat(),
                "updated_at": voice.updated_at.isoformat(),
                "provider": (
                    {
                        "id": voice.provider.id,
                        "name": voice.provider.name,
                        "provider_type": voice.provider.provider_type,
                    }
                    if voice.provider
                    else None
                ),
            }
            for voice in voices
        ]

        return {"code": 200, "message": "获取成功", "data": data}

    except Exception as e:
        logger.error(f"获取音色资产列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取列表失败") from e


@router.get("/{voice_id}", summary="获取音色资产详情", response_model=ResponseModel)
async def get_voice_asset(
    voice_id: int, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """获取音色资产详情"""
    try:
        voice = db.query(VoiceAsset).filter(VoiceAsset.id == voice_id).first()

        if not voice:
            raise HTTPException(status_code=404, detail="音色资产不存在")

        # 构建响应
        data = {
            "id": voice.id,
            "provider_id": voice.provider_id,
            "provider_name": voice.provider.name,
            "provider_type": voice.provider.provider_type,
            "name": voice.name,
            "voice_config": voice.voice_config,
            "created_at": voice.created_at.isoformat(),
            "updated_at": voice.updated_at.isoformat(),
            # 获取引用该音色的角色
            "referenced_by": [
                {"id": char.id, "name": char.name} for char in voice.characters
            ],
        }

        return {"code": 200, "message": "获取成功", "data": data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取音色资产详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取详情失败") from e


@router.post("", summary="创建音色资产", response_model=ResponseModel)
async def create_voice_asset(
    voice_create: VoiceAssetCreate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """创建音色资产"""
    try:
        # 检查供应商是否存在
        provider = (
            db.query(TTSProvider)
            .filter(TTSProvider.id == voice_create.provider_id)
            .first()
        )

        if not provider:
            raise HTTPException(status_code=404, detail="TTS 供应商不存在")

        # 创建音色资产
        voice = VoiceAsset(
            provider_id=voice_create.provider_id,
            name=voice_create.name,
            voice_config=voice_create.voice_config,
        )

        db.add(voice)
        db.commit()
        db.refresh(voice)

        return {
            "code": 200,
            "message": "创建成功",
            "data": {
                "id": voice.id,
                "provider_id": voice.provider_id,
                "provider_name": provider.name,
                "provider_type": provider.provider_type,
                "name": voice.name,
                "voice_config": voice.voice_config,
                "created_at": voice.created_at.isoformat(),
                "updated_at": voice.updated_at.isoformat(),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建音色资产失败: {e}")
        raise HTTPException(status_code=500, detail="创建失败") from e


@router.put("/{voice_id}", summary="更新音色资产", response_model=ResponseModel)
async def update_voice_asset(
    voice_id: int, voice_update: VoiceAssetUpdate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """更新音色资产"""
    try:
        # 检查音色资产是否存在
        voice = db.query(VoiceAsset).filter(VoiceAsset.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="音色资产不存在")

        # 更新字段
        updates = voice_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")

        for key, value in updates.items():
            setattr(voice, key, value)

        db.commit()
        db.refresh(voice)

        # 构建响应
        data = {
            "id": voice.id,
            "provider_id": voice.provider_id,
            "provider_name": voice.provider.name,
            "provider_type": voice.provider.provider_type,
            "name": voice.name,
            "voice_config": voice.voice_config,
            "created_at": voice.created_at.isoformat(),
            "updated_at": voice.updated_at.isoformat(),
        }

        return {"code": 200, "message": "音色资产更新成功", "data": data}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新音色资产失败: {e}")
        raise HTTPException(status_code=500, detail="更新失败") from e


@router.delete("/{voice_id}", summary="删除音色资产", response_model=ResponseModel)
async def delete_voice_asset(
    voice_id: int, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """删除音色资产（会检查是否被角色引用）"""
    try:
        # 检查音色资产是否存在
        voice = db.query(VoiceAsset).filter(VoiceAsset.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="音色资产不存在")

        # 检查是否被角色引用
        referenced_characters = (
            db.query(Character).filter(Character.voice_asset_id == voice_id).all()
        )

        if referenced_characters:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "RESOURCE_IN_USE",
                    "message": f"无法删除音色资产，因为它被 {len(referenced_characters)} 个角色引用",
                    "referenced_by": [
                        {"id": char.id, "name": char.name}
                        for char in referenced_characters
                    ],
                },
            )

        # 删除数据库记录
        db.delete(voice)
        db.commit()

        return {"code": 200, "message": "音色资产删除成功", "data": None}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除音色资产失败: {e}")
        raise HTTPException(status_code=500, detail="删除失败") from e
