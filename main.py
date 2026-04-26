import os
import sys
import time
import threading
import importlib
from contextlib import asynccontextmanager

from dotenv import load_dotenv
import psutil

# 1. 唯一一次执行的副作用：加载 .env。
# 这是后续所有配置的基础，但不能覆盖 Tauri 在启动时注入的运行时端口。
load_dotenv(override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.logger import ensure_file_logging, get_logger, setup_logging
from core.config import get_settings
from core.startup_metrics import startup_metrics

# 1.1 提前确保目录存在 (StaticFiles 挂载需要物理目录已就绪)
settings = get_settings()
settings.ensure_directories()
startup_metrics.mark("settings_ready")

CRITICAL_ROUTE_SPECS = [
    ("health", "/api/v1", ["health"]),
    ("runtime", "/api/v1", ["runtime"]),
    ("tts", "/api/v1/tts", ["tts"]),
    ("characters", "/api/v1", ["characters"]),
    ("conversations", "/api/v1", ["conversations"]),
    ("agent_stream", "/api/v1", ["messages"]),
    ("models", "/api/v1", ["models"]),
    ("providers", "/api/v1", ["providers"]),
    ("asr", "/api/v1/asr", ["asr"]),
]

DEFERRED_ROUTE_SPECS = [
    ("avatars", "/api/v1", ["assets"]),
    ("motions", "/api/v1", ["assets"]),
    ("tts_providers", "/api/v1", ["tts"]),
    ("voice_assets", "/api/v1", ["tts"]),
    ("character_motion_bindings_v2", "/api/v1", ["characters"]),
    ("asr_mgmt", "/api/v1/asr/mgmt", ["asr-mgmt"]),
    ("upload", "/api", ["upload"]),
]


def register_routes(target_app: FastAPI, route_specs: list[tuple[str, str, list[str]]], state_flag: str) -> None:
    """延迟导入并注册路由，减少 import main 的冷启动负担。"""
    if getattr(target_app.state, state_flag, False):
        return

    for module_name, prefix, tags in route_specs:
        module = importlib.import_module(f"api.routes.{module_name}")
        target_app.include_router(module.router, prefix=prefix, tags=tags)

    setattr(target_app.state, state_flag, True)
    if state_flag == "critical_routes_registered":
        startup_metrics.mark("routes_registered")
    else:
        startup_metrics.mark("background_routes_registered")

def watch_parent_process():
    """监控父进程状态，如果父进程退出则自杀"""
    parent_pid = os.getppid()
    # 在 Windows 下，如果直接运行二进制文件，ppid 可能是 1 或是 shell 进程
    # 这里我们只在 frozen (打包) 状态下开启更严格的检查
    if parent_pid <= 1:
        return

    while True:
        # 检查父进程是否存在
        if not psutil.pid_exists(parent_pid):
            # 发现父进程（Tauri）已消失，后端强制自毁
            # 使用 os._exit(0) 绕过所有正常的 Python 清理逻辑，确保瞬间退出
            os._exit(0) 
        time.sleep(2) # 每 2 秒检查一次

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期引导管理器"""
    
    # 2. 引导阶段 A：实例化单一事实源
    # 如果是打包环境，启动父进程监控线程
    if getattr(sys, 'frozen', False):
        monitor_thread = threading.Thread(target=watch_parent_process, daemon=True)
        monitor_thread.start()
    # 注意：这里继续使用 settings，因为 get_settings 是 lru_cache
    
    # 3. 引导阶段 B：显式初始化日志 (此时 settings 已妥，目录已建)
    setup_logging(
        log_level=settings.log_level,
        log_dir=settings.logs_dir,
        is_development=(settings.app_env == "development"),
        defer_file_logging=True,
    )
    startup_metrics.mark("logging_ready")
    
    # 获取 logger 实例
    logger = get_logger(__name__)
    logger.info("系统正在启动...")
    
    # 5/6/7. 引导阶段：并行初始化组件 (提高启动效率)
    import asyncio

    async def task_routes():
        await asyncio.to_thread(register_routes, app, CRITICAL_ROUTE_SPECS, "critical_routes_registered")
    
    async def task_db():
        from core.db import init_db
        init_db()
        
    async def task_checkpointer():
        from core.dependencies import init_checkpointer
        await init_checkpointer()

    # 启动并行初始化
    await asyncio.gather(
        task_routes(),
        task_db(),
        task_checkpointer(),
    )
    startup_metrics.mark("lifespan_dependencies_ready")

    logger.success(f"[OK] ATRI Backend Service is ready on port {settings.backend_port}")
    logger.info(
        f"Environment: {settings.app_env} | Runtime Mode: {settings.runtime_mode} | "
        f"Data Root: {settings.data_dir} | PID: {os.getpid()} | Parent PID: {os.getppid()}"
    )
    logger.info(f"启动阶段耗时快照: {startup_metrics.snapshot()}")
    from core.runtime_status import get_capability_registry
    warmup_capabilities = get_capability_registry().schedule_startup_warmups()
    if warmup_capabilities:
        logger.info(f"已调度后台能力预热: {', '.join(warmup_capabilities)}")
    asyncio.create_task(asyncio.to_thread(ensure_file_logging))
    asyncio.create_task(
        asyncio.to_thread(register_routes, app, DEFERRED_ROUTE_SPECS, "background_routes_registered")
    )

    yield
    
    # 关闭阶段
    from core.runtime_status import get_capability_registry
    from core.dependencies import close_checkpointer
    await get_capability_registry().cancel_background_tasks()
    await close_checkpointer()
    logger.info("系统已安全关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="AI Agent API",
    description="重构后的多角色 AI Agent 系统 API",
    version="1.1.0",
    lifespan=lifespan
)
startup_metrics.mark("fastapi_app_created")

# 中间件配置
from core.middleware.logging_middleware import LoggingMiddleware
settings = get_settings()
if settings.enable_http_logging:
    app.add_middleware(LoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Sample-Rate",
        "X-Channels",
        "X-Bit-Depth",
        "X-Request-ID",
        "X-Process-Time",
    ],
    max_age=3600,
)

# 挂载静态资源 (地基已在 lifespan 中通过 settings.ensure_directories() 夯实)
# 通过 /static 访问所有图片、模型、动作等
app.mount("/static", StaticFiles(directory=str(settings.assets_dir)), name="static")

if __name__ == "__main__":
    import uvicorn
    # 获取配置用于启动参数
    settings = get_settings()
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=settings.backend_port,
        log_level="warning", # uvicorn 自身的日志降噪
        use_colors=False,    # 生产打包兼容性
        access_log=False
    )
