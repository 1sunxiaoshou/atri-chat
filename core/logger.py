"""日志系统配置"""
import sys
from pathlib import Path
from loguru import logger

# 日志目录
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# 移除默认处理器
logger.remove()

# 控制台输出 - 开发环境彩色输出
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG",
    colorize=True,
)

# 文件输出 - 所有日志
logger.add(
    LOG_DIR / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="DEBUG",
    rotation="500 MB",  # 文件大小超过500MB时轮转
    retention="7 days",  # 保留7天的日志
    encoding="utf-8",
)

# 文件输出 - 错误日志
logger.add(
    LOG_DIR / "error.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="ERROR",
    rotation="500 MB",
    retention="30 days",
    encoding="utf-8",
)

# 文件输出 - 性能日志
logger.add(
    LOG_DIR / "performance.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="DEBUG",
    filter=lambda record: "performance" in record["extra"],
    rotation="500 MB",
    retention="7 days",
    encoding="utf-8",
)


def get_logger(name: str = None):
    """获取logger实例"""
    return logger.bind(name=name or __name__)
