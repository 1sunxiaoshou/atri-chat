"""TTS 语音合成路由（重构版 - 使用 ORM）"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from api.schemas import ResponseModel
from core.tts.factory import TTSFactory
from core.dependencies import get_db, get_tts_factory
from core.db import TTSProvider, VoiceAsset, Character
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class TTSSynthesizeRequest(BaseModel):
    """语音合成请求"""
    text: str
    language: Optional[str] = None
    character_id: Optional[str] = None  # 可选：指定角色使用其绑定的音色


@router.get("/status", response_model=ResponseModel)
async def get_tts_status(db: Session = Depends(get_db)):
    """获取 TTS 状态
    
    返回当前启用的供应商和可用的音色列表
    """
    try:
        # 查询启用的供应商
        enabled_providers = db.query(TTSProvider).filter(
            TTSProvider.enabled == True
        ).all()
        
        if not enabled_providers:
            return {
                "code": 200,
                "message": "TTS 未配置",
                "data": {
                    "enabled": False,
                    "providers": [],
                    "voices": []
                }
            }
        
        # 构建响应
        providers_data = []
        all_voices = []
        
        for provider in enabled_providers:
            providers_data.append({
                "id": provider.id,
                "type": provider.provider_type,
                "name": provider.name,
                "voice_count": len(provider.voices)
            })
            
            # 收集该供应商的音色
            for voice in provider.voices:
                all_voices.append({
                    "id": voice.id,
                    "name": voice.name,
                    "provider_id": provider.id,
                    "provider_name": provider.name
                })
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "enabled": True,
                "providers": providers_data,
                "voices": all_voices
            }
        }
        
    except Exception as e:
        logger.error(f"获取 TTS 状态失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/synthesize")
async def synthesize_speech(
    req: TTSSynthesizeRequest,
    stream: bool = False,
    db: Session = Depends(get_db),
    tts_factory: TTSFactory = Depends(get_tts_factory)
):
    """文本转语音（重构版 - 支持角色音色）
    
    支持两种模式：
    1. 使用默认启用的 TTS 供应商
    2. 使用指定角色绑定的音色
    
    Args:
        stream: True=PCM流式(AudioContext播放), False=WAV完整文件
    """
    try:
        provider_type = None
        config = None
        
        # 如果指定了角色，使用角色绑定的音色
        if req.character_id:
            character = db.query(Character).filter(
                Character.id == req.character_id
            ).first()
            
            if not character:
                raise HTTPException(status_code=404, detail="角色不存在")
            
            # 获取角色的音色资产
            voice_asset = db.query(VoiceAsset).filter(
                VoiceAsset.id == character.voice_asset_id
            ).first()
            
            if not voice_asset:
                raise HTTPException(status_code=404, detail="角色未配置音色")
            
            # 获取供应商
            provider = db.query(TTSProvider).filter(
                TTSProvider.id == voice_asset.provider_id
            ).first()
            
            if not provider or not provider.enabled:
                raise HTTPException(status_code=400, detail="音色供应商未启用")
            
            provider_type = provider.provider_type
            # 合并供应商配置和音色配置
            config = {**provider.config_payload, **voice_asset.voice_config}
        
        # 获取 TTS 实例
        if config:
            # 使用角色音色配置
            tts = tts_factory.create_tts(provider_type=provider_type, config=config)
        else:
            # 使用默认启用的供应商
            tts = tts_factory.get_default_tts(db_session=db)
        
        # 流式模式（PCM raw 格式，使用 AudioContext 播放）
        if stream:
            # 创建生成器
            generator = tts.synthesize_stream(req.text, req.language, media_type="raw")
            
            # 预先读取第一个chunk以获取采样率
            try:
                first_chunk = await generator.__anext__()
                sample_rate = getattr(tts, 'sample_rate', 32000)
            except StopAsyncIteration:
                raise HTTPException(status_code=500, detail="TTS生成失败：无数据")
            except Exception as e:
                logger.error(f"获取采样率失败: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"TTS失败: {str(e)}")
            
            async def audio_stream():
                try:
                    # 先返回第一个chunk
                    yield first_chunk
                    # 继续返回剩余chunks
                    async for chunk in generator:
                        yield chunk
                except Exception as e:
                    logger.error(f"流式合成失败: {e}", exc_info=True)
                    raise
            
            return StreamingResponse(
                audio_stream(),
                media_type="application/octet-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "X-Sample-Rate": str(sample_rate),
                    "X-Channels": "1",
                    "X-Bit-Depth": "16",
                }
            )
        
        # 非流式模式（返回完整 WAV 文件）
        else:
            audio_bytes = await tts.synthesize_async(req.text, req.language)
            
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
            )
    
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"TTS配置错误: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"配置错误: {str(e)}")
    except Exception as e:
        logger.error(f"语音合成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")
