"""日志工具函数"""
import functools
import time
from typing import Any, Callable
from core.logger import get_logger

logger = get_logger(__name__, category="PERFORMANCE")


def log_performance(func: Callable) -> Callable:
    """性能日志装饰器"""
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs) -> Any:
        start_time = time.time()
        func_name = func.__name__
        
        try:
            result = await func(*args, **kwargs)
            elapsed = time.time() - start_time
            logger.info(
                f"✓ {func_name} 执行完成",
                extra={
                    "category": "PERFORMANCE",
                    "function": func_name,
                    "elapsed_time": f"{elapsed:.3f}s",
                }
            )
            return result
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"✗ {func_name} 执行失败: {str(e)}",
                extra={
                    "category": "PERFORMANCE",
                    "function": func_name,
                    "error": str(e),
                    "elapsed_time": f"{elapsed:.3f}s",
                },
                exc_info=True
            )
            raise

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs) -> Any:
        start_time = time.time()
        func_name = func.__name__
        
        try:
            result = func(*args, **kwargs)
            elapsed = time.time() - start_time
            logger.info(
                f"✓ {func_name} 执行完成",
                extra={
                    "category": "PERFORMANCE",
                    "function": func_name,
                    "elapsed_time": f"{elapsed:.3f}s",
                }
            )
            return result
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"✗ {func_name} 执行失败: {str(e)}",
                extra={
                    "category": "PERFORMANCE",
                    "function": func_name,
                    "error": str(e),
                    "elapsed_time": f"{elapsed:.3f}s",
                },
                exc_info=True
            )
            raise

    # 判断是否为异步函数
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


def log_operation(operation: str, category: str = "BUSINESS"):
    """操作日志装饰器
    
    Args:
        operation: 操作描述
        category: 日志分类 (BUSINESS, DATABASE, MODEL 等)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            logger.info(f"开始: {operation}", extra={"category": category, "operation": operation})
            try:
                result = await func(*args, **kwargs)
                logger.info(f"完成: {operation}", extra={"category": category, "operation": operation})
                return result
            except Exception as e:
                logger.error(
                    f"失败: {operation} - {str(e)}",
                    extra={"category": category, "operation": operation, "error": str(e)},
                    exc_info=True
                )
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            logger.info(f"开始: {operation}", extra={"category": category, "operation": operation})
            try:
                result = func(*args, **kwargs)
                logger.info(f"完成: {operation}", extra={"category": category, "operation": operation})
                return result
            except Exception as e:
                logger.error(
                    f"失败: {operation} - {str(e)}",
                    extra={"category": category, "operation": operation, "error": str(e)},
                    exc_info=True
                )
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator
