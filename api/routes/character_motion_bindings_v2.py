"""角色-动作绑定管理 API (简化版本)"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.dependencies import get_db
from core.db import Character, Motion, CharacterMotionBinding
from core.logger import get_logger
from api.schemas import ResponseModel

logger = get_logger(__name__)

router = APIRouter()


# ==================== Pydantic 模型 ====================

class MotionBindingItem(BaseModel):
    """单个绑定项"""
    motion_id: str = Field(..., description="动作 ID")
    category: str = Field(..., description="分类（initial/idle/thinking/reply）")


class CharacterMotionBindingsUpdate(BaseModel):
    """更新角色的所有动作绑定"""
    bindings: List[MotionBindingItem] = Field(default=[], description="绑定列表")


# ==================== API 端点 ====================

@router.get("/characters/{character_id}/motions", summary="获取角色的所有动作绑定", response_model=ResponseModel)
async def get_character_motions(
    character_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """获取角色的所有动作绑定（按分类分组）"""
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 查询所有绑定
        bindings = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.character_id == character_id
        ).all()
        
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
        logger.error("获取角色动作失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/characters/{character_id}/motions", summary="更新角色的所有动作绑定", response_model=ResponseModel)
async def update_character_motions(
    character_id: str,
    body: CharacterMotionBindingsUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """更新角色的所有动作绑定（替换式更新）
    
    工作流程：
    1. 删除角色的所有旧绑定
    2. 创建新的绑定
    3. 原子性操作，要么全成功，要么全失败
    """
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 验证所有动作是否存在
        motion_ids = [b.motion_id for b in body.bindings]
        if motion_ids:
            motions = db.query(Motion).filter(Motion.id.in_(motion_ids)).all()
            if len(motions) != len(set(motion_ids)):
                raise HTTPException(status_code=404, detail="部分动作不存在")
        
        # 验证分类
        valid_categories = ['initial', 'idle', 'thinking', 'reply']
        for binding in body.bindings:
            if binding.category not in valid_categories:
                raise HTTPException(
                    status_code=400,
                    detail=f"无效的动作分类: {binding.category}，必须是 {'/'.join(valid_categories)} 之一"
                )
        
        # 1. 删除所有旧绑定
        deleted_count = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.character_id == character_id
        ).delete(synchronize_session=False)
        
        # 2. 创建新绑定
        created_count = 0
        for binding_item in body.bindings:
            binding = CharacterMotionBinding(
                character_id=character_id,
                motion_id=binding_item.motion_id,
                category=binding_item.category
            )
            db.add(binding)
            created_count += 1
        
        # 3. 提交事务
        db.commit()
        
        return {
            "code": 200,
            "message": f"成功更新绑定：删除 {deleted_count} 个，创建 {created_count} 个",
            "data": {
                "deleted_count": deleted_count,
                "created_count": created_count,
                "total_bindings": created_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("更新角色动作绑定失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/characters/{character_id}/motions", summary="删除角色的所有动作绑定", response_model=ResponseModel)
async def delete_character_motions(
    character_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """删除角色的所有动作绑定
    
    通常在删除角色时自动调用
    """
    try:
        # 检查角色是否存在
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 删除所有绑定
        deleted_count = db.query(CharacterMotionBinding).filter(
            CharacterMotionBinding.character_id == character_id
        ).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "code": 200,
            "message": f"成功删除 {deleted_count} 个绑定",
            "data": {
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("删除角色动作绑定失败: {}", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
