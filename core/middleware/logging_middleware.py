"""HTTP请求日志中间件 - 简化实用版"""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from core.logger import get_logger
from core.config import get_config

logger = get_logger(__name__)
config = get_config()

# 忽略的路径（静态资源、健康检查等）
IGNORED_PATHS = {"/favicon.ico", "/health", "/static", "/uploads"}


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录HTTP请求和响应的中间件"""

    def should_log_request(self, request: Request) -> bool:
        """判断是否需要记录请求"""
        path = request.url.path
        # 忽略静态资源
        return not any(path.startswith(ignored) for ignored in IGNORED_PATHS)

    async def dispatch(self, request: Request, call_next) -> Response:
        # 忽略不需要记录的请求
        if not self.should_log_request(request):
            return await call_next(request)
        
        # 生成简短的请求 ID（8位足够）
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration = int((time.time() - start_time) * 1000)  # 转换为毫秒
            
            # 根据状态码和环境决定日志级别
            if response.status_code >= 500:
                log_level = "error"
            elif response.status_code >= 400:
                log_level = "warning"
            elif config.is_development and request.method == "GET":
                # 开发环境：GET 请求用 DEBUG（减少噪音）
                log_level = "debug"
            else:
                log_level = "info"
            
            # 记录日志
            getattr(logger, log_level)(
                f"[{request_id}] {request.method} {request.url.path} - {response.status_code} ({duration}ms)",
                extra={
                    "is_api": True,
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration": duration,
                }
            )
            
            # 添加响应头（方便前端追踪和性能分析）
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{duration}ms"
            return response
            
        except Exception as exc:
            duration = int((time.time() - start_time) * 1000)
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} - Exception ({duration}ms): {str(exc)}",
                extra={
                    "is_api": True,
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration": duration,
                },
                exc_info=True
            )
            raise
