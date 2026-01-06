"""VRM 音频临时文件清理任务

定期清理超过 1 小时的临时音频文件
"""
import asyncio
import time
from pathlib import Path

from ..paths import get_path_manager
from ..logger import get_logger

logger = get_logger(__name__, category="VRM")


async def cleanup_old_audio_files(max_age_seconds: int = 3600):
    """清理旧的音频文件
    
    Args:
        max_age_seconds: 文件最大保留时间（秒），默认 1 小时
    """
    path_manager = get_path_manager()
    audio_dir = path_manager.vrm_audio_dir
    
    if not audio_dir.exists():
        return
    
    current_time = time.time()
    cleaned_count = 0
    
    for audio_file in audio_dir.glob("*.wav"):
        if not audio_file.is_file():
            continue
        
        # 检查文件年龄
        file_age = current_time - audio_file.stat().st_mtime
        
        if file_age > max_age_seconds:
            try:
                audio_file.unlink()
                cleaned_count += 1
            except Exception as e:
                logger.error(
                    f"删除音频文件失败: {audio_file}",
                    extra={"error": str(e)}
                )
    
    if cleaned_count > 0:
        logger.info(
            "清理旧音频文件",
            extra={"cleaned_count": cleaned_count}
        )


async def start_cleanup_task(interval_seconds: int = 300, max_age_seconds: int = 3600):
    """启动定期清理任务
    
    Args:
        interval_seconds: 清理间隔（秒），默认 5 分钟
        max_age_seconds: 文件最大保留时间（秒），默认 1 小时
    """
    logger.info(
        "启动音频清理任务",
        extra={
            "interval_seconds": interval_seconds,
            "max_age_seconds": max_age_seconds
        }
    )
    
    while True:
        try:
            await cleanup_old_audio_files(max_age_seconds)
        except Exception as e:
            logger.error(
                "音频清理任务失败",
                extra={"error": str(e)},
                exc_info=True
            )
        
        await asyncio.sleep(interval_seconds)
