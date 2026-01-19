"""日志系统配置"""
import sys
import re
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

# 敏感信息脱敏
SENSITIVE_PATTERNS = [
    (re.compile(r'(api[_-]?key["\s:=]+)[\w\-]{20,}', re.IGNORECASE), r'\1***'),
    (re.compile(r'(token["\s:=]+)[\w\-\.]{20,}', re.IGNORECASE), r'\1***'),
    (re.compile(r'(password["\s:=]+)[^\s,}]+', re.IGNORECASE), r'\1***'),
    (re.compile(r'(secret["\s:=]+)[^\s,}]+', re.IGNORECASE), r'\1***'),
    (re.compile(r'sk-[a-zA-Z0-9]{20,}'), r'sk-***'),
]

def sanitize_message(message: str) -> str:
    """脱敏敏感信息"""
    for pattern, replacement in SENSITIVE_PATTERNS:
        message = pattern.sub(replacement, message)
    return message

# 移除默认处理器
logger.remove()

# 控制台输出格式（根据环境区分）
if config.is_development:
    # 开发环境：彩色、详细
    console_format = (
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{extra[category]: <12}</cyan> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan> - "
        "<level>{message}</level>"
    )
else:
    # 生产环境：简洁、结构化
    console_format = (
        "{time:YYYY-MM-DD HH:mm:ss} | "
        "{level: <8} | "
        "{extra[category]: <12} | "
        "{name}:{function} - "
        "{message}"
    )

logger.add(
    sys.stdout,
    format=console_format,
    level=LOG_LEVEL,
    colorize=config.is_development,
    filter=lambda record: sanitize_message(str(record["message"])) and True,
)

# 文件输出 - 所有日志
logger.add(
    LOG_DIR / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]: <12} | {name}:{function}:{line} - {message}",
    level=LOG_LEVEL,
    rotation="500 MB",
    retention="7 days",
    encoding="utf-8",
    filter=lambda record: sanitize_message(str(record["message"])) and True,
)

def _add_category_handlers():
    """添加分类日志处理器"""
    # 文件输出 - 错误日志
    logger.add(
        LOG_DIR / "error.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]: <12} | {name}:{function}:{line} - {message}\n{exception}",
        level="ERROR",
        rotation="500 MB",
        retention="30 days",
        encoding="utf-8",
    )

    # 文件输出 - API请求日志
    logger.add(
        LOG_DIR / "api.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[method]: <6} {extra[path]: <50} | {extra[status_code]} | {extra[duration]}ms | {message}",
        level=LOG_LEVEL,
        filter=lambda record: record["extra"].get("category") == "API",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 业务逻辑日志
    logger.add(
        LOG_DIR / "business.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]: <12} | {name}:{function} - {message}",
        level=LOG_LEVEL,
        filter=lambda record: record["extra"].get("category") == "BUSINESS",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 数据库操作日志
    logger.add(
        LOG_DIR / "database.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]: <12} | {name}:{function} - {message}",
        level=LOG_LEVEL,
        filter=lambda record: record["extra"].get("category") == "DATABASE",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 模型调用日志
    logger.add(
        LOG_DIR / "model.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]: <12} | {name}:{function} - {message}",
        level=LOG_LEVEL,
        filter=lambda record: record["extra"].get("category") == "MODEL",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 性能日志
    logger.add(
        LOG_DIR / "performance.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[operation]: <30} | {extra[duration]}ms | {message}",
        level=LOG_LEVEL,
        filter=lambda record: record["extra"].get("category") == "PERFORMANCE",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )


# 初始化分类处理器
_add_category_handlers()


def get_logger(name: str = None, category: str = "GENERAL"):
    """获取logger实例
    
    Args:
        name: 模块名称
        category: 日志分类 (SYSTEM, API, BUSINESS, DATABASE, MODEL, PERFORMANCE, GENERAL)
    
    Returns:
        绑定了上下文的logger实例
    """
    return logger.bind(
        name=name or __name__, 
        category=category, 
        method="", 
        path="", 
        status_code="",
        duration="",
        operation="",
        function=""
    )


def get_log_level() -> str:
    """获取当前日志级别"""
    return LOG_LEVEL


def get_environment() -> str:
    """获取当前环境"""
    return config.env
