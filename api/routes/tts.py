"""TTS配置管理路由"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from api.schemas import ResponseModel
from core.tts.service import TTSConfigService
from core.tts.factory import TTSFactory
from core.dependencies import get_agent
from core import AgentManager
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class TTSTestRequest(BaseModel):
    """测试连接请求"""
    provider_id: str
    config: Dict[str, Any]


class TTSConfigRequest(BaseModel):
    """保存配置请求"""
    provider_id: Optional[str] = None
    config: Dict[str, Any] = {}


class TTSSynthesizeRequest(BaseModel):
    """语音合成请求"""
    text: str
    language: Optional[str] = None


@router.get("/providers", response_model=ResponseModel)
async def get_providers(agent_manager: AgentManager = Depends(get_agent)):
    """获取配置列表与状态
    
    返回所有服务商的配置状态，包括当前active的服务商
    """
    try:
        service = agent_manager.tts_factory.config_service
        data = service.get_all_providers()
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        logger.error(f"获取TTS配置列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@router.post("/test", response_model=ResponseModel)
async def test_connection(req: TTSTestRequest, agent_manager: AgentManager = Depends(get_agent)):
    """测试连接
    
    不保存配置，仅验证参数有效性
    """
    try:
        logger.info(f"测试TTS连接: provider={req.provider_id}")
        
        # 使用提供的配置创建临时TTS实例
        tts = agent_manager.tts_factory.create_tts(provider=req.provider_id, config=req.config)
        
        # 执行连接测试
        result = await tts.test_connection()
        
        if result["success"]:
            logger.info(f"TTS连接测试成功: provider={req.provider_id}")
            return ResponseModel(
                code=200,
                message=result.get("message", "连接测试成功"),
                data=result
            )
        else:
            logger.warning(f"TTS连接测试失败: provider={req.provider_id}, reason={result.get('message')}")
            return ResponseModel(
                code=400,
                message=result.get("message", "连接测试失败"),
                data=result
            )
    
    except ValueError as e:
        logger.error(f"TTS配置错误: provider={req.provider_id}, error={e}")
        return ResponseModel(
            code=400,
            message=f"配置错误: {str(e)}",
            data={"success": False, "message": str(e)}
        )
    except Exception as e:
        logger.error(f"TTS测试异常: provider={req.provider_id}, error={e}")
        return ResponseModel(
            code=500,
            message=f"测试失败: {str(e)}",
            data={"success": False, "message": str(e)}
        )


@router.post("/config", response_model=ResponseModel)
async def save_config(
    req: TTSConfigRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    """保存并应用配置
    
    验证通过后，持久化存储并切换当前生效服务商
    如果provider_id为空，则禁用TTS功能
    """
    try:
        service = agent_manager.tts_factory.config_service
        factory = agent_manager.tts_factory
        
        # 如果provider_id为空或"none"，禁用TTS
        if not req.provider_id or req.provider_id.lower() == "none":
            logger.info("禁用TTS功能")
            success = service.disable_tts()
            if success:
                factory.clear_cache()
                logger.info("TTS已禁用")
                return ResponseModel(
                    code=200,
                    message="TTS已禁用",
                    data={"provider_id": None}
                )
            else:
                raise HTTPException(status_code=500, detail="禁用TTS失败")
        
        # 从 Registry 获取服务商名称
        from core.tts import TTSRegistry
        provider_name = TTSRegistry.get_provider_name(req.provider_id)
        
        logger.info(f"保存TTS配置: provider={req.provider_id}")
        
        # 保存配置（内部会进行验证）
        success = service.save_config(
            provider_id=req.provider_id,
            name=provider_name,
            config=req.config,
            set_active=True
        )
        
        if success:
            # 清空指定服务商的缓存
            factory.clear_cache(req.provider_id)
            
            logger.info(f"TTS配置保存成功: provider={req.provider_id}")
            return ResponseModel(
                code=200,
                message="配置保存成功",
                data={"provider_id": req.provider_id}
            )
        else:
            raise HTTPException(status_code=500, detail="保存配置失败")
    
    except ValueError as e:
        logger.error(f"TTS配置验证失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"保存TTS配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存配置失败: {str(e)}")


@router.post("/synthesize")
async def synthesize_speech(
    req: TTSSynthesizeRequest,
    stream: bool = False,
    agent_manager: AgentManager = Depends(get_agent)
):
    """文本转语音
    
    使用当前active的TTS服务商进行合成
    
    Args:
        stream: True=PCM流式(AudioContext播放), False=WAV完整文件
    """
    try:
        logger.info(f"开始语音合成: text_length={len(req.text)}, language={req.language}, stream={stream}")
        
        # 获取TTS实例
        tts = agent_manager.tts_factory.get_default_tts()
        logger.info(f"获取到TTS实例: {type(tts).__name__}, 支持流式={tts.supports_streaming()}")
        
        # 流式模式（PCM raw 格式，使用 AudioContext 播放）
        if stream:
            # 创建生成器
            generator = tts.synthesize_stream(req.text, req.language, media_type="raw")
            
            # 预先读取第一个chunk以获取采样率
            try:
                first_chunk = await generator.__anext__()
                sample_rate = getattr(tts, 'sample_rate', 32000)
                logger.info(f"TTS采样率: {sample_rate}Hz")
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
            logger.info(f"合成成功: audio_size={len(audio_bytes)} bytes")
            
            from fastapi.responses import Response
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
            )
    
    except ValueError as e:
        logger.error(f"TTS配置错误: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"配置错误: {str(e)}")
    except Exception as e:
        logger.error(f"语音合成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")
