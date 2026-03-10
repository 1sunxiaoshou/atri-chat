"""ORM API 路由示例

演示如何使用 SQLAlchemy ORM 创建 FastAPI 路由
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.dependencies import get_db
from core.db import Avatar, Voice, Character
from core.db.utils import (
    check_avatar_references,
    safe_delete_avatar,
    ResourceInUseError,
    InvalidReferenceError
)

router = APIRouter(prefix="/api/v1", tags=["examples"])


# ==================== Pydantic 模型 ====================

class AvatarCreate(BaseModel):
    name: str
    file_url: str
    thumbnail_url: Optional[str] = None


class AvatarResponse(BaseModel):
    id: str
    name: str
    file_url: str
    thumbnail_url: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


class CharacterCreate(BaseModel):
    name: str
    system_prompt: str
    avatar_id: str
    voice_config_id: str
    voice_speaker_id: Optional[str] = None


class CharacterResponse(BaseModel):
    id: str
    name: str
    system_prompt: str
    avatar_id: str
    voice_config_id: str
    voice_speaker_id: Optional[str]
    created_at: str
    
    # 嵌套资产信息
    avatar: AvatarResponse
    
    class Config:
        from_attributes = True


# ==================== 形象 API ====================

@router.get("/avatars", response_model=List[AvatarResponse])
def list_avatars(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """列出所有形象
    
    支持分页和搜索
    """
    query = db.query(Avatar)
    
    # 搜索过滤
    if search:
        query = query.filter(Avatar.name.ilike(f"%{search}%"))
    
    # 分页
    avatars = query.offset(skip).limit(limit).all()
    
    return [
        AvatarResponse(
            id=a.id,
            name=a.name,
            file_url=a.file_url,
            thumbnail_url=a.thumbnail_url,
            created_at=a.created_at.isoformat()
        )
        for a in avatars
    ]


@router.get("/avatars/{avatar_id}", response_model=AvatarResponse)
def get_avatar(avatar_id: str, db: Session = Depends(get_db)):
    """获取单个形象"""
    avatar = db.query(Avatar).filter(Avatar.id == avatar_id).first()
    
    if not avatar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Avatar {avatar_id} not found"
        )
    
    return AvatarResponse(
        id=avatar.id,
        name=avatar.name,
        file_url=avatar.file_url,
        thumbnail_url=avatar.thumbnail_url,
        created_at=avatar.created_at.isoformat()
    )


@router.post("/avatars", response_model=AvatarResponse, status_code=status.HTTP_201_CREATED)
def create_avatar(avatar_data: AvatarCreate, db: Session = Depends(get_db)):
    """创建形象"""
    avatar = Avatar(
        name=avatar_data.name,
        file_url=avatar_data.file_url,
        thumbnail_url=avatar_data.thumbnail_url
    )
    
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    
    return AvatarResponse(
        id=avatar.id,
        name=avatar.name,
        file_url=avatar.file_url,
        thumbnail_url=avatar.thumbnail_url,
        created_at=avatar.created_at.isoformat()
    )


@router.delete("/avatars/{avatar_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_avatar(avatar_id: str, db: Session = Depends(get_db)):
    """删除形象（带引用检查）"""
    try:
        # 使用安全删除（会检查引用）
        success = safe_delete_avatar(db, avatar_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Avatar {avatar_id} not found"
            )
        
    except ResourceInUseError as e:
        # 形象被引用，无法删除
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "RESOURCE_IN_USE",
                "message": str(e),
                "referenced_by": e.referenced_by
            }
        )


# ==================== 角色 API ====================

@router.get("/characters", response_model=List[CharacterResponse])
def list_characters(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """列出所有角色
    
    自动加载关联的资产信息
    """
    characters = db.query(Character).offset(skip).limit(limit).all()
    
    return [
        CharacterResponse(
            id=c.id,
            name=c.name,
            system_prompt=c.system_prompt,
            avatar_id=c.avatar_id,
            voice_config_id=c.voice_config_id,
            voice_speaker_id=c.voice_speaker_id,
            created_at=c.created_at.isoformat(),
            avatar=AvatarResponse(
                id=c.avatar.id,
                name=c.avatar.name,
                file_url=c.avatar.file_url,
                thumbnail_url=c.avatar.thumbnail_url,
                created_at=c.avatar.created_at.isoformat()
            )
        )
        for c in characters
    ]


@router.post("/characters", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
def create_character(character_data: CharacterCreate, db: Session = Depends(get_db)):
    """创建角色
    
    会验证引用的资产是否存在
    """
    # 验证 avatar 是否存在
    avatar = db.query(Avatar).filter(Avatar.id == character_data.avatar_id).first()
    if not avatar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_REFERENCE",
                "message": f"Avatar {character_data.avatar_id} does not exist"
            }
        )
    
    # 验证 voice 是否存在
    voice = db.query(Voice).filter(Voice.id == character_data.voice_config_id).first()
    if not voice:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "INVALID_REFERENCE",
                "message": f"Voice {character_data.voice_config_id} does not exist"
            }
        )
    
    # 创建角色
    character = Character(
        name=character_data.name,
        system_prompt=character_data.system_prompt,
        avatar_id=character_data.avatar_id,
        voice_config_id=character_data.voice_config_id,
        voice_speaker_id=character_data.voice_speaker_id
    )
    
    db.add(character)
    db.commit()
    db.refresh(character)
    
    return CharacterResponse(
        id=character.id,
        name=character.name,
        system_prompt=character.system_prompt,
        avatar_id=character.avatar_id,
        voice_config_id=character.voice_config_id,
        voice_speaker_id=character.voice_speaker_id,
        created_at=character.created_at.isoformat(),
        avatar=AvatarResponse(
            id=character.avatar.id,
            name=character.avatar.name,
            file_url=character.avatar.file_url,
            thumbnail_url=character.avatar.thumbnail_url,
            created_at=character.avatar.created_at.isoformat()
        )
    )


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(character_id: str, db: Session = Depends(get_db)):
    """删除角色
    
    会级联删除关联的动作绑定和会话
    """
    character = db.query(Character).filter(Character.id == character_id).first()
    
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Character {character_id} not found"
        )
    
    db.delete(character)
    db.commit()


# ==================== 使用示例 ====================

"""
# 在 main.py 中注册路由：
from examples.orm_api_example import router as example_router
app.include_router(example_router)

# 测试 API：

# 1. 创建形象
curl -X POST http://localhost:9099/api/v1/avatars \
  -H "Content-Type: application/json" \
  -d '{"name": "Female Character", "file_url": "/uploads/avatars/female.vrm"}'

# 2. 列出形象
curl http://localhost:9099/api/v1/avatars

# 3. 搜索形象
curl http://localhost:9099/api/v1/avatars?search=female

# 4. 创建角色
curl -X POST http://localhost:9099/api/v1/characters \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "system_prompt": "You are Alice",
    "avatar_id": "xxx",
    "voice_config_id": "yyy"
  }'

# 5. 列出角色（自动加载资产）
curl http://localhost:9099/api/v1/characters

# 6. 删除角色（级联删除绑定）
curl -X DELETE http://localhost:9099/api/v1/characters/{id}

# 7. 尝试删除被引用的形象（会失败）
curl -X DELETE http://localhost:9099/api/v1/avatars/{id}
# 返回 409 Conflict，包含引用信息
"""
