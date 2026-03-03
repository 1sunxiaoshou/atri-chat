"""角色-动作绑定管理 API (ORM 版本)"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Character, Motion, CharacterMotionBinding
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter()


# ==================== Pydantic 模型 ====================

class BindingCreate(BaseModel):
    """创建绑定"""
    character_id: str = Field(..., description="角色 ID")
    motion_id: str = Field(..., description="动作 ID")
    category: str = Field(..., description="分类（initial/idle/thinking/reply）")


class BindingUpdate(BaseModel):
    """更新绑定"""
    category: Optional[str] = Field(None, description="分类")


class BatchBindingCreate(BaseModel):
    """批量创建绑定"""
    character_id: str = Field(..., description="角色 ID")
    motion_ids: List[str] = Field(..., description="动作 ID 列表")
    category: str = Field(..., description="分类（initial/idle/thinking/reply）")


# ==================== API 端点 ====================

@router.get("/character-motion-bindings", summary="获取所有绑定", response_model=ResponseModel)
async def list_bindings(
    skip: int = 0,
    limit: int = 100,
    character_id: Optional[str] = None,
    motion_id: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取所有角色-动作绑定
    
    支持分页和过滤
    """
    try:
        query = db.query(CharacterMotionBinding)
        
        # 过滤
        if character_id:
            query = query.filter(CharacterMotionBinding.character_id == character_id)
        if motion_id:
            query = query.filter(CharacterMotionBinding.motion_id == motion_id)
        if category:
            query = query.filter(CharacterMotionBinding.category == category)
        
        # 分页
        bindings = query.offset(skip).limit(limit).all()
        
        # 构建响应
        data = [
            {
                "id": binding.id,
                "character_id": binding.character_id,
                "character_name": binding.character.name,
                "motion_id": binding.motion_id,
                "motion_name": binding.motion.name,
                "category": binding.category,
                "created_at": binding.created_at.isoformat(),
            }
            for binding in bindings
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": data
        }
        
    except Exception as e:
        logger.error(f"获取绑定列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/characters/{character_id}/motions", summary="获取角色的所有动作", response_model=ResponseModel)
