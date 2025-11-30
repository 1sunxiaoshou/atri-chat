"""TTS 基类接口"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Literal, AsyncGenerator
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
    
    async def synthesize_stream(
        self,
        text: str,
        language: Optional[str] = None,
        media_type: str = "wav"
    ) -> AsyncGenerator[bytes, None]:
        """文字转语音（流式输出）
        
        默认实现：如果子类不支持流式，则回退到一次性返回
        
        Args:
            text: 要转换的文本
            language: 可选，指定语言代码
            media_type: 音频格式，如 "wav", "mp3", "ogg"
            
        Yields:
            音频数据块（bytes）
        """
        # 默认回退：一次性返回全部数据
        audio_bytes = await self.synthesize_async(text, language)
        yield audio_bytes
    
    def supports_streaming(self) -> bool:
        """是否支持流式传输
        
        Returns:
            True 表示支持流式，False 表示仅支持一次性返回
        """
        return False
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        Returns:
            {"success": bool, "message": str}
        """
        pass
