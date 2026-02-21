"""ASR 路由 - 固定使用 SenseVoice-Small ONNX"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from api.schemas import ResponseModel
from core.asr import get_asr
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class TranscribeRequest(BaseModel):
    """转录请求"""
    language: Optional[str] = None  # zh, en, ja, ko, yue, auto


@router.post("/transcribe", response_model=ResponseModel)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = None
):
    """语音转文本
    
    Args:
        file: 音频文件（支持 WAV, MP3 等格式）
        language: 语言代码（可选）
                 - zh: 中文
                 - en: 英语
                 - ja: 日语
                 - ko: 韩语
                 - yue: 粤语
                 - auto: 自动检测（默认）
    
    Returns:
        识别出的文本
    """
    try:
        logger.info(
            "开始语音转录",
            extra={
                "filename": file.filename,
                "content_type": file.content_type,
                "language": language or "auto"
            }
        )
        
        # 读取音频数据
        audio_bytes = await file.read()
        logger.debug(f"音频文件大小: {len(audio_bytes)} bytes")
        
        # 获取 ASR 实例
        asr = get_asr()
        
        # 执行转录
        text = await asr.transcribe_async(audio_bytes, language)
        
        logger.info(
            "转录成功",
            extra={
                "text_length": len(text),
                "text_preview": text[:50] if len(text) > 50 else text
            }
        )
        
        return ResponseModel(
            code=200,
            message="转录成功",
            data={
                "text": text,
                "language": language or "auto"
            }
        )
    
    except Exception as e:
        logger.error(f"语音转录失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")
