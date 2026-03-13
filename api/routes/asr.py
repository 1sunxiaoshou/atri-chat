"""ASR 路由 - 使用 SenseVoice-Small ONNX"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import Optional, Literal
from api.schemas import ResponseModel
from core.asr import SenseVoiceASR
from core.dependencies import get_asr
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

# 支持的语言类型
LanguageType = Literal["zh", "en", "ja", "ko", "yue", "auto"]

@router.post("/transcribe", response_model=ResponseModel)
async def transcribe_audio(
    file: UploadFile = File(..., description="音频文件（建议 WAV 格式，16kHz 采样率）"),
    language: Optional[LanguageType] = Form(default="auto"),
    use_int8: Optional[str] = Form(default="false"), # 改为接收 str 以处理前端传参
    asr: SenseVoiceASR = Depends(get_asr)
):
    """语音转文本 (纯异步非阻塞)"""
    try:
        # 1. 安全限制：检查文件大小 (限制 50MB)
        MAX_SIZE = 50 * 1024 * 1024
        audio_bytes = await file.read(MAX_SIZE)
        if len(audio_bytes) >= MAX_SIZE:
            raise ValueError("音频文件过大，请限制在 50MB 以内")
        if not audio_bytes:
            raise ValueError("上传的音频文件为空")
            
        # 2. 修正布尔转换：处理前端传来的字符串
        use_int8_bool = str(use_int8).lower() == "true"
        language = language or "auto"
        
        
        # 3. 异步转录
        text = await asr.transcribe_async(audio_bytes, language, use_int8_bool)
        
        return ResponseModel(
            code=200,
            message="转录成功",
            data={"text": text, "language": language, "precision": "INT8" if use_int8_bool else "FP32"}
        )
    
    except (ValueError, RuntimeError) as e:
        logger.warning("转录失败: {}", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("语音转录出现系统异常")
        raise HTTPException(status_code=500, detail="服务器内部推理错误")