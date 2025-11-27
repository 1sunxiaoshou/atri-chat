"""角色管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import (
    ResponseModel, CharacterRequest, CharacterResponse, CharacterUpdateRequest
)
from core import AppStorage, AgentManager
from core.dependencies import get_storage, get_agent

router = APIRouter()


@router.post("/characters", response_model=ResponseModel)
async def create_character(
    req: CharacterRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建角色"""
    try:
        character_id = app_storage.add_character(
            name=req.name,
            description=req.description,
            system_prompt=req.system_prompt,
            primary_model_id=req.primary_model_id,
            primary_provider_id=req.primary_provider_id,
            tts_id=req.tts_id,
            enabled=req.enabled
        )
        if not character_id:
            raise HTTPException(status_code=400, detail="角色创建失败")
        return ResponseModel(
            code=200,
            message="角色创建成功",
            data={"character_id": character_id}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/characters/{character_id}", response_model=ResponseModel)
async def get_character(
    character_id: int,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取角色"""
    try:
        character = app_storage.get_character(character_id)
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        return ResponseModel(
            code=200,
            message="获取成功",
            data=character
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/characters", response_model=ResponseModel)
async def list_characters(
    enabled_only: bool = True,
    app_storage: AppStorage = Depends(get_storage)
):
    """列出角色"""
    try:
        characters = app_storage.list_characters(enabled_only)
        return ResponseModel(
            code=200,
            message="获取成功",
            data=characters
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/characters/{character_id}", response_model=ResponseModel)
async def update_character(
    character_id: int,
    req: CharacterUpdateRequest,
    app_storage: AppStorage = Depends(get_storage),
    agent_manager: AgentManager = Depends(get_agent)
):
    """更新角色"""
    try:
        success = app_storage.update_character(
            character_id=character_id,
            name=req.name,
            description=req.description,
            system_prompt=req.system_prompt,
            primary_model_id=req.primary_model_id,
            primary_provider_id=req.primary_provider_id,
            tts_id=req.tts_id,
            enabled=req.enabled
        )
        if not success:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 清空该角色的Agent缓存
        agent_manager.clear_agent_cache(character_id)
        
        return ResponseModel(
            code=200,
            message="更新成功",
            data={"character_id": character_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/characters/{character_id}", response_model=ResponseModel)
async def delete_character(
    character_id: int,
    app_storage: AppStorage = Depends(get_storage),
    agent_manager: AgentManager = Depends(get_agent)
):
    """删除角色"""
    try:
        success = app_storage.delete_character(character_id)
        if not success:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 清空该角色的Agent缓存
        agent_manager.clear_agent_cache(character_id)
        
        return ResponseModel(
            code=200,
            message="删除成功",
            data={"character_id": character_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
