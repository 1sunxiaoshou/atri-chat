"""ASR 基类接口"""
from abc import ABC, abstractmethod
from typing import Optional, Union
from pathlib import Path


class ASRBase(ABC):
    """ASR 提供商基类"""
    
    @abstractmethod
    def transcribe(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（同步）
        
        Args:
            audio: 音频数据（bytes）或音频文件路径
            language: 可选，指定语言代码
            
        Returns:
            识别出的文本
        """
        pass
    
    @abstractmethod
    async def transcribe_async(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（异步）
        
        Args:
            audio: 音频数据（bytes）或音频文件路径
            language: 可选，指定语言代码
            
        Returns:
            识别出的文本
        """
        pass
