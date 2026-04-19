"""HTTP请求日志中间件 - 生产级实践"""
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logger import get_logger

logger = get_logger(__name__)

# 慢查询阈值（毫秒）
SLOW_THRESHOLD_MS = 1000

# 忽略的路径（静态资源、健康检查等）
IGNORED_PATHS = {"/favicon.ico", "/health", "/api/v1/health", "/static"}


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录HTTP请求和响应的中间件
    
    日志策略：
    1. access.log - 每个请求恰好一条 access 记录
    2. error.log - 未处理异常只记录一条完整错误
    3. app.log - 慢请求与关键告警
    """

    def should_log_request(self, request: Request) -> bool:
        """判断是否需要记录请求"""
        path = request.url.path
        # 忽略静态资源
        return not any(path.startswith(ignored) for ignored in IGNORED_PATHS)

    def get_client_ip(self, request: Request) -> str:
        """获取客户端真实IP"""
        return (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or request.headers.get("X-Real-IP")
            or (request.client.host if request.client else "unknown")
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        # 忽略不需要记录的请求
        if not self.should_log_request(request):
            return await call_next(request)
        
        # 生成请求 ID（用于追踪）
        request_id = str(uuid.uuid4())[:8]
        # 优化 1：使用 perf_counter 提供更精准的基于单调时钟的计时，排除系统修正时间戳带来的影响
        start_time = time.perf_counter()
        
        # 提取请求信息
        method = request.method
        path = request.url.path
        ip = self.get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "-")
        request.state.request_id = request_id
        
        with logger.contextualize(request_id=request_id):
            try:
                response = await call_next(request)
                duration = int((time.perf_counter() - start_time) * 1000)  # 毫秒
                status_code = response.status_code
                request.state.process_time_ms = duration

                logger.bind(
                    channel="access",
                    event="http.access",
                    request_id=request_id,
                    method=method,
                    path=path,
                    status_code=status_code,
                    duration_ms=duration,
                    ip=ip,
                    user_agent=user_agent,
                ).info("HTTP request completed")

                if duration >= SLOW_THRESHOLD_MS:
                    logger.bind(
                        channel="performance",
                        event="http.slow",
                        request_id=request_id,
                        method=method,
                        path=path,
                        status_code=status_code,
                        duration_ms=duration,
                        ip=ip,
                    ).warning("Slow HTTP request")

                response.headers["X-Request-ID"] = request_id
                response.headers["X-Process-Time"] = f"{duration}ms"
                return response
                
            except Exception as exc:
                duration = int((time.perf_counter() - start_time) * 1000)
                logger.bind(
                    channel="access",
                    event="http.access",
                    request_id=request_id,
                    method=method,
                    path=path,
                    status_code=500,
                    duration_ms=duration,
                    ip=ip,
                    user_agent=user_agent,
                ).info("HTTP request failed")
                logger.bind(
                    channel="error",
                    event="http.unhandled_exception",
                    request_id=request_id,
                    method=method,
                    path=path,
                    status_code=500,
                    duration_ms=duration,
                    ip=ip,
                    user_agent=user_agent,
                    error_type=type(exc).__name__,
                ).exception("Unhandled request exception")
                raise
