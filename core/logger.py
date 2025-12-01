"""日志系统配置"""
import sys
import os
from pathlib import Path
from loguru import logger

# 从环境变量获取日志级别，默认为 INFO
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# 验证日志级别
VALID_LEVELS = ["TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"]
if LOG_LEVEL not in VALID_LEVELS:
    LOG_LEVEL = "INFO"

# 日志目录
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# 移除默认处理器
logger.remove()

# 控制台输出 - 开发环境彩色输出
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[category]}</cyan> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level=LOG_LEVEL,
    colorize=True,
)

# 文件输出 - 所有日志
logger.add(
    LOG_DIR / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]} | {name}:{function}:{line} - {message}",
    level=LOG_LEVEL,
    rotation="500 MB",
    retention="7 days",
    encoding="utf-8",
)

def _add_category_handlers():
    """添加分类日志处理器"""
    # 文件输出 - 错误日志
    logger.add(
        LOG_DIR / "error.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]} | {name}:{function}:{line} - {message}\n{exception}",
        level="ERROR",
        rotation="500 MB",
        retention="30 days",
        encoding="utf-8",
    )

    # 文件输出 - API请求日志
    logger.add(
        LOG_DIR / "api.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[method]} {extra[path]} | {message}",
        level="INFO",
        filter=lambda record: record["extra"].get("category") == "API",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 业务逻辑日志
    logger.add(
        LOG_DIR / "business.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
        level="INFO",
        filter=lambda record: record["extra"].get("category") == "BUSINESS",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 数据库操作日志
    logger.add(
        LOG_DIR / "database.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
        level="DEBUG",
        filter=lambda record: record["extra"].get("category") == "DATABASE",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 模型调用日志
    logger.add(
        LOG_DIR / "model.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
        level="INFO",
        filter=lambda record: record["extra"].get("category") == "MODEL",
        rotation="100 MB",
        retention="7 days",
        encoding="utf-8",
    )

    # 文件输出 - 性能日志
    logger.add(
        LOG_DIR / "performance.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[function]} | 耗时: {extra[elapsed_time]} - {message}",
        level="INFO",
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
        category: 日志分类 (API, BUSINESS, DATABASE, MODEL, PERFORMANCE, GENERAL)
    
    Returns:
        绑定了上下文的logger实例
    """
    return logger.bind(name=name or __name__, category=category, method="", path="", function="", elapsed_time="")


def get_log_level() -> str:
    """获取当前日志级别"""
    return LOG_LEVEL


def set_log_level(level: str):
    """动态设置日志级别
    
    Args:
        level: 日志级别 (TRACE, DEBUG, INFO, SUCCESS, WARNING, ERROR, CRITICAL)
    """
    global LOG_LEVEL
    level = level.upper()
    
    if level not in VALID_LEVELS:
        raise ValueError(f"无效的日志级别: {level}，有效值: {', '.join(VALID_LEVELS)}")
    
    LOG_LEVEL = level
    
    # 重新配置所有处理器
    logger.remove()
    
    # 控制台输出
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[category]}</cyan> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level=LOG_LEVEL,
        colorize=True,
    )
    
    # 文件输出 - 所有日志
    logger.add(
        LOG_DIR / "app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {extra[category]} | {name}:{function}:{line} - {message}",
        level=LOG_LEVEL,
        rotation="500 MB",
        retention="7 days",
        encoding="utf-8",
    )
    
    # 重新添加其他处理器（保持原有配置）
    _add_category_handlers()
