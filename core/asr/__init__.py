"""SenseVoice ASR 核心模块"""
from functools import lru_cache
from .sensevoice import SenseVoiceASR


@lru_cache(maxsize=1)
def get_asr_engine() -> SenseVoiceASR:
    """获取 ASR 引擎实例（单例模式）
    
    使用 lru_cache 确保全局只有一个 ASR 实例，
    自动通过 get_settings() 加载配置。
    
    Returns:
        SenseVoiceASR 实例
    """
    from core.config import get_settings
    
    settings = get_settings()
    model_dir = str(settings.asr_models_dir / "sensevoice")
    
    return SenseVoiceASR(
        model_dir=model_dir,
        num_threads=4  # 可以后续从配置中读取
    )


# 兼容性保留
def get_asr(model_dir: str, num_threads: int = 4) -> SenseVoiceASR:
    """获取 ASR 实例（兼容性保留）
    
    注意：推荐使用 get_asr_engine() 替代此方法
    """
    return get_asr_engine()
