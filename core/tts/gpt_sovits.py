"""GPT-SoVITS TTS 实现"""
import httpx
from typing import Optional
from pathlib import Path

from .base import TTSBase


class GPTSoVITSTTS(TTSBase):
    """GPT-SoVITS TTS 实现（适配 api_v2.py 的 POST /tts 接口）"""
    
    def __init__(self, config: dict):
        self.api_url = config.get("api_url", "http://localhost:9880") + "/tts"
        self.refer_wav_path = config.get("refer_wav_path", "")
        self.prompt_text = config.get("prompt_text", "")
        self.prompt_language = config.get("prompt_language", "zh")
        self.text_language = config.get("text_language", "zh")
    
    def synthesize(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（同步） - 使用 POST /tts"""
        lang = language or self.text_language
        
        # 构建 JSON 请求体（注意字段名！）
        json_data = {
            "text": text,
            "text_lang": lang,                     
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_lang": self.prompt_language,   
        }
        
        with httpx.Client(timeout=60.0) as client:
            response = client.post(self.api_url, json=json_data)  # ← 改为 POST + json
            response.raise_for_status()
            return response.content
    
    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（异步）"""
        lang = language or self.text_language
        
        json_data = {
            "text": text,
            "text_lang": lang,
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_lang": self.prompt_language,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.api_url, json=json_data)  # ← POST + json
            response.raise_for_status()
            return response.content