"""TTS 基类接口"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Literal
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


class TTSBase(ABC):
    """TTS 提供商基类"""
    
    @classmethod
    @abstractmethod
    def get_config_template(cls) -> Dict[str, ConfigField]:
        """获取配置模板（带UI元数据）
        
        返回该服务商需要的配置字段及其UI渲染信息
        
        Returns:
            配置模板字典
        """
        pass
    
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
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        Returns:
            {"success": bool, "message": str}
        """
        pass
