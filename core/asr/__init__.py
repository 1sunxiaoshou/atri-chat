"""ASR 模块 - 固定使用 SenseVoice-Small ONNX"""
from .sensevoice import SenseVoiceASR

# 导出单一 ASR 实现
__all__ = ["SenseVoiceASR", "get_asr"]


# 全局单例
_asr_instance = None


def get_asr(model_dir: str = None, num_threads: int = 4, auto_download: bool = True) -> SenseVoiceASR:
    """获取 ASR 实例（单例模式）
    
    Args:
        model_dir: 模型目录路径（可选，默认 data/models/sensevoice）
        num_threads: CPU 线程数
        auto_download: 是否自动下载模型（如果不存在）
        
    Returns:
        SenseVoiceASR 实例
    """
    global _asr_instance
    
    if _asr_instance is None:
        _asr_instance = SenseVoiceASR(
            model_dir=model_dir,
            num_threads=num_threads,
            auto_download=auto_download
        )
    
    return _asr_instance
