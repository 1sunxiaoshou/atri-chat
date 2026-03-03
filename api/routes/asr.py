"""ASR 路由 - 使用 SenseVoice-Small ONNX"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, Literal
from api.schemas import ResponseModel
from core.asr import get_asr
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


# 支持的语言类型
LanguageType = Literal["zh", "en", "ja", "ko", "yue", "auto"]


class TranscribeRequest(BaseModel):
    """转录请求"""
    language: Optional[LanguageType] = Field(
        default="auto",
        description="语言代码: zh(中文), en(英语), ja(日语), ko(韩语), yue(粤语), auto(自动检测)"
    )
    use_int8: Optional[bool] = Field(
        default=False,
        description="是否使用 INT8 量化模型（False=FP32 全精度，True=INT8 量化）"
    )


@router.post("/transcribe", response_model=ResponseModel)
async def transcribe_audio(
    file: UploadFile = File(..., description="音频文件（WAV 格式，16kHz 采样率）"),
    language: Optional[LanguageType] = Form(default="auto", description="语言代码"),
    use_int8: Optional[bool] = Form(default=False, description="是否使用 INT8 量化模型")
):
    """语音转文本
    
    支持多语言识别，可选择模型精度。
    
    **语言代码：**
    - `zh`: 中文（普通话）
    - `en`: 英语
    - `ja`: 日语
    - `ko`: 韩语
    - `yue`: 粤语
    - `auto`: 自动检测（默认）
    
    **模型精度：**
    - `False`: FP32 全精度（精度更高，速度较慢，默认）
    - `True`: INT8 量化（速度更快，精度略低）
    
    **注意：**
    - 切换语言或精度时会自动重新加载模型
    - 首次调用需要初始化模型（约 4-5 秒）
    - 后续相同配置的调用速度很快（约 200ms）
    
    **返回：**
    - `text`: 识别出的文本
    - `language`: 使用的语言设置
    - `precision`: 使用的模型精度
    """
    try:
        # 设置默认值
        if language is None:
            language = "auto"
        if use_int8 is None:
            use_int8 = False
        
        logger.info(
            "开始语音转录",
            extra={
                "filename": file.filename,
                "content_type": file.content_type,
                "language": language,
                "precision": "INT8" if use_int8 else "FP32"
            }
        )
        
        # 读取音频数据
        audio_bytes = await file.read()
        logger.debug(f"音频文件大小: {len(audio_bytes)} bytes")
        
        # 获取 ASR 实例
        asr = get_asr()
        
        # 执行转录
        text = await asr.transcribe_async(audio_bytes, language, use_int8)
        
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
                "language": language,
                "precision": "INT8" if use_int8 else "FP32"
            }
        )
    
    except Exception as e:
        logger.error(f"语音转录失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")
