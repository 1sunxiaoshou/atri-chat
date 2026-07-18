"""日志系统配置 - 显式引导架构"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from loguru import logger as _base_logger

# ============================================================
# 1. 哑配置部分 (仅定义格式，不触碰 IO)
# ============================================================

ERROR_LEVEL_NO = 40


def _normalize_stdlib_extra(record: dict[str, Any]):
    """兼容标准 logging 风格的 extra={"key": "value"} 写法。"""
    nested_extra = record["extra"].pop("extra", None)
    if isinstance(nested_extra, dict):
        for key, value in nested_extra.items():
            record["extra"].setdefault(key, value)
    record["extra"].setdefault("request_id", "-")


logger = _base_logger.patch(_normalize_stdlib_extra)


def _safe_print(msg: str):
    """在日志系统完全启动前的保险输出"""
    if sys.stdout is not None:
        try:
            print(msg)
        except Exception:
            pass


def _format_access_record(record: dict[str, Any]) -> str:
    """访问日志保持单行可读格式。"""
    extra = record["extra"]
    duration_ms = extra.get("duration_ms", extra.get("duration", "-"))
    return (
        f"{record['time'].strftime('%Y-%m-%d %H:%M:%S')} | "
        f"{extra.get('ip', '-'):<15} | "
        f"[{extra.get('request_id', '-')}] | "
        f"{extra.get('method', '-'):<6} "
        f"{extra.get('path', '-'):<60} | "
        f"{extra.get('status_code', '-'):>3} | "
        f"{duration_ms:>5}ms\n"
    )


# ============================================================
# 2. 引导控制部分 (由 core.bootstrap 显式调用)
# ============================================================

_console_setup = False
_file_setup = False
_pending_file_config: dict[str, Any] | None = None


def setup_logging(
    log_level: str = "INFO",
    log_dir: Path | None = None,
    is_development: bool = True,
    defer_file_logging: bool = False,
):
    """引导并激活日志系统

    Args:
        log_level: 捕获日志的最低级别
        log_dir: 日志文件存放目录（绝对路径）
        is_development: 是否为开发环境（彩色输出开关）
    """
    global _console_setup, _pending_file_config
    if _console_setup:
        if log_dir:
            _pending_file_config = {
                "log_level": log_level,
                "log_dir": log_dir,
            }
            if not defer_file_logging:
                ensure_file_logging()
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
        console_level = log_level.upper()
    else:
        console_format = (
            "{time:YYYY-MM-DD HH:mm:ss} | "
            "{level: <8} | "
            "{name}:{function}:{line} - {message}"
        )
        console_level = "WARNING"

    if sys.stdout is not None:
        logger.add(
            sys.stdout,
            format=console_format,
            level=console_level,
            colorize=is_development,
        )

    _console_setup = True

    # 2.2 文件处理器配置可以延后到 ready 之后，避免阻塞冷启动
    if log_dir:
        _pending_file_config = {
            "log_level": log_level,
            "log_dir": log_dir,
        }
        if not defer_file_logging:
            ensure_file_logging()

    logger.debug(f"日志系统已按配置就位: Level={log_level}, Dir={log_dir}")


def ensure_file_logging():
    """补齐文件日志处理器。可在服务 ready 后后台调用。"""
    global _file_setup, _pending_file_config
    if _file_setup or not _pending_file_config:
        return

    log_level = _pending_file_config["log_level"]
    log_dir = _pending_file_config["log_dir"]

    try:
        log_dir.mkdir(parents=True, exist_ok=True)

        logger.add(
            log_dir / "app.log",
            format=(
                "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
                "{level: <8} | "
                "[{extra[request_id]}] | "
                "{name}:{function}:{line} - {message}"
            ),
            level=log_level,
            filter=lambda record: (
                record["level"].no < ERROR_LEVEL_NO
                and record["extra"].get("channel") != "access"
            ),
            rotation="100 MB",
            retention="7 days",
            encoding="utf-8",
            enqueue=True,
        )

        logger.add(
            log_dir / "error.log",
            format=(
                "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
                "{level: <8} | "
                "[{extra[request_id]}] | "
                "{name}:{function}:{line} - {message}"
            ),
            level="ERROR",
            rotation="100 MB",
            retention="30 days",
            encoding="utf-8",
            enqueue=True,
            backtrace=True,
            diagnose=True,
        )

        logger.add(
            log_dir / "access.log",
            format=_format_access_record,
            level="INFO",
            filter=lambda record: record["extra"].get("channel") == "access",
            rotation="50 MB",
            retention="7 days",
            encoding="utf-8",
            enqueue=True,
        )
        _file_setup = True
    except Exception as e:
        _safe_print(f"Warning: Failed to initialize file logging handlers: {e}")


def get_logger(name: str = None):
    """获取 logger 实例。保留 name 参数以兼容现有调用。"""
    return logger
