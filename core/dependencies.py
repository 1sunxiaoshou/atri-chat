"""FastAPI 依赖注入"""
from typing import Generator, Optional
from functools import lru_cache
import aiosqlite

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from .store import SqliteStore
from .storage import AppStorage
from .store import SqliteStore
from .agent_manager import AgentManager


# ==================== 全局变量 ====================
_checkpointer_instance: Optional[AsyncSqliteSaver] = None
_aiosqlite_conn = None


# ==================== 单例获取器 ====================

@lru_cache()
def get_app_storage() -> AppStorage:
    """获取 AppStorage 单例"""
    return AppStorage(db_path="data/app.db")

@lru_cache()
def get_store() -> SqliteStore:
    """获取 SqliteStore 单例"""
    return SqliteStore(db_path="data/store.db")

def get_checkpointer() -> AsyncSqliteSaver:
    """获取 AsyncSqliteSaver 单例"""
    global _checkpointer_instance
    if _checkpointer_instance is None:
        raise RuntimeError("Checkpointer not initialized. Call init_checkpointer() first.")
    return _checkpointer_instance


async def init_checkpointer() -> AsyncSqliteSaver:
    """初始化 AsyncSqliteSaver（在应用启动时调用）"""
    global _checkpointer_instance, _aiosqlite_conn
    
    # 创建 aiosqlite 连接
    _aiosqlite_conn = await aiosqlite.connect("data/checkpoints.db")
    
    # 使用连接创建 AsyncSqliteSaver
    _checkpointer_instance = AsyncSqliteSaver(_aiosqlite_conn)
    
    # 初始化数据库表
    await _checkpointer_instance.setup()
    
    return _checkpointer_instance


async def close_checkpointer():
    """关闭 AsyncSqliteSaver 和数据库连接"""
    global _checkpointer_instance, _aiosqlite_conn
    
    if _aiosqlite_conn:
        await _aiosqlite_conn.close()
        _aiosqlite_conn = None
    
    _checkpointer_instance = None


@lru_cache()
def get_agent_manager() -> AgentManager:
    """获取 AgentManager 单例"""
    return AgentManager(
        app_storage=get_app_storage(),
        store=get_store(),
        checkpointer=get_checkpointer()
    )


# ==================== FastAPI 依赖项 ====================

def get_storage() -> Generator[AppStorage, None, None]:
    """FastAPI 依赖：获取 AppStorage"""
    yield get_app_storage()


def get_agent() -> Generator[AgentManager, None, None]:
    """FastAPI 依赖：获取 AgentManager"""
    yield get_agent_manager()
