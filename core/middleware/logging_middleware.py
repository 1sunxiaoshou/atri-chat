"""HTTP请求日志中间件"""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from core.logger import get_logger

logger = get_logger(__name__, category="API")


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录HTTP请求和响应的中间件"""

    async def dispatch(self, request: Request, call_next) -> Response:
        # 记录请求信息
        start_time = time.time()
        
        logger.info(
            f"→ {request.method} {request.url.path}",
            extra={
                "category": "API",
                "method": request.method,
                "path": request.url.path,
                "query": dict(request.query_params),
                "client": request.client.host if request.client else "unknown",
            }
        )
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # 记录响应信息
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