async def get_character_motions(
    character_id: str,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取角色的所有动作绑定
    
    可按分类过滤
    """
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 查询绑定
        query = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.character_id == character_id
        )
        
        if category:
            query = query.filter(CharacterMotionBinding.category == category)
        
        bindings = query.all()
        
        # 按分类分组
        grouped_data = {}
        for binding in bindings:
            cat = binding.category
            if cat not in grouped_data:
                grouped_data[cat] = []
            
            grouped_data[cat].append({
                "binding_id": binding.id,
                "motion_id": binding.motion_id,
                "motion_name": binding.motion.name,
                "motion_file_url": binding.motion.file_url,
                "motion_duration_ms": binding.motion.duration_ms,
                "created_at": binding.created_at.isoformat(),
            })
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "character_id": character_id,
                "character_name": character.name,
                "bindings_by_category": grouped_data,
                "total_bindings": len(bindings)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取角色动作失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/character-motion-bindings", summary="创建绑定", response_model=ResponseModel)
async def create_binding(
    binding_create: BindingCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """创建角色-动作绑定"""
    try:
        # 验证分类
        if binding_create.category not in ['initial', 'idle', 'thinking', 'reply']:
            raise HTTPException(
                status_code=400,
                detail=f"无效的动作分类: {binding_create.category}，必须是 initial/idle/thinking/reply 之一"
            )
        
        # 验证角色和动作是否存在
        character = db.query(Character).filter(
            Character.id == binding_create.character_id
        ).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        motion = db.query(Motion).filter(
            Motion.id == binding_create.motion_id
        ).first()
        if not motion:
            raise HTTPException(status_code=404, detail="动作不存在")
        
        # 检查是否已存在相同的绑定
        existing = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.character_id == binding_create.character_id,
            CharacterMotionBinding.motion_id == binding_create.motion_id,
            CharacterMotionBinding.category == binding_create.category
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="该动作已在此分类下绑定到角色"
            )
        
        # 创建绑定
        binding = CharacterMotionBinding(
            character_id=binding_create.character_id,
            motion_id=binding_create.motion_id,
            category=binding_create.category
        )
        
        db.add(binding)
        db.commit()
        db.refresh(binding)
        
        return {
            "code": 200,
            "message": "绑定创建成功",
            "data": {
                "id": binding.id,
                "character_id": binding.character_id,
                "motion_id": binding.motion_id,
                "category": binding.category,
                "created_at": binding.created_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建绑定失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/character-motion-bindings/batch", summary="批量创建绑定", response_model=ResponseModel)
async def batch_create_bindings(
    batch_create: BatchBindingCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """批量创建角色-动作绑定"""
    try:
        # 验证分类
        if batch_create.category not in ['initial', 'idle', 'thinking', 'reply']:
            raise HTTPException(
                status_code=400,
                detail=f"无效的动作分类: {batch_create.category}，必须是 initial/idle/thinking/reply 之一"
            )
        
        # 验证角色是否存在
        character = db.query(Character).filter(
            Character.id == batch_create.character_id
        ).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 验证所有动作是否存在
        motions = db.query(Motion).filter(
            Motion.id.in_(batch_create.motion_ids)
        ).all()
        
        if len(motions) != len(batch_create.motion_ids):
            raise HTTPException(status_code=404, detail="部分动作不存在")
        
        # 批量创建绑定
        created_count = 0
        skipped_count = 0
        
        for motion_id in batch_create.motion_ids:
            # 检查是否已存在
            existing = db.query(CharacterMotionBinding).filter(
                CharacterMotionBinding.character_id == batch_create.character_id,
                CharacterMotionBinding.motion_id == motion_id,
                CharacterMotionBinding.category == batch_create.category
            ).first()
            
            if existing:
                skipped_count += 1
                continue
            
            # 创建绑定
            binding = CharacterMotionBinding(
                character_id=batch_create.character_id,
                motion_id=motion_id,
                category=batch_create.category
            )
            db.add(binding)
            created_count += 1
        
        db.commit()
        
        return {
            "code": 200,
            "message": f"成功创建 {created_count} 个绑定，跳过 {skipped_count} 个已存在的绑定",
            "data": {
                "created_count": created_count,
                "skipped_count": skipped_count,
                "total_count": len(batch_create.motion_ids)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"批量创建绑定失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/character-motion-bindings/{binding_id}", summary="更新绑定", response_model=ResponseModel)
async def update_binding(
    binding_id: str,
    binding_update: BindingUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新角色-动作绑定"""
    try:
        # 检查绑定是否存在
        binding = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.id == binding_id
        ).first()
        
        if not binding:
            raise HTTPException(status_code=404, detail="绑定不存在")
        
        # 更新字段
        updates = binding_update.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="没有提供更新字段")
        
        # 验证分类（如果更新了分类）
        if "category" in updates and updates["category"] not in ['initial', 'idle', 'thinking', 'reply']:
            raise HTTPException(
                status_code=400,
                detail=f"无效的动作分类: {updates['category']}，必须是 initial/idle/thinking/reply 之一"
            )
        
        # 如果更新分类，检查唯一性
        if "category" in updates:
            existing = db.query(CharacterMotionBinding).filter(
                CharacterMotionBinding.character_id == binding.character_id,
                CharacterMotionBinding.motion_id == binding.motion_id,
                CharacterMotionBinding.category == updates["category"],
                CharacterMotionBinding.id != binding_id
            ).first()
            
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="该动作已在此分类下绑定到角色"
                )
        
        for key, value in updates.items():
            setattr(binding, key, value)
        
        db.commit()
        db.refresh(binding)
        
        return {
            "code": 200,
            "message": "绑定更新成功",
            "data": {
                "id": binding.id,
                "character_id": binding.character_id,
                "motion_id": binding.motion_id,
                "category": binding.category,
                "created_at": binding.created_at.isoformat(),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新绑定失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/character-motion-bindings/{binding_id}", summary="删除绑定", response_model=ResponseModel)
async def delete_binding(
    binding_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除角色-动作绑定"""
    try:
        # 检查绑定是否存在
        binding = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.id == binding_id
        ).first()
        
        if not binding:
            raise HTTPException(status_code=404, detail="绑定不存在")
        
        # 删除绑定
        db.delete(binding)
        db.commit()
        
        return {
            "code": 200,
            "message": "绑定删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除绑定失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/characters/{character_id}/motions/batch-delete", summary="批量删除角色的动作绑定", response_model=ResponseModel)
async def batch_delete_character_motions(
    character_id: str,
    motion_ids: List[str],
    category: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """批量删除角色的动作绑定"""
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 构建查询
        query = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.character_id == character_id,
            CharacterMotionBinding.motion_id.in_(motion_ids)
        )
        
        if category:
            query = query.filter(CharacterMotionBinding.category == category)
        
        # 删除
        deleted_count = query.delete(synchronize_session=False)
        db.commit()
        
        return {
            "code": 200,
            "message": f"成功删除 {deleted_count} 个绑定",
            "data": {
                "deleted_count": deleted_count,
                "total_count": len(motion_ids)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"批量删除绑定失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
