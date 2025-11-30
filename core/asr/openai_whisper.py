"""OpenAI Whisper ASR 实现"""
import os
import io
from typing import Optional, Union, Dict, Any
from pathlib import Path
from openai import OpenAI, AsyncOpenAI

from .base import ASRBase


class OpenAIWhisperASR(ASRBase):
    """OpenAI Whisper ASR 实现"""
    
    @classmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板（带UI元数据）"""
        return {
            "api_key": {
                "type": "password",
                "label": "API密钥",
                "description": "OpenAI API密钥，可从 https://platform.openai.com/api-keys 获取",
                "default": None,
                "required": True,
                "placeholder": "sk-...",
                "sensitive": True
            },
            "base_url": {
                "type": "string",
                "label": "API地址",
                "description": "OpenAI API基础URL，使用代理或第三方服务时修改",
                "default": "https://api.openai.com/v1",
                "required": False,
                "placeholder": "https://api.openai.com/v1"
            },
            "model": {
                "type": "select",
                "label": "模型",
                "description": "选择Whisper模型版本",
                "default": "whisper-1",
                "required": True,
                "options": ["whisper-1"]
            },
            "temperature": {
                "type": "number",
                "label": "温度",
                "description": "采样温度，范围0-1，较低的值使输出更确定",
                "default": 0.0,
                "required": False,
                "min": 0.0,
                "max": 1.0,
                "step": 0.1
            }
        }
    
    def __init__(self, config: dict):
        """初始化
        
        Args:
            config: OpenAI配置字典
        """
        api_key = config.get("api_key") or os.getenv("OPENAI_API_KEY")
        base_url = config.get("base_url") or None
        
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.async_client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        
        self.model = config.get("model", "whisper-1")
        self.language = config.get("language")
        self.temperature = config.get("temperature", 0.0)
    
    def transcribe(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（同步）"""
        lang = language or self.language
        
        # 处理不同输入类型
        if isinstance(audio, bytes):
            # bytes需要包装成文件对象
            audio_file = io.BytesIO(audio)
            audio_file.name = "audio.wav"
            
            response = self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=lang,
                temperature=self.temperature
            )
            return response.text
        else:
            # 文件路径
            with open(audio, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    language=lang,
                    temperature=self.temperature
                )
                return response.text
    
    async def transcribe_async(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（异步）"""
        lang = language or self.language
        
        # 处理不同输入类型
        if isinstance(audio, bytes):
            audio_file = io.BytesIO(audio)
            audio_file.name = "audio.wav"
            
            response = await self.async_client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=lang,
                temperature=self.temperature
            )
            return response.text
        else:
            # 文件路径 - 异步读取
            with open(audio, "rb") as audio_file:
                response = await self.async_client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    language=lang,
                    temperature=self.temperature
                )
                return response.text
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        发送1秒静音音频测试API连接
        """
        try:
            # 生成1秒静音WAV（16kHz, 单声道）
            silent_audio = self._generate_silent_wav(duration=1.0, sample_rate=16000)
            
            # 尝试转录
            audio_file = io.BytesIO(silent_audio)
            audio_file.name = "test.wav"
            
            await self.async_client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                temperature=self.temperature
            )
            
            return {"success": True, "message": "连接成功"}
        
        except Exception as e:
            error_msg = str(e)
            if "api_key" in error_msg.lower() or "unauthorized" in error_msg.lower():
                return {"success": False, "message": "API Key无效"}
            elif "timeout" in error_msg.lower():
                return {"success": False, "message": "连接超时"}
            else:
                return {"success": False, "message": f"连接失败: {error_msg}"}
    
    @staticmethod
    def _generate_silent_wav(duration: float = 1.0, sample_rate: int = 16000) -> bytes:
        """生成静音WAV文件
        
        Args:
            duration: 时长（秒）
            sample_rate: 采样率
            
        Returns:
            WAV文件字节数据
        """
        import struct
        
        num_samples = int(duration * sample_rate)
        num_channels = 1
        sample_width = 2  # 16-bit
        
        # WAV文件头
        wav_header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + num_samples * num_channels * sample_width,
            b'WAVE',
            b'fmt ',
            16,  # fmt chunk size
            1,   # PCM
            num_channels,
            sample_rate,
            sample_rate * num_channels * sample_width,
            num_channels * sample_width,
            sample_width * 8,
            b'data',
            num_samples * num_channels * sample_width
        )
        
        # 静音数据（全0）
        silent_data = b'\x00' * (num_samples * num_channels * sample_width)
        
        return wav_header + silent_data
