"""日志系统配置 - 简化实用版"""
import sys
from pathlib import Path
from loguru import logger
from core.config import get_config

# 获取配置
config = get_config()
LOG_LEVEL = config.log_level

# 验证日志级别
VALID_LEVELS = ["TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"]
if LOG_LEVEL not in VALID_LEVELS:
    LOG_LEVEL = "INFO"

# 日志目录（延迟导入避免循环依赖）
def _get_log_dir() -> Path:
    """获取日志目录"""
    try:
        from core.paths import get_logs_dir
        return get_logs_dir()
    except ImportError:
        # 如果paths模块还未初始化，使用默认路径
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        return log_dir

LOG_DIR = _get_log_dir()

# 移除默认处理器
logger.remove()

# 1. 控制台输出（开发环境彩色，生产环境简洁）
if config.is_development:
    console_format = (
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan> - "
        "<level>{message}</level>"
    )
else:
    console_format = (
        "{time:YYYY-MM-DD HH:mm:ss} | "
        "{level: <8} | "
        "{name}:{function} - "
        "{message}"
    )

logger.add(
    sys.stdout,
    format=console_format,
    level=LOG_LEVEL,
    colorize=config.is_development,
)

# 2. 所有日志文件（方便查看全貌）
logger.add(
    LOG_DIR / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level=LOG_LEVEL,
    rotation="100 MB",
    retention="7 days",
    encoding="utf-8",
)

# 3. 错误日志文件（单独记录，方便快速定位问题）
logger.add(
    LOG_DIR / "error.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}\n{exception}",
    level="ERROR",
    rotation="100 MB",
    retention="30 days",
    encoding="utf-8",
)

# 4. API 日志文件（可选，用于分析接口性能）
def api_formatter(record):
    """API 日志格式化器"""
    extra = record["extra"]
    # 只记录 API 请求
    if not extra.get("is_api"):
        return False
    
    request_id = extra.get("request_id", "")
    method = extra.get("method", "")
    path = extra.get("path", "")
    status_code = extra.get("status_code", "")
    duration = extra.get("duration", "")
    
    time_str = record["time"].strftime("%Y-%m-%d %H:%M:%S")
    return f"{time_str} | [{request_id}] {method:<6} {path:<50} | {status_code} | {duration}ms\n"

logger.add(
    LOG_DIR / "api.log",
    format=api_formatter,
    level="INFO",
    filter=lambda record: record["extra"].get("is_api", False),
    rotation="50 MB",
    retention="7 days",
    encoding="utf-8",
)


def get_logger(name: str = None):
    """获取 logger 实例
    
    Args:
        name: 模块名称（通常传入 __name__）
    
    Returns:
        logger 实例
    
    使用示例:
        logger = get_logger(__name__)
        logger.info("用户登录", extra={"user_id": user_id})
        logger.error("操作失败", exc_info=True)
    """
    return logger.bind(name=name or __name__)


def get_log_level() -> str:
    """获取当前日志级别"""
    return LOG_LEVEL


def get_environment() -> str:
    """获取当前环境"""
    return config.env
