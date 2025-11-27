"""TTS管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import ResponseModel, TTSRequest, TTSResponse
from core import AppStorage
from core.dependencies import get_storage

router = APIRouter()


@router.post("/tts", response_model=ResponseModel)
async def create_tts(
    req: TTSRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """创建TTS"""
    try:
        success = app_storage.add_tts(
            tts_id=req.tts_id,
            provider_id=req.provider_id,
            voice_role=req.voice_role,
            api_key=req.api_key,
            access_url=req.access_url,
            enabled=req.enabled
        )
        if not success:
            raise HTTPException(status_code=400, detail="TTS已存在")
        return ResponseModel(
            code=200,
            message="TTS创建成功",
            data={"tts_id": req.tts_id}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tts/{tts_id}", response_model=ResponseModel)
async def get_tts(
    tts_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """获取TTS"""
    try:
        tts = app_storage.get_tts(tts_id)
        if not tts:
            raise HTTPException(status_code=404, detail="TTS不存在")
        return ResponseModel(
            code=200,
            message="获取成功",
            data=tts
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tts", response_model=ResponseModel)
async def list_tts(
    provider_id: str = None,
    enabled_only: bool = True,
    app_storage: AppStorage = Depends(get_storage)
):
    """列出TTS"""
    try:
        tts_list = app_storage.list_tts(provider_id, enabled_only)
        return ResponseModel(
            code=200,
            message="获取成功",
            data=tts_list
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tts/{tts_id}", response_model=ResponseModel)
async def update_tts(
    tts_id: str,
    req: TTSRequest,
    app_storage: AppStorage = Depends(get_storage)
):
    """更新TTS"""
    try:
        success = app_storage.update_tts(
            tts_id=tts_id,
            provider_id=req.provider_id,
            voice_role=req.voice_role,
            api_key=req.api_key,
            access_url=req.access_url,
            enabled=req.enabled
        )
        if not success:
            raise HTTPException(status_code=404, detail="TTS不存在")
        return ResponseModel(
            code=200,
            message="更新成功",
            data={"tts_id": tts_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tts/{tts_id}", response_model=ResponseModel)
async def delete_tts(
    tts_id: str,
    app_storage: AppStorage = Depends(get_storage)
):
    """删除TTS"""
    try:
        success = app_storage.delete_tts(tts_id)
        if not success:
            raise HTTPException(status_code=404, detail="TTS不存在")
        return ResponseModel(
            code=200,
            message="删除成功",
            data={"tts_id": tts_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
