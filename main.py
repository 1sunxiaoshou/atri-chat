"""FastAPI 主应用入口"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.dependencies import get_app_storage, get_checkpointer
from api.routes import (
    characters, conversations, messages, models, providers, tts, health
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    print("初始化系统...")
    
    # 预热单例实例（触发初始化）
    get_app_storage()
    checkpointer = get_checkpointer()
    
    print("✓ 系统初始化完成")
    
    yield
    
    # 关闭
    print("关闭系统...")
    if hasattr(checkpointer, 'conn') and checkpointer.conn:
        checkpointer.conn.close()
    print("✓ 系统已关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="AI Agent API",
    description="多角色AI Agent系统API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由（使用依赖注入，无需手动设置依赖）
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(characters.router, prefix="/api/v1", tags=["characters"])
app.include_router(conversations.router, prefix="/api/v1", tags=["conversations"])
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(providers.router, prefix="/api/v1", tags=["providers"])
app.include_router(tts.router, prefix="/api/v1", tags=["tts"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
