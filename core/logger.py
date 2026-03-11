"""日志系统配置 - 显式引导架构"""
import sys
from pathlib import Path
from loguru import logger
from typing import Optional


# ============================================================
# 1. 哑配置部分 (仅定义格式，不触碰 IO)
# ============================================================

def _safe_print(msg: str):
    """在日志系统完全启动前的保险输出"""
    if sys.stdout is not None:
        try:
            print(msg)
        except Exception:
            pass


# ============================================================
# 2. 引导控制部分 (由 main.py 显式调用)
# ============================================================

_is_setup = False


def setup_logging(
    log_level: str = "INFO",
    log_dir: Optional[Path] = None,
    is_development: bool = True
):
    """引导并激活日志系统
    
    Args:
        log_level: 捕获日志的最低级别
        log_dir: 日志文件存放目录（绝对路径）
        is_development: 是否为开发环境（彩色输出开关）
    """
    global _is_setup
    if _is_setup:
        return
    
    # 清空默认处理器
    logger.remove()
    
    # 2.1 添加控制台处理器
    if is_development:
        console_format = (
            "<green>{time:HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan> - "
            "<level>{message}</level>"
        )
        console_level = "DEBUG"
    else:
        console_format = (
            "{time:YYYY-MM-DD HH:mm:ss} | "
            "{level: <8} | "
            "{message}"
        )
        console_level = "WARNING"

    if sys.stdout is not None:
        logger.add(
            sys.stdout,
            format=console_format,
            level=console_level,
            colorize=is_development,
        )

    # 2.2 添加文件处理器 (如果提供了目录)
    if log_dir:
        try:
            log_dir.mkdir(parents=True, exist_ok=True)
            
            # 基础应用日志
            logger.add(
                log_dir / "app.log",
                format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
                level=log_level,
                rotation="100 MB",
                retention="7 days",
                encoding="utf-8",
                enqueue=True,
            )
            
            # 错误专用日志
            logger.add(
                log_dir / "error.log",
                format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}\n{exception}",
                level="ERROR",
                rotation="100 MB",
                retention="30 days",
                encoding="utf-8",
                enqueue=True,
            )
            
            # 访问日志（由中间件调用，通过 extra 过滤）
            logger.add(
                log_dir / "access.log",
                format=lambda r: f"{r['time'].strftime('%Y-%m-%d %H:%M:%S')} | {r['extra'].get('ip', '-'):<15} | [{r['extra'].get('request_id', '-')}] | {r['extra'].get('method', '-'):<6} {r['extra'].get('path', '-'):<60} | {r['extra'].get('status_code', '-')} | {r['extra'].get('duration', '-'):>5}ms\n",
                level="INFO",
                filter=lambda record: record["extra"].get("is_access", False),
                rotation="50 MB",
                retention="7 days",
                encoding="utf-8",
                enqueue=True,
            )
        except Exception as e:
            _safe_print(f"Warning: Failed to initialize file logging handlers: {e}")

    _is_setup = True
    logger.debug(f"日志系统已按配置就位: Level={log_level}, Dir={log_dir}")


def get_logger(name: str = None):
    """获取绑定的 logger 实例"""
    return logger.bind(name=name or __name__)
