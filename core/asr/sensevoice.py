"""SenseVoice-Small ONNX ASR 实现

使用 sherpa-onnx 运行 SenseVoice-Small 模型
支持中文、英语、日语、韩语、粤语
"""
import asyncio
import re
from pathlib import Path
from typing import Union, Optional, Dict, Any
import tempfile

try:
    import sherpa_onnx
except ImportError:
    raise ImportError(
        "sherpa-onnx 未安装。请运行: pip install sherpa-onnx"
    )

try:
    import soundfile as sf
    import soxr
except ImportError:
    raise ImportError(
        "soundfile 和 soxr 未安装。请运行: pip install soundfile soxr"
    )

from core.logger import get_logger

logger = get_logger(__name__)


# 正则表达式，提取 <|NEUTRAL|> 形式文本
EMOTION_PATTERN = re.compile(r"<\|(.*?)\|>")


class SenseVoiceASR:
    """SenseVoice-Small ONNX ASR（固定模式）
    
    特点：
    - 多语言支持：中文、英语、日语、韩语、粤语
    - 超低延迟：处理 10 秒音频仅需 70ms
    - 额外功能：语种识别、情感识别、声学事件检测
    - 纯 CPU 推理，无需 GPU
    """
    
    # 模型配置（固定）
    MODEL_CONFIG = {
        "model": "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17",
        "use_int8": True,  # 使用 INT8 量化版本
        "num_threads": 4,  # CPU 线程数
    }
    
    # 支持的语言代码
    SUPPORTED_LANGUAGES = {
        "zh": "中文",
        "en": "英语", 
        "ja": "日语",
        "ko": "韩语",
        "yue": "粤语",
        "auto": "自动检测"
    }
    
    def __init__(self, model_dir: Optional[str] = None, num_threads: int = 4, auto_download: bool = True):
        """初始化 SenseVoice ASR
        
        Args:
            model_dir: 模型目录路径（可选，默认 data/models/sensevoice）
            num_threads: CPU 线程数
            auto_download: 是否在模型不存在时后台下载
            
        Raises:
            FileNotFoundError: 模型文件不存在且 auto_download=False
        """
        self.num_threads = num_threads
        self.auto_download = auto_download
        
        # 设置模型目录
        if model_dir:
            self.model_dir = Path(model_dir)
        else:
            self.model_dir = Path("data/models/sensevoice")
        
        # 延迟初始化识别器
        self._recognizer = None
        self._downloading = False
        self._download_error = None
        
        # 启动时检查模型文件
        if not self._check_model_files():
            if auto_download:
                logger.warning(
                    f"SenseVoice 模型未找到，将在后台下载",
                    extra={"model_dir": str(self.model_dir)}
                )
                # 启动后台下载
                self._start_background_download()
            else:
                error_msg = (
                    f"SenseVoice 模型未找到！\n"
                    f"模型目录: {self.model_dir}\n"
                    f"请运行以下命令下载模型:\n"
                    f"  python -m core.asr.model_downloader\n"
                    f"或使用 uv:\n"
                    f"  uv run python -m core.asr.model_downloader"
                )
                logger.error(error_msg)
                raise FileNotFoundError(error_msg)
    
    def _start_background_download(self):
        """启动后台下载任务"""
        import threading
        
        self._downloading = True
        
        def _download():
            try:
                from .model_downloader import download_sensevoice_model
                
                logger.info("开始后台下载 SenseVoice 模型...")
                download_sensevoice_model(
                    model_type="int8",
                    target_dir=self.model_dir
                )
                logger.info("✓ 模型下载完成，ASR 功能现已可用")
                
            except Exception as e:
                self._download_error = str(e)
                logger.error(f"后台下载模型失败: {e}", exc_info=True)
            finally:
                self._downloading = False
        
        thread = threading.Thread(target=_download, daemon=True, name="ASR-ModelDownloader")
        thread.start()
    
    def _ensure_initialized(self):
        """确保识别器已初始化（延迟初始化）"""
        if self._recognizer is None:
            # 检查是否正在下载
            if self._downloading:
                raise RuntimeError(
                    "ASR 模型正在后台下载中，请稍后再试。\n"
                    "您也可以手动下载: python -m core.asr.model_downloader"
                )
            
            # 检查下载是否失败
            if self._download_error:
                raise RuntimeError(
                    f"ASR 模型下载失败: {self._download_error}\n"
                    "请手动下载: python -m core.asr.model_downloader"
                )
            
            # 再次检查模型文件
            if not self._check_model_files():
                raise FileNotFoundError(
                    f"ASR 模型文件不存在: {self.model_dir}\n"
                    "请运行: python -m core.asr.model_downloader"
                )
            
            self._init_recognizer()
    
    def _init_recognizer(self):
        """初始化识别器"""
        try:
            # 构建模型文件路径
            if self.MODEL_CONFIG["use_int8"]:
                model_file = str(self.model_dir / "model_q8.onnx")
            else:
                model_file = str(self.model_dir / "model.onnx")
            
            tokens_file = str(self.model_dir / "tokens.txt")
            
            # 使用 from_sense_voice 创建识别器
            self._recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
                model=model_file,
                tokens=tokens_file,
                num_threads=self.num_threads,
                sample_rate=16000,
                use_itn=True,  # 使用逆文本归一化
                debug=False,
                language="auto",  # 自动检测语言
                provider="cpu",
            )
            
            logger.info(
                "SenseVoice ASR 初始化成功",
                extra={
                    "model_dir": str(self.model_dir),
                    "use_int8": self.MODEL_CONFIG["use_int8"],
                    "num_threads": self.num_threads
                }
            )
            
        except Exception as e:
            logger.error(f"SenseVoice ASR 初始化失败: {e}", exc_info=True)
            raise
    
    def _check_model_files(self) -> bool:
        """检查模型文件是否存在
        
        Returns:
            是否存在必需的模型文件
        """
        if not self.model_dir.exists():
            return False
        
        # 检查必需文件
        required_files = ["tokens.txt"]
        
        if self.MODEL_CONFIG["use_int8"]:
            required_files.append("model_q8.onnx")
        else:
            required_files.append("model.onnx")
        
        for filename in required_files:
            if not (self.model_dir / filename).exists():
                logger.debug(f"缺少文件: {filename}")
                return False
        
        return True
    
    def _load_audio(self, audio: Union[bytes, str, Path]) -> tuple:
        """加载音频数据并重采样到 16kHz
        
        Args:
            audio: 音频数据（bytes）或音频文件路径
            
        Returns:
            (samples, sample_rate) 元组
        """
        if isinstance(audio, bytes):
            # 保存到临时文件
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio)
                tmp_path = tmp.name
            
            try:
                # 读取音频
                audio_data, sample_rate = sf.read(tmp_path, dtype="float32")
            finally:
                # 清理临时文件
                Path(tmp_path).unlink(missing_ok=True)
        else:
            # 直接读取文件
            audio_path = str(audio)
            audio_data, sample_rate = sf.read(audio_path, dtype="float32")
        
        # 如果是多声道，提取第一个声道
        if len(audio_data.shape) > 1:
            audio_data = audio_data[:, 0]
        
        # 重采样到 16kHz
        if sample_rate != 16000:
            audio_data = soxr.resample(audio_data, sample_rate, 16000)
            sample_rate = 16000
            logger.debug(f"音频已重采样到 16kHz")
        
        return audio_data, sample_rate
    
    @staticmethod
    def _extract_emotion(text: str) -> str:
        """提取情感标记
        
        Args:
            text: 包含情感标记的文本，如 <|NEUTRAL|>
            
        Returns:
            提取的情感文本
        """
        match = EMOTION_PATTERN.search(text)
        if match:
            return match.group(1)
        return text
    
    def transcribe(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（同步）
        
        Args:
            audio: 音频数据（bytes）或音频文件路径
            language: 语言代码（可选，默认自动检测）
                     支持: zh, en, ja, ko, yue, auto
            
        Returns:
            识别出的文本
        """
        # 延迟初始化识别器
        self._ensure_initialized()
        
        try:
            # 加载音频并重采样
            samples, sample_rate = self._load_audio(audio)
            
            # 创建音频流
            stream = self._recognizer.create_stream()
            stream.accept_waveform(sample_rate, samples)
            
            # 执行识别
            self._recognizer.decode_stream(stream)
            result = stream.result
            
            # 提取文本
            text = result.text.strip()
            
            # 提取额外信息
            detected_lang = self._extract_emotion(result.lang) if hasattr(result, 'lang') else None
            emotion = self._extract_emotion(result.emotion) if hasattr(result, 'emotion') else None
            
            logger.debug(
                "识别完成",
                extra={
                    "text": text,
                    "detected_language": detected_lang,
                    "emotion": emotion
                }
            )
            
            return text
            
        except Exception as e:
            logger.error(f"语音识别失败: {e}", exc_info=True)
            raise
    
    async def transcribe_async(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（异步）
        
        Args:
            audio: 音频数据（bytes）或音频文件路径
            language: 语言代码（可选，默认自动检测）
            
        Returns:
            识别出的文本
        """
        # 在线程池中运行同步方法
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.transcribe,
            audio,
            language
        )
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接（检查模型是否可用）
        
        Returns:
            {"success": bool, "message": str, "info": dict}
        """
        try:
            # 延迟初始化识别器
            self._ensure_initialized()
            
            # 创建一个测试音频流
            stream = self._recognizer.create_stream()
            
            return {
                "success": True,
                "message": "SenseVoice ASR 可用",
                "info": {
                    "model": self.MODEL_CONFIG["model"],
                    "use_int8": self.MODEL_CONFIG["use_int8"],
                    "num_threads": self.num_threads,
                    "supported_languages": list(self.SUPPORTED_LANGUAGES.keys())
                }
            }
            
        except Exception as e:
            logger.error(f"测试连接失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"测试失败: {str(e)}"
            }
    
    @classmethod
    def get_info(cls) -> Dict[str, Any]:
        """获取模型信息
        
        Returns:
            模型信息字典
        """
        return {
            "name": "SenseVoice-Small",
            "provider": "FunAudioLLM",
            "model": cls.MODEL_CONFIG["model"],
            "features": [
                "语音识别 (ASR)",
                "语种识别 (LID)",
                "情感识别 (SER)",
                "声学事件检测 (AED)"
            ],
            "supported_languages": cls.SUPPORTED_LANGUAGES,
            "inference_speed": "70ms / 10s audio",
            "model_size": "~200MB (INT8)",
            "device": "CPU"
        }
