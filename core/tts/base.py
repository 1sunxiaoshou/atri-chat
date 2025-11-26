"""TTS 基类接口"""
from abc import ABC, abstractmethod
from typing import Optional


class TTSBase(ABC):
    """TTS 提供商基类"""
    
    @abstractmethod
    def synthesize(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（同步）
        
        Args:
            text: 要转换的文本
            language: 可选，指定语言代码
            
        Returns:
            音频数据（bytes）
        """
        pass
    
    @abstractmethod
    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（异步）
        
        Args:
            text: 要转换的文本
            language: 可选，指定语言代码
            
        Returns:
            音频数据（bytes）
        """
        pass
