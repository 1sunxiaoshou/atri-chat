"""ASR 基类接口"""
from abc import ABC, abstractmethod
from typing import Optional, Union, Dict, Any
from pathlib import Path


class ASRBase(ABC):
    """ASR 提供商基类"""
    
    @classmethod
    @abstractmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板
        
        返回该服务商需要的配置字段及其默认值（通常为None）
        
        Returns:
            配置模板字典，例如：
            {
                "api_key": None,
                "model": "whisper-1",
                "base_url": "https://api.openai.com/v1"
            }
        """
        pass
    
    @classmethod
    def get_sensitive_fields(cls) -> list[str]:
        """获取敏感字段列表（需要脱敏的字段）
        
        Returns:
            敏感字段名称列表，例如：["api_key", "secret_key"]
        """
        return []
    
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
            识认出的文本
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
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        Returns:
            {"success": bool, "message": str}
        """
        pass
