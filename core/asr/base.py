"""ASR 基类接口"""
from abc import ABC, abstractmethod
from typing import Optional, Union, Dict, Any, Literal
from pathlib import Path
from typing_extensions import TypedDict


class ConfigField(TypedDict, total=False):
    """配置字段元数据"""
    type: Literal["string", "password", "number", "select", "file"]
    label: str
    description: str
    default: Any
    required: bool
    placeholder: str
    sensitive: bool
    options: list[str]
    min: float
    max: float
    step: float
    accept: str
    value: Any


class ASRBase(ABC):
    """ASR 提供商基类"""
    
    @classmethod
    @abstractmethod
    def get_config_template(cls) -> Dict[str, ConfigField]:
        """获取配置模板（带UI元数据）
        
        返回该服务商需要的配置字段及其UI渲染信息
        
        Returns:
            配置模板字典，例如：
            {
                "api_key": {
                    "type": "password",
                    "label": "API密钥",
                    "description": "OpenAI API密钥",
                    "default": None,
                    "required": True,
                    "placeholder": "sk-...",
                    "sensitive": True
                },
                "model": {
                    "type": "select",
                    "label": "模型",
                    "description": "选择Whisper模型",
                    "default": "whisper-1",
                    "required": True,
                    "options": ["whisper-1"]
                }
            }
        """
        pass
    

    
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
