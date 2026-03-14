"""角色管理 API (ORM 版本)"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Character, Avatar, VoiceAsset, Model, Motion, CharacterMotionBinding
from core.db.utils import (
    validate_avatar_exists, validate_voice_asset_exists,
    validate_model_exists, InvalidReferenceError
)
from core.config import get_settings, AppSettings
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter()


# ==================== Pydantic 模型 ====================

class MotionBindingInput(BaseModel):
    """动作绑定输入"""
    motion_id: str = Field(..., description="动作 ID")
    category: str = Field(..., description="分类（initial/idle/thinking/reply）")


class CharacterCreate(BaseModel):
    """创建角色"""
    name: str = Field(..., description="角色名称")
    system_prompt: str = Field("你是一个友好、乐于助人的AI助手。", description="系统提示词")
    portrait_url: Optional[str] = Field(None, description="2D立绘/头像URL")
    avatar_id: Optional[str] = Field(None, description="3D形象资产ID（可选）")
    voice_asset_id: Optional[int] = Field(None, description="音色资产 ID（可选）")
    voice_speaker_id: Optional[str] = Field(None, description="音色说话人 ID（可选）")
    primary_model_id: Optional[int] = Field(None, description="主模型 ID（可选）")
    primary_provider_config_id: Optional[int] = Field(None, description="主供应商配置 ID（可选）")
    enabled: bool = Field(True, description="是否启用")
    motion_bindings: Optional[List[MotionBindingInput]] = Field(None, description="动作绑定列表（可选）")


class CharacterUpdate(BaseModel):
    """更新角色"""
    name: Optional[str] = Field(None, description="角色名称")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    portrait_url: Optional[str] = Field(None, description="2D立绘/头像URL")
    avatar_id: Optional[str] = Field(None, description="3D形象资产ID")
    voice_asset_id: Optional[int] = Field(None, description="音色资产 ID")
    voice_speaker_id: Optional[str] = Field(None, description="音色说话人 ID")
    primary_model_id: Optional[int] = Field(None, description="主模型 ID")
    primary_provider_config_id: Optional[int] = Field(None, description="主供应商配置 ID")
    enabled: Optional[bool] = Field(None, description="是否启用")


# ==================== API 端点 ====================

@router.get("/characters", summary="获取所有角色", response_model=ResponseModel)
async def list_characters(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    enabled: Optional[bool] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取所有角色
    
    支持分页、搜索和过滤
    """
    try:
        from sqlalchemy.orm import joinedload, selectinload
        
        # 使用 joinedload/selectinload 预加载所有关联数据，避免 N+1 查询
        query = db.query(Character).options(
            joinedload(Character.avatar),
            joinedload(Character.voice_asset).joinedload(VoiceAsset.provider),
            joinedload(Character.primary_model),
            selectinload(Character.motion_bindings)
        )
        
        # 搜索过滤
        if search:
            query = query.filter(Character.name.ilike(f"%{search}%"))
        
        # 启用状态过滤
        if enabled is not None:
            query = query.filter(Character.enabled == enabled)
        
        # 分页
        characters = query.offset(skip).limit(limit).all()
        
        # 构建响应
        data = [
            {
                "id": char.id,
                "name": char.name,
                "system_prompt": char.system_prompt,
                "portrait_url": char.portrait_url,
                "avatar_id": char.avatar_id,
                "avatar_name": char.avatar.name if char.avatar else None,
                "avatar_thumbnail": char.avatar.thumbnail_url if char.avatar else None,
                "voice_asset_id": char.voice_asset_id,
                "voice_asset_name": char.voice_asset.name if char.voice_asset else None,
                "voice_provider_type": char.voice_asset.provider.provider_type if char.voice_asset else None,
                "voice_speaker_id": char.voice_speaker_id,
                "primary_model_id": char.primary_model_id,
                "primary_provider_config_id": char.primary_provider_config_id,
                # 添加模型详情，方便前端显示
                "primary_model": {
                    "id": char.primary_model.id,
                    "model_id": char.primary_model.model_id,
                    "provider_config_id": char.primary_model.provider_config_id,
                } if char.primary_model else None,
                "enabled": char.enabled,
                "created_at": char.created_at.isoformat(),
                "updated_at": char.updated_at.isoformat(),
            }
            for char in characters
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except Exception:
        logger.exception("获取角色列表失败")
        raise HTTPException(status_code=500, detail="获取列表失败")


@router.get("/characters/{character_id}", summary="获取角色详情", response_model=ResponseModel)
async def get_character(
    character_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取角色详情"""
    try:
        character = db.query(Character).filter(Character.id == character_id).first()
        
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 构建响应
        data = {
            "id": character.id,
            "name": character.name,
            "system_prompt": character.system_prompt,
            "portrait_url": character.portrait_url,
            "avatar_id": character.avatar_id,
            "voice_asset_id": character.voice_asset_id,
            "voice_speaker_id": character.voice_speaker_id,
            "primary_model_id": character.primary_model_id,
            "primary_provider_config_id": character.primary_provider_config_id,
            "enabled": character.enabled,
            "created_at": character.created_at.isoformat(),
            "updated_at": character.updated_at.isoformat(),
            # 关联资产信息
            "avatar": {
                "id": character.avatar.id,
                "name": character.avatar.name,
                "file_url": character.avatar.file_url,
                "thumbnail_url": character.avatar.thumbnail_url,
            } if character.avatar else None,
            "voice_asset": {
                "id": character.voice_asset.id,
                "name": character.voice_asset.name,
                "provider_id": character.voice_asset.provider_id,
                "provider_type": character.voice_asset.provider.provider_type,
                "provider_name": character.voice_asset.provider.name,
                "voice_config": character.voice_asset.voice_config,
            } if character.voice_asset else None,
            "primary_model": {
                "id": character.primary_model.id,
                "model_id": character.primary_model.model_id,
                "provider_config_id": character.primary_model.provider_config_id,
                "model_type": character.primary_model.model_type,
            } if character.primary_model else None,
            # 动作绑定
            "motion_bindings": [
                {
                    "id": binding.id,
                    "category": binding.category,
                    "motion": {
                        "id": binding.motion.id,
                        "name": binding.motion.name,
                        "file_url": binding.motion.file_url,
                        "duration_ms": binding.motion.duration_ms,
                    }
                }
                for binding in character.motion_bindings
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
        logger.exception("获取角色详情失败")
        raise HTTPException(status_code=500, detail="获取详情失败")


@router.post("/characters", summary="创建角色", response_model=ResponseModel)
async def create_character(
    character_create: CharacterCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """创建角色（支持同时创建动作绑定）"""
    try:
        # 验证引用的资产是否存在（仅在提供了 ID 时验证）
        try:
            if character_create.avatar_id:
                validate_avatar_exists(db, character_create.avatar_id)
            if character_create.voice_asset_id:
                validate_voice_asset_exists(db, character_create.voice_asset_id)
            if character_create.primary_model_id:
                validate_model_exists(db, character_create.primary_model_id)
            
            # 验证动作绑定中的动作是否存在
            if character_create.motion_bindings:
                for binding in character_create.motion_bindings:
                    motion = db.query(Motion).filter(Motion.id == binding.motion_id).first()
                    if not motion:
                        raise InvalidReferenceError(f"动作不存在: {binding.motion_id}")
                    
                    # 验证分类
                    if binding.category not in ['initial', 'idle', 'thinking', 'reply']:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"无效的动作分类: {binding.category}，必须是 initial/idle/thinking/reply 之一"
                        )
        except InvalidReferenceError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 创建角色
        character = Character(
            name=character_create.name,
            system_prompt=character_create.system_prompt,
            portrait_url=character_create.portrait_url,
            avatar_id=character_create.avatar_id,
            voice_asset_id=character_create.voice_asset_id,
            voice_speaker_id=character_create.voice_speaker_id,
            primary_model_id=character_create.primary_model_id,
            primary_provider_config_id=character_create.primary_provider_config_id,
            enabled=character_create.enabled
        )
        
        db.add(character)
        db.flush()  # 获取角色 ID，但不提交事务
        
        # 创建动作绑定
        created_bindings = []
        if character_create.motion_bindings:
            for binding_input in character_create.motion_bindings:
                # 检查是否已存在相同的绑定（理论上不会，因为是新角色）
                binding = CharacterMotionBinding(
                    character_id=character.id,
                    motion_id=binding_input.motion_id,
                    category=binding_input.category
                )
                db.add(binding)
                created_bindings.append(binding)
        
        db.commit()
        db.refresh(character)
        
        # 构建响应
        response_data = {
            "id": character.id,
            "name": character.name,
            "system_prompt": character.system_prompt,
            "portrait_url": character.portrait_url,
            "avatar_id": character.avatar_id,
            "voice_asset_id": character.voice_asset_id,
            "voice_speaker_id": character.voice_speaker_id,
            "primary_model_id": character.primary_model_id,
            "primary_provider_config_id": character.primary_provider_config_id,
            "enabled": character.enabled,
            "created_at": character.created_at.isoformat(),
            "updated_at": character.updated_at.isoformat(),
        }
        
        # 如果创建了动作绑定，也返回绑定信息
        if created_bindings:
            response_data["motion_bindings"] = [
                {
                    "id": binding.id,
                    "motion_id": binding.motion_id,
                    "category": binding_input.category
                }
                for binding in created_bindings
            ]
        
        return {
            "code": 200,
            "message": f"创建成功{f'，已创建 {len(created_bindings)} 个动作绑定' if created_bindings else ''}",
            "data": response_data
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("创建角色失败")
        raise HTTPException(status_code=500, detail="创建失败")


@router.patch("/characters/{character_id}", summary="更新角色", response_model=ResponseModel)
async def update_character(
    character_id: str,
    character_update: CharacterUpdate,
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings)
) -> Dict[str, Any]:
    """更新角色（如果更新立绘URL,会自动清理旧的立绘文件）"""
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 更新字段
        updates = character_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        # 验证引用的资产是否存在
        try:
            if "avatar_id" in updates:
                validate_avatar_exists(db, updates["avatar_id"])
            if "voice_asset_id" in updates:
                validate_voice_asset_exists(db, updates["voice_asset_id"])
            if "primary_model_id" in updates and updates["primary_model_id"]:
                validate_model_exists(db, updates["primary_model_id"])
        except InvalidReferenceError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 处理立绘URL更新
        old_portrait_url = character.portrait_url
        new_portrait_url = updates.get("portrait_url")
        deleted_files = []
        
        # 如果更新了立绘URL且与旧值不同
        if "portrait_url" in updates and new_portrait_url != old_portrait_url:
            # 更新字段
            for key, value in updates.items():
                setattr(character, key, value)
            
            db.commit()
            
            # 尝试删除旧的立绘文件
            if old_portrait_url:
                try:
                    # 检查是否有其他角色使用相同的立绘
                    other_users = db.query(Character).filter(
                        Character.portrait_url == old_portrait_url,
                        Character.id != character_id
                    ).count()
                    
                    if other_users == 0:
                        # 没有其他角色使用,可以安全删除
                        if old_portrait_url.startswith('/static/images/'):
                            filename = old_portrait_url.split('/')[-1]
                            file_path = settings.images_dir / filename
                            
                            if file_path.exists():
                                file_path.unlink()
                                deleted_files.append(old_portrait_url)
                                logger.info(f"已删除旧立绘文件: {file_path}")
                    else:
                        logger.info(f"旧立绘文件被 {other_users} 个其他角色使用,跳过删除")
                except Exception as e:
                    logger.exception("删除旧立绘文件失败")
                    # 不影响更新操作,只记录错误
        else:
            # 没有更新立绘URL,正常更新其他字段
            for key, value in updates.items():
                setattr(character, key, value)
            db.commit()
        
        db.refresh(character)
        
        # 构建响应
        data = {
            "id": character.id,
            "name": character.name,
            "system_prompt": character.system_prompt,
            "portrait_url": character.portrait_url,
            "avatar_id": character.avatar_id,
            "voice_asset_id": character.voice_asset_id,
            "voice_speaker_id": character.voice_speaker_id,
            "primary_model_id": character.primary_model_id,
            "primary_provider_config_id": character.primary_provider_config_id,
            "enabled": character.enabled,
            "created_at": character.created_at.isoformat(),
            "updated_at": character.updated_at.isoformat(),
        }
        
        if deleted_files:
            data["deleted_old_files"] = deleted_files
        
        return {
            "code": 200,
            "message": "角色更新成功",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("更新角色失败")
        raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/characters/{character_id}", summary="删除角色", response_model=ResponseModel)
async def delete_character(
    character_id: str,
    db: Session = Depends(get_db),
    settings: AppSettings = Depends(get_settings)
) -> Dict[str, Any]:
    """删除角色（级联删除会话和消息,并清理关联的立绘文件）"""
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 记录要删除的立绘文件
        portrait_to_delete = character.portrait_url
        
        # 删除角色（会级联删除会话、消息和动作绑定）
        db.delete(character)
        db.commit()
        
        # 删除立绘文件（如果存在且不被其他角色使用）
        deleted_files = []
        if portrait_to_delete:
            try:
                # 检查是否有其他角色使用相同的立绘
                other_users = db.query(Character).filter(
                    Character.portrait_url == portrait_to_delete
                ).count()
                
                if other_users == 0:
                    # 没有其他角色使用,可以安全删除
                    # 解析文件路径
                    if portrait_to_delete.startswith('/static/images/'):
                        filename = portrait_to_delete.split('/')[-1]
                        file_path = settings.images_dir / filename
                        
                        if file_path.exists():
                            file_path.unlink()
                            deleted_files.append(portrait_to_delete)
                            logger.info(f"已删除立绘文件: {file_path}")
                        else:
                            logger.warning(f"立绘文件不存在: {file_path}")
                else:
                    logger.info(f"立绘文件被 {other_users} 个其他角色使用,跳过删除")
            except Exception as e:
                logger.exception("删除立绘文件失败")
                # 不影响角色删除,只记录错误
        
        return {
            "code": 200,
            "message": "角色删除成功",
            "data": {
                "deleted_files": deleted_files
            }
        }
        
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("从数据库删除角色记录失败")
        raise HTTPException(status_code=500, detail="删除失败")
