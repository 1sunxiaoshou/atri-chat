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
IGNORED_PATHS = {"/favicon.ico", "/health", "/static"}


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
        
        # 优化 2：通过 logger.contextualize 注入 request_id
        # 只要在这个上下文里（请求的整个生命周期中任何Service/Model层抛出的正常 loguru 日志），
        # 它们的 record['extra'] 里都会自动附带 request_id，天然实现跨层关联追踪。
        with logger.contextualize(request_id=request_id):
            try:
                response = await call_next(request)
                duration = int((time.perf_counter() - start_time) * 1000)  # 毫秒
                status_code = response.status_code
                
                # 1. 访问日志 (Access Log)
                log_message = f"[{request_id}] {method} {path} - {status_code} ({duration}ms)"
                # 优化 3：细化请求筛选逻辑。不改变原有设计初衷，将日常轮询接口降级。
                is_routine_get = method == "GET" and status_code == 200 and not any(path.startswith(p) for p in ["/api/v1/asr", "/api/v1/chat"])
                
                if is_routine_get:
                    logger.debug(log_message)
                else:
                    logger.info(
                        log_message,
                        extra={
                            "is_access": True,
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
                duration = int((time.perf_counter() - start_time) * 1000)
                
                # 合并访问与错误日志（或者保持两个，但在异常时能一同捕获）
                logger.error(
                    f"[{request_id}] {method} {path} - Exception ({duration}ms)",
                    extra={
                        "is_access": True,  # 强制作为 access 记录 500，也能命中 logger.py 中的 filter
                        "method": method,
                        "path": path,
                        "status_code": 500,
                        "duration": duration,
                        "ip": ip,
                        "user_agent": user_agent,
                    },
                    exc_info=True
                )
                raise
