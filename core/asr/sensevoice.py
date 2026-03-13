"""SenseVoice-Small ONNX ASR 推理引擎

负责音频的加载、重采样以及使用 sherpa-onnx 进行离线推理。
（纯粹的推理模块，极简无冗余版）
"""
import asyncio
import re
import io
from pathlib import Path
from typing import Union, Optional, Dict, Any

import sherpa_onnx
import soundfile as sf
import soxr

from core.logger import get_logger

logger = get_logger(__name__)

# 正则表达式，提取 SenseVoice 特有的 <|NEUTRAL|> 等情感/事件标记
EMOTION_PATTERN = re.compile(r"<\|(.*?)\|>")


class SenseVoiceASR:
    """SenseVoice-Small ONNX ASR 推理核心"""
    
    MODEL_CONFIG = {
        "model": "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17",
    }
    
    def __init__(self, model_dir: Optional[str] = None, num_threads: int = 4):
        self.num_threads = num_threads
        self.model_dir = Path(model_dir) if model_dir else Path("data/models/sensevoice")
        
        # 内存状态标记
        self._current_use_int8 = None
        self._current_language = None
        
        # 核心识别器单例
        self._recognizer = None

    def _ensure_initialized(self, use_int8: bool = False, language: str = "auto"):
        """确保识别器已就绪，并在参数改变时自动热重载"""
        # 检查配置是否发生变化，若改变则清空释放旧引擎
        if self._recognizer is not None:
            if self._current_use_int8 != use_int8 or self._current_language != language:
                self._recognizer = None
        
        # 如果为空，执行真正的加载逻辑
        if self._recognizer is None:
            if not self._check_model_files(use_int8):
                raise RuntimeError("语音识别模型未找到，请先在设置中下载模型资源。")
            
            self._init_recognizer(use_int8, language)
            
            # 等待模型成功加载不报错后，再更新当前状态
            self._current_use_int8 = use_int8
            self._current_language = language
    
    def _init_recognizer(self, use_int8: bool, language: str):
        """底层 sherpa-onnx 实例化"""
        try:
            model_file = str(self.model_dir / ("model_q8.onnx" if use_int8 else "model.onnx"))
            tokens_file = str(self.model_dir / "tokens.txt")
            
            self._recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
                model=model_file,
                tokens=tokens_file,
                num_threads=self.num_threads,
                sample_rate=16000,
                use_itn=True,  # 逆文本归一化（将"一百"转为"100"）
                debug=False,
                language=language,
                provider="cpu",
            )
        except Exception as e:
            logger.error("ASR模型加载失败: {}", str(e))
            raise RuntimeError(f"模型加载失败: {str(e)}")
            
    def _check_model_files(self, use_int8: bool) -> bool:
        """轻量级预检：防止传给 C++ 引擎后发生难以捕获的 Segment Fault"""
        if not (self.model_dir / "tokens.txt").exists(): return False
        if use_int8 and not (self.model_dir / "model_q8.onnx").exists(): return False
        if not use_int8 and not (self.model_dir / "model.onnx").exists(): return False
        return True

    def _load_audio(self, audio: Union[bytes, str, Path]) -> tuple:
        """从内存或磁盘安全解析音频并重采样"""
        try:
            if isinstance(audio, bytes):
                with io.BytesIO(audio) as audio_buffer:
                    audio_data, sample_rate = sf.read(audio_buffer, dtype="float32")
            else:
                audio_data, sample_rate = sf.read(str(audio), dtype="float32")
        except Exception:
            raise RuntimeError("音频解析失败，请确保录音是标准的 WAV 格式，且未损坏。")
        
        # 强制转换为单声道
        if len(audio_data.shape) > 1:
            audio_data = audio_data[:, 0]
        
        # soxr 自动重采样到 16000Hz
        if sample_rate != 16000:
            audio_data = soxr.resample(audio_data, sample_rate, 16000)
            sample_rate = 16000
            
        return audio_data, sample_rate
    
    def transcribe(self, audio: Union[bytes, str, Path], language: str = "auto", use_int8: bool = False) -> str:
        """语音转文字（同步）"""
        self._ensure_initialized(use_int8, language)
        
        try:
            samples, sample_rate = self._load_audio(audio)
            
            stream = self._recognizer.create_stream()
            stream.accept_waveform(sample_rate, samples)
            
            # 推理阶段
            self._recognizer.decode_stream(stream)
            
            # 净化文本并返回
            return EMOTION_PATTERN.sub("", stream.result.text).strip()
            
        except Exception as e:
            logger.error("ASR推理异常: {}", str(e))
            raise RuntimeError(f"推理失败: {str(e)}")
    
    async def transcribe_async(self, audio: Union[bytes, str], language: str = "auto", use_int8: bool = False) -> str:
        """将 CPU 密集的推理任务丢入线程池，释放 FastAPI 事件循环"""
        return await asyncio.to_thread(self.transcribe, audio, language, use_int8)

    async def test_connection(self) -> Dict[str, Any]:
        """连通性测试"""
        try:
            self._ensure_initialized(use_int8=False, language="auto")
            return {"success": True, "message": "ASR 引擎状态正常"}
        except Exception as e:
            return {"success": False, "message": str(e)}