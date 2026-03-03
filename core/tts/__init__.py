"""TTS 模块

使用示例：
    from core.tts import TTSFactory
    
    factory = TTSFactory()
    tts = factory.get_default_tts()
    audio = await tts.synthesize_async("你好")

配置分离：
    - 供应商配置（TTSProvider.config_payload）：API地址、认证信息等
    - 音色配置（VoiceAsset.voice_config）：参考音频、语言设置等
    - 使用时自动合并：config = {**provider_config, **voice_config}
"""
from .base import TTSBase
from .registry import TTSRegistry
from .factory import TTSFactory

# 自动导入所有 Provider（触发装饰器注册）
from . import gpt_sovits  # noqa: F401
from . import genie_tts  # noqa: F401
from . import qwen_tts  # noqa: F401

__all__ = ["TTSBase", "TTSRegistry", "TTSFactory"]
