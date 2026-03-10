"""HTTP请求日志中间件 - 生产级实践"""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from core.logger import get_logger
from core.config import get_config

logger = get_logger(__name__)
config = get_config()

# 慢查询阈值（毫秒）
SLOW_THRESHOLD_MS = 1000

# 忽略的路径（静态资源、健康检查等）
IGNORED_PATHS = {"/favicon.ico", "/health", "/uploads"}


class LoggingMiddleware(BaseHTTPMiddleware):
    """记录HTTP请求和响应的中间件
    
    日志策略：
    1. 访问日志（access.log）- 记录所有请求，用于流量分析
    2. 应用日志（app.log）- 记录警告和错误，用于问题排查
    3. 慢查询日志（slow.log）- 记录响应时间超过阈值的请求
    """

    def should_log_request(self, request: Request) -> bool:
        """判断是否需要记录请求"""
        path = request.url.path
        # 忽略静态资源
        return not any(path.startswith(ignored) for ignored in IGNORED_PATHS)

    def get_client_ip(self, request: Request) -> str:
        """获取客户端真实IP"""
        # 优先从代理头获取
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # 降级到直连IP
        if request.client:
            return request.client.host
        
        return "unknown"

    async def dispatch(self, request: Request, call_next) -> Response:
        # 忽略不需要记录的请求
        if not self.should_log_request(request):
            return await call_next(request)
        
        # 生成请求 ID（用于追踪）
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        # 提取请求信息
        method = request.method
        path = request.url.path
        ip = self.get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "-")
        
        try:
            response = await call_next(request)
            duration = int((time.time() - start_time) * 1000)  # 毫秒
            status_code = response.status_code
            
            # 1. 访问日志 - 记录所有请求（类似 Nginx access.log）
            logger.info(
                f"[{request_id}] {method} {path} - {status_code} ({duration}ms)",
                extra={
                    "is_access": True,
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration": duration,
                    "ip": ip,
                    "user_agent": user_agent,
                }
            )
            
            # 2. 应用日志 - 只记录警告和错误
            if status_code >= 500:
                logger.error(
                    f"[{request_id}] {method} {path} - {status_code} ({duration}ms) | IP: {ip}"
                )
            elif status_code >= 400:
                logger.warning(
                    f"[{request_id}] {method} {path} - {status_code} ({duration}ms) | IP: {ip}"
                )
            
            # 3. 慢查询日志 - 记录响应时间超过阈值的请求
            if duration >= SLOW_THRESHOLD_MS:
                logger.warning(
                    f"Slow request: [{request_id}] {method} {path} - {duration}ms",
                    extra={
                        "is_slow_query": True,
                        "request_id": request_id,
                        "method": method,
                        "path": path,
                        "duration": duration,
                    }
                )
            
            # 添加响应头（方便前端追踪）
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{duration}ms"
            return response
            
        except Exception as exc:
            duration = int((time.time() - start_time) * 1000)
            
            # 访问日志
            logger.info(
                f"[{request_id}] {method} {path} - 500 ({duration}ms)",
                extra={
                    "is_access": True,
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": 500,
                    "duration": duration,
                    "ip": ip,
                    "user_agent": user_agent,
                }
            )
            
            # 错误日志（包含堆栈）
            logger.error(
                f"[{request_id}] {method} {path} - Exception ({duration}ms): {str(exc)} | IP: {ip}",
                exc_info=True
            )
            raise
