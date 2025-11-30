"""FastAPI 主应用入口"""
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.logger import get_logger
from core.middleware.logging_middleware import LoggingMiddleware
from core.dependencies import get_app_storage, init_checkpointer, close_checkpointer
from api.routes import (
    characters, conversations, messages, models, providers, tts, health, upload, asr
)

# 加载 .env 文件
load_dotenv()

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    logger.info("初始化系统...")
    
    # 预热单例实例（触发初始化）
    get_app_storage()
    
    # 初始化 AsyncSqliteSaver
    await init_checkpointer()
    
    logger.info("✓ 系统初始化完成")   

    yield
    
    # 关闭
    logger.info("关闭系统...")
    await close_checkpointer()
    logger.info("✓ 系统已关闭")


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

# 挂载静态文件目录
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# 挂载上传文件目录
uploads_dir = Path(__file__).parent / "data" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# 注册路由（必须在前端静态文件挂载之前）
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(characters.router, prefix="/api/v1", tags=["characters"])
app.include_router(conversations.router, prefix="/api/v1", tags=["conversations"])
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(providers.router, prefix="/api/v1", tags=["providers"])
app.include_router(tts.router, prefix="/api/v1/tts", tags=["tts"])
app.include_router(asr.router, prefix="/api/v1/asr", tags=["asr"])
app.include_router(upload.router, prefix="/api", tags=["upload"])

# 挂载前端静态文件（必须在最后，避免覆盖 API 路由）
# frontend_dist = Path(__file__).parent / "frontend" / "dist"
# if frontend_dist.exists():
#     app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
#     logger.info(f"✓ 前端静态文件已挂载: {frontend_dist}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
