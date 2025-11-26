"""GPT-SoVITS TTS 实现"""
import httpx
from typing import Optional
from pathlib import Path

from .base import TTSBase


class GPTSoVITSTTS(TTSBase):
    """GPT-SoVITS TTS 实现"""
    
    def __init__(self, config: dict):
        """初始化
        
        Args:
            config: GPT-SoVITS配置字典
        """
        self.api_url = config.get("api_url", "http://localhost:9880")
        self.refer_wav_path = config.get("refer_wav_path", "")
        self.prompt_text = config.get("prompt_text", "")
        self.prompt_language = config.get("prompt_language", "zh")
        self.text_language = config.get("text_language", "zh")
        self.cut_punc = config.get("cut_punc", "，。")
        self.top_k = config.get("top_k", 5)
        self.top_p = config.get("top_p", 1.0)
        self.temperature = config.get("temperature", 1.0)
        self.speed = config.get("speed", 1.0)
    
    def synthesize(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（同步）"""
        lang = language or self.text_language
        
        # 构建请求参数
        params = {
            "text": text,
            "text_language": lang,
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_language": self.prompt_language,
            "cut_punc": self.cut_punc,
            "top_k": self.top_k,
            "top_p": self.top_p,
            "temperature": self.temperature,
            "speed": self.speed
        }
        
        with httpx.Client(timeout=60.0) as client:
            response = client.get(self.api_url, params=params)
            response.raise_for_status()
            return response.content
    
    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（异步）"""
        lang = language or self.text_language
        
        params = {
            "text": text,
            "text_language": lang,
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_language": self.prompt_language,
            "cut_punc": self.cut_punc,
            "top_k": self.top_k,
            "top_p": self.top_p,
            "temperature": self.temperature,
            "speed": self.speed
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(self.api_url, params=params)
            response.raise_for_status()
            return response.content
