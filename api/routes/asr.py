"""ASR配置管理路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from api.schemas import ResponseModel
from core.asr.service import ASRConfigService
from core.asr.factory import ASRFactory
from core.dependencies import get_asr_factory
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class ASRTestRequest(BaseModel):
    """测试连接请求"""
    provider_id: str
    config: Dict[str, Any]


class ASRConfigRequest(BaseModel):
    """保存配置请求"""
    provider_id: Optional[str] = None
    config: Dict[str, Any] = {}


@router.get("/providers", response_model=ResponseModel)
async def get_providers(asr_factory: ASRFactory = Depends(get_asr_factory)):
    """获取配置列表与状态
    
    返回所有服务商的配置状态，包括当前active的服务商
    """
    try:
        service = asr_factory.config_service
        data = service.get_all_providers()
        return ResponseModel(
            code=200,
            message="获取成功",
            data=data
        )
    except Exception as e:
        logger.error(f"获取ASR配置列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@router.post("/test", response_model=ResponseModel)
async def test_connection(req: ASRTestRequest, asr_factory: ASRFactory = Depends(get_asr_factory)):
    """测试连接
    
    不保存配置，仅验证参数有效性
    """
    try:
        logger.info(f"测试ASR连接: provider={req.provider_id}")
        
        # 使用提供的配置创建临时ASR实例
        asr = asr_factory.create_asr(provider=req.provider_id, config=req.config)
        
        # 执行连接测试
        result = await asr.test_connection()
        
        if result["success"]:
            logger.info(f"ASR连接测试成功: provider={req.provider_id}")
            return ResponseModel(
                code=200,
                message=result.get("message", "连接测试成功"),
                data=result
            )
        else:
            logger.warning(f"ASR连接测试失败: provider={req.provider_id}, reason={result.get('message')}")
            return ResponseModel(
                code=400,
                message=result.get("message", "连接测试失败"),
                data=result
            )
    
    except ValueError as e:
        logger.error(f"ASR配置错误: provider={req.provider_id}, error={e}")
        return ResponseModel(
            code=400,
            message=f"配置错误: {str(e)}",
            data={"success": False, "message": str(e)}
        )
    except Exception as e:
        logger.error(f"ASR测试异常: provider={req.provider_id}, error={e}")
        return ResponseModel(
            code=500,
            message=f"测试失败: {str(e)}",
            data={"success": False, "message": str(e)}
        )


@router.post("/config", response_model=ResponseModel)
async def save_config(
    req: ASRConfigRequest,
    asr_factory: ASRFactory = Depends(get_asr_factory)
):
    """保存并应用配置
    
    验证通过后，持久化存储并切换当前生效服务商
    如果provider_id为空，则禁用ASR功能
    """
    try:
        service = asr_factory.config_service
        factory = asr_factory
        
        # 如果provider_id为空或"none"，禁用ASR
        if not req.provider_id or req.provider_id.lower() == "none":
            logger.info("禁用ASR功能")
            success = service.disable_asr()
            if success:
                factory.clear_cache()
                logger.info("ASR已禁用")
                return ResponseModel(
                    code=200,
                    message="ASR已禁用",
                    data={"provider_id": None}
                )
            else:
                raise HTTPException(status_code=500, detail="禁用ASR失败")
        
        # 获取服务商名称
        provider_name = factory._PROVIDERS.get(req.provider_id, (None, None))[1]
        if not provider_name:
            raise ValueError(f"未知的ASR提供商: {req.provider_id}")
        
        logger.info(f"保存ASR配置: provider={req.provider_id}")
        
        # 保存配置（内部会进行验证）
        success = service.save_config(
            provider_id=req.provider_id,
            name=provider_name,
            config=req.config,
            set_active=True
        )
        
        if success:
            # 清空指定服务商的缓存，下次使用时会重新加载
            factory.clear_cache(req.provider_id)
            
            logger.info(f"ASR配置保存成功: provider={req.provider_id}")
            return ResponseModel(
                code=200,
                message="配置保存成功",
                data={"provider_id": req.provider_id}
            )
        else:
            raise HTTPException(status_code=500, detail="保存配置失败")
    
    except ValueError as e:
        logger.error(f"ASR配置验证失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"保存ASR配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存配置失败: {str(e)}")


@router.post("/transcribe", response_model=ResponseModel)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = None,
    asr_factory: ASRFactory = Depends(get_asr_factory)
):
    """语音转文本
    
    使用当前active的ASR服务商进行转录
    """
    try:
        logger.info(f"开始语音转录: filename={file.filename}, language={language}")
        
        # 读取音频数据
        audio_bytes = await file.read()
        logger.debug(f"音频文件大小: {len(audio_bytes)} bytes")
        
        # 获取ASR实例
        asr = asr_factory.get_default_asr()
        
        # 执行转录
        text = await asr.transcribe_async(audio_bytes, language)
        
        logger.info(f"转录成功: text_length={len(text)}")
        return ResponseModel(
            code=200,
            message="转录成功",
            data={"text": text}
        )
    
    except ValueError as e:
        logger.error(f"ASR配置错误: {e}")
        raise HTTPException(status_code=400, detail=f"配置错误: {str(e)}")
    except Exception as e:
        logger.error(f"语音转录失败: {e}")
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")
