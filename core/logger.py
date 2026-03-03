"""日志系统配置 - 生产级实践"""
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
        from core.paths import get_path_manager
        return get_path_manager().logs_dir
    except ImportError:
        # 如果paths模块还未初始化，使用默认路径
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        return log_dir

LOG_DIR = _get_log_dir()

# 移除默认处理器
logger.remove()

# ============================================================
# 1. 控制台输出 - 开发调试用
# ============================================================
if config.is_development:
    # 开发环境：彩色输出，显示详细信息
    console_format = (
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan> - "
        "<level>{message}</level>"
    )
    console_level = "DEBUG"
else:
    # 生产环境：只显示警告和错误，减少噪音
    console_format = (
        "{time:YYYY-MM-DD HH:mm:ss} | "
        "{level: <8} | "
        "{message}"
    )
    console_level = "WARNING"

logger.add(
    sys.stdout,
    format=console_format,
    level=console_level,
    colorize=config.is_development,
)

# ============================================================
# 2. 应用日志 - 记录所有应用级别的日志
# ============================================================
# 目的：完整的应用运行记录，用于问题排查
logger.add(
    LOG_DIR / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
    level="INFO",  # 只记录 INFO 及以上，过滤掉 DEBUG
    rotation="100 MB",
    retention="7 days",
    encoding="utf-8",
    enqueue=True,  # 异步写入，提升性能
)

# ============================================================
# 3. 错误日志 - 单独记录错误，方便快速定位
# ============================================================
# 目的：快速查看所有错误，包含完整堆栈信息
logger.add(
    LOG_DIR / "error.log",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}\n{exception}",
    level="ERROR",
    rotation="100 MB",
    retention="30 days",  # 错误日志保留更久
    encoding="utf-8",
    enqueue=True,
)

# ============================================================
# 4. 访问日志 - 记录所有 HTTP 请求（类似 Nginx access.log）
# ============================================================
# 目的：性能分析、流量统计、异常访问检测
def access_formatter(record):
    """访问日志格式化器 - 类似 Nginx 格式"""
    extra = record["extra"]
    if not extra.get("is_access"):
        return False
    
    # 提取字段
    request_id = extra.get("request_id", "-")
    method = extra.get("method", "-")
    path = extra.get("path", "-")
    status_code = extra.get("status_code", "-")
    duration = extra.get("duration", "-")
    user_agent = extra.get("user_agent", "-")
    ip = extra.get("ip", "-")
    
    time_str = record["time"].strftime("%Y-%m-%d %H:%M:%S")
    
    # 格式：时间 | IP | 请求ID | 方法 路径 | 状态码 | 耗时 | User-Agent
    return f"{time_str} | {ip:<15} | [{request_id}] | {method:<6} {path:<60} | {status_code} | {duration:>5}ms | {user_agent}\n"

logger.add(
    LOG_DIR / "access.log",
    format=access_formatter,
    level="INFO",
    filter=lambda record: record["extra"].get("is_access", False),
    rotation="50 MB",
    retention="7 days",
    encoding="utf-8",
    enqueue=True,
)

# ============================================================
# 5. 慢查询日志 - 记录响应时间超过阈值的请求
# ============================================================
# 目的：性能优化，识别需要优化的接口
SLOW_THRESHOLD_MS = 1000  # 1秒

def slow_query_formatter(record):
    """慢查询日志格式化器"""
    extra = record["extra"]
    if not extra.get("is_slow_query"):
        return False
    
    request_id = extra.get("request_id", "-")
    method = extra.get("method", "-")
    path = extra.get("path", "-")
    duration = extra.get("duration", "-")
    
    time_str = record["time"].strftime("%Y-%m-%d %H:%M:%S")
    return f"{time_str} | [{request_id}] | {method} {path} | {duration}ms ⚠️\n"

logger.add(
    LOG_DIR / "slow.log",
    format=slow_query_formatter,
    level="WARNING",
    filter=lambda record: record["extra"].get("is_slow_query", False),
    rotation="50 MB",
    retention="30 days",
    encoding="utf-8",
    enqueue=True,
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
