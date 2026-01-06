"""TTS 模块

使用示例：
    from core.tts import TTSFactory
    
    factory = TTSFactory()
    tts = factory.get_default_tts()
    audio = await tts.synthesize_async("你好")
"""
from .base import TTSBase
from .registry import TTSRegistry
from .factory import TTSFactory

# 自动导入所有 Provider（触发装饰器注册）
from . import gpt_sovits  # noqa: F401
from . import genie_tts  # noqa: F401

__all__ = ["TTSBase", "TTSRegistry", "TTSFactory"]
