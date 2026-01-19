"""HTTP请求日志中间件"""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from core.logger import get_logger
from core.config import get_config

logger = get_logger(__name__, category="API")
config = get_config()

# 忽略的路径（静态资源、健康检查等）
IGNORED_PATHS = {
    "/favicon.ico",
    "/health",
    "/static",
    "/uploads"
}


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录HTTP请求和响应的中间件"""

    def should_log_request(self, request: Request) -> bool:
        """判断是否需要记录请求"""
        path = request.url.path
        
        # 忽略静态资源
        if any(path.startswith(ignored) for ignored in IGNORED_PATHS):
            return False
            
        return True

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        should_log = self.should_log_request(request)
        
        try:
            response = await call_next(request)
            duration = int((time.time() - start_time) * 1000)  # 转换为毫秒
            
            # 记录请求日志
            if should_log:
                # 根据状态码和环境决定日志级别
                if response.status_code >= 500:
                    log_level = "error"
                elif response.status_code >= 400:
                    log_level = "warning"
                elif config.is_development:
                    # 开发环境：只记录 POST/PUT/DELETE 等写操作
                    log_level = "info" if request.method != "GET" else "debug"
                else:
                    # 生产环境：只记录错误
                    log_level = None
                
                if log_level:
                    getattr(logger, log_level)(
                        f"{request.method} {request.url.path} - {response.status_code}",
                        extra={
                            "category": "API",
                            "method": request.method,
                            "path": request.url.path,
                            "status_code": response.status_code,
                            "duration": duration,
                        }
                    )
            
            # 为响应添加处理时间头
            response.headers["X-Process-Time"] = f"{duration}ms"
            return response
            
        except Exception as exc:
            duration = int((time.time() - start_time) * 1000)
            logger.error(
                f"{request.method} {request.url.path} - Exception: {str(exc)}",
                extra={
                    "category": "API",
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration": duration,
                },
                exc_info=True
            )
            raise
