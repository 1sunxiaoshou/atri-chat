"""OpenAI Whisper ASR 实现"""
import os
from typing import Optional, Union
from pathlib import Path
from openai import OpenAI, AsyncOpenAI

from .base import ASRBase


class OpenAIWhisperASR(ASRBase):
    """OpenAI Whisper ASR 实现"""
    
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
            from io import BytesIO
            audio_file = BytesIO(audio)
            audio_file.name = "audio.wav"
        else:
            # 文件路径
            audio_file = open(audio, "rb")
        
        try:
            response = self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=lang,
                temperature=self.temperature
            )
            return response.text
        finally:
            if hasattr(audio_file, 'close'):
                audio_file.close()
    
    async def transcribe_async(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（异步）"""
        lang = language or self.language
        
        # 处理不同输入类型
        if isinstance(audio, bytes):
            from io import BytesIO
            audio_file = BytesIO(audio)
            audio_file.name = "audio.wav"
        else:
            audio_file = open(audio, "rb")
        
        try:
            response = await self.async_client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=lang,
                temperature=self.temperature
            )
            return response.text
        finally:
            if hasattr(audio_file, 'close'):
                audio_file.close()
