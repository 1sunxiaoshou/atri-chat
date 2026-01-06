"""HTTP请求日志中间件"""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from core.logger import get_logger

logger = get_logger(__name__, category="API")

# 需要详细记录的路径（重要的业务操作）
IMPORTANT_PATHS = {
    "/api/v1/messages",  # 消息发送
}

# 只记录一次的路径（避免重复日志）
LOG_ONCE_PATHS = {
    "/api/v1/conversations",
    "/api/v1/characters",
    "/api/v1/models"
}

# 忽略的路径（静态资源、健康检查等）
IGNORED_PATHS = {
    "/favicon.ico",
    "/health",
    "/static",
    "/uploads"
}

# 用于跟踪已记录的请求（简单的去重）
_logged_requests: set = set()


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录HTTP请求和响应的中间件"""

    def should_log_request(self, request: Request) -> tuple[bool, bool]:
        """判断是否需要记录请求
        
        Returns:
            (should_log, log_response): 是否记录请求，是否记录响应
        """
        path = request.url.path
        method = request.method
        
        # 忽略静态资源
        if any(path.startswith(ignored) for ignored in IGNORED_PATHS):
            return False, False
            
        # 重要路径总是记录
        if any(path.startswith(important) for important in IMPORTANT_PATHS):
            return True, True
            
        # 对于 GET 请求，只记录一次（去重）
        if method == "GET":
            request_key = f"{method}:{path}"
            if request_key in _logged_requests:
                return False, False
            _logged_requests.add(request_key)
            # 限制缓存大小
            if len(_logged_requests) > 100:
                _logged_requests.clear()
            return True, True
            
        # 其他方法（POST、PUT、DELETE）都记录
        return True, True

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        should_log, log_response = self.should_log_request(request)
        
        # 只记录重要请求的开始
        if should_log:
            logger.info(
                f"→ {request.method} {request.url.path}",
                extra={
                    "category": "API",
                    "method": request.method,
                    "path": request.url.path,
                    "client": request.client.host if request.client else "unknown",
                }
            )
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # 记录响应信息（错误总是记录，成功的只记录重要请求）
            if response.status_code >= 400 or log_response:
                log_level = "info" if response.status_code < 400 else "warning" if response.status_code < 500 else "error"
                getattr(logger, log_level)(
                    f"← {request.method} {request.url.path} {response.status_code}",
                    extra={
                        "category": "API",
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": response.status_code,
                        "process_time": f"{process_time:.3f}s",
                    }
                )
            
            # 为响应添加处理时间头
            response.headers["X-Process-Time"] = str(process_time)
            return response
            
        except Exception as exc:
            process_time = time.time() - start_time
            error_msg = str(exc).replace("{", "{{").replace("}", "}}")  # 转义花括号
            logger.error(
                f"✗ {request.method} {request.url.path} - {error_msg}",
                extra={
                    "category": "API",
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(exc),
                    "process_time": f"{process_time:.3f}s",
                },
                exc_info=True
            )
            raise
