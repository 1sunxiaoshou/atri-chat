"""FastAPI 主应用入口"""
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# 必须在导入其他模块之前加载环境变量
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.logger import get_logger, get_log_level, get_environment
from core.middleware.logging_middleware import LoggingMiddleware
from core.dependencies import get_app_storage, init_checkpointer, close_checkpointer
from core.paths import get_path_manager
from api.routes import (
    characters, conversations, messages, models, providers, tts, health, upload, asr,
    vrm_models, vrm_animations, vrm_model_animations
)

logger = get_logger(__name__)


def print_startup_banner():
    """打印启动信息"""
    env = get_environment()
    env_display = {
        "development": "🔧 开发环境",
        "production": "🚀 生产环境",
        "staging": "🧪 测试环境"
    }.get(env, env)
    
    banner = f"""
╭─────────────────────────────────────────────╮
│  VRM Chat Assistant                         │
│  Version: 1.0.0                             │
├─────────────────────────────────────────────┤
│  Environment: {env_display: <28} │
│  Log Level:   {get_log_level(): <28} │
├─────────────────────────────────────────────┤
│  API Server:  http://localhost:8000         │
│  API Docs:    http://localhost:8000/docs    │
╰─────────────────────────────────────────────╯
"""
    print(banner)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    print_startup_banner()
    
    # 预热单例实例（触发初始化）
    get_app_storage()
    
    # 初始化 AsyncSqliteSaver
    await init_checkpointer()
    
    logger.success("✓ 系统初始化完成")   

    yield
    
    # 关闭
    logger.info("正在关闭系统...")
    
    # 关闭 checkpointer
    await close_checkpointer()
    
    logger.success("✓ 系统已关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="AI Agent API",
    description="多角色AI Agent系统API",
    version="1.0.0",
    lifespan=lifespan
)

# 日志中间件（需要在CORS之前添加）
app.add_middleware(LoggingMiddleware)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Sample-Rate", "X-Channels", "X-Bit-Depth"],  # 暴露自定义响应头
    max_age=3600,  # 预检请求缓存1小时，减少OPTIONS请求
)

# 获取路径管理器
path_manager = get_path_manager()

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory=str(path_manager.static_dir)), name="static")

# 挂载上传文件目录
app.mount("/uploads", StaticFiles(directory=str(path_manager.uploads_dir)), name="uploads")

# 注册路由（必须在前端静态文件挂载之前）
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(characters.router, prefix="/api/v1", tags=["characters"])
app.include_router(conversations.router, prefix="/api/v1", tags=["conversations"])
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(providers.router, prefix="/api/v1", tags=["providers"])
app.include_router(tts.router, prefix="/api/v1/tts", tags=["tts"])
app.include_router(asr.router, prefix="/api/v1/asr", tags=["asr"])
app.include_router(vrm_models.router, prefix="/api/v1", tags=["vrm"])
app.include_router(vrm_animations.router, prefix="/api/v1", tags=["vrm"])
app.include_router(vrm_model_animations.router, prefix="/api/v1", tags=["vrm"])
app.include_router(upload.router, prefix="/api", tags=["upload"])

# 挂载前端静态文件（必须在最后，避免覆盖 API 路由）
# if path_manager.frontend_dist.exists():
#     app.mount("/", StaticFiles(directory=str(path_manager.frontend_dist), html=True), name="frontend")
#     logger.info(f"✓ 前端静态文件已挂载: {path_manager.frontend_dist}")


if __name__ == "__main__":
    import uvicorn
    import sys
    from core.config import get_config
    
    config = get_config()
    
    # 根据环境配置 uvicorn 日志级别
    uvicorn_log_level = "warning" if config.is_production else "warning"  # 统一使用 warning，减少噪音
    
    try:
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=8000,
            log_level=uvicorn_log_level,
            access_log=False  # 禁用 uvicorn 的访问日志，使用我们自己的中间件
        )
    except KeyboardInterrupt:
        logger.info("收到停止信号，正在关闭...")
        sys.exit(0)
