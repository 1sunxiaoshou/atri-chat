"""日志系统测试"""
import sys
import os
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
    
from core.logger import get_logger
from core.tools.logger_utils import log_performance, log_operation
import time
import asyncio


def test_basic_logging():
    """测试基本日志功能"""
    print("=== 测试基本日志功能 ===")
    
    # 测试不同分类的日志
    api_logger = get_logger("test.api", category="API")
    business_logger = get_logger("test.business", category="BUSINESS")
    db_logger = get_logger("test.database", category="DATABASE")
    model_logger = get_logger("test.model", category="MODEL")
    
    api_logger.info("API 请求测试", extra={"method": "GET", "path": "/test"})
    business_logger.info("业务逻辑测试", extra={"operation": "test_operation"})
    db_logger.debug("数据库操作测试", extra={"table": "test_table", "action": "SELECT"})
    model_logger.info("模型调用测试", extra={"provider": "openai", "model": "gpt-4"})
    
    print("✓ 基本日志测试完成")


def test_log_levels():
    """测试不同日志级别"""
    print("\n=== 测试日志级别 ===")
    
    logger = get_logger("test.levels", category="GENERAL")
    
    logger.debug("这是 DEBUG 级别日志")
    logger.info("这是 INFO 级别日志")
    logger.warning("这是 WARNING 级别日志")
    logger.error("这是 ERROR 级别日志")
    
    print("✓ 日志级别测试完成")


def test_structured_logging():
    """测试结构化日志"""
    print("\n=== 测试结构化日志 ===")
    
    logger = get_logger("test.structured", category="BUSINESS")
    
    logger.info(
        "用户操作",
        extra={
            "user_id": 123,
            "action": "login",
            "ip": "192.168.1.1",
            "device": "mobile",
            "timestamp": time.time()
        }
    )
    
    print("✓ 结构化日志测试完成")


@log_performance
def slow_function():
    """测试性能日志装饰器（同步）"""
    time.sleep(0.1)
    return "完成"


@log_performance
async def async_slow_function():
    """测试性能日志装饰器（异步）"""
    await asyncio.sleep(0.1)
    return "完成"


def test_performance_decorator():
    """测试性能日志装饰器"""
    print("\n=== 测试性能日志装饰器 ===")
    
    # 测试同步函数
    result = slow_function()
    print(f"同步函数返回: {result}")
    
    # 测试异步函数
    result = asyncio.run(async_slow_function())
    print(f"异步函数返回: {result}")
    
    print("✓ 性能日志装饰器测试完成")


@log_operation("测试操作", category="BUSINESS")
def operation_function():
    """测试操作日志装饰器"""
    time.sleep(0.05)
    return "操作完成"


def test_operation_decorator():
    """测试操作日志装饰器"""
    print("\n=== 测试操作日志装饰器 ===")
    
    result = operation_function()
    print(f"操作返回: {result}")
    
    print("✓ 操作日志装饰器测试完成")


def test_error_logging():
    """测试错误日志"""
    print("\n=== 测试错误日志 ===")
    
    logger = get_logger("test.error", category="BUSINESS")
    
    try:
        # 故意触发异常
        result = 1 / 0
    except Exception as e:
        logger.error(
            "捕获到异常",
            extra={
                "error_type": type(e).__name__,
                "error_message": str(e)
            },
            exc_info=True
        )
    
    print("✓ 错误日志测试完成")


def main():
    """运行所有测试"""
    print("开始测试日志系统...\n")
    
    test_basic_logging()
    test_log_levels()
    test_structured_logging()
    test_performance_decorator()
    test_operation_decorator()
    test_error_logging()
    
    print("\n" + "="*50)
    print("所有测试完成！")
    print("请检查 logs/ 目录下的日志文件：")
    print("  - app.log (所有日志)")
    print("  - api.log (API 日志)")
    print("  - business.log (业务日志)")
    print("  - database.log (数据库日志)")
    print("  - model.log (模型日志)")
    print("  - performance.log (性能日志)")
    print("  - error.log (错误日志)")
    print("="*50)


if __name__ == "__main__":
    main()
