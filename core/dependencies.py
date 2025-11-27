"""FastAPI 依赖注入"""
import sqlite3
from typing import Generator
from functools import lru_cache

from langgraph.checkpoint.sqlite import SqliteSaver

from .storage import AppStorage
from .store import SqliteStore
from .agent_manager import AgentManager


# ==================== 单例获取器 ====================

@lru_cache()
def get_app_storage() -> AppStorage:
    """获取 AppStorage 单例"""
    return AppStorage(db_path="data/app.db")


@lru_cache()
def get_store() -> SqliteStore:
    """获取 SqliteStore 单例"""
    return SqliteStore(db_path="data/store.db")


@lru_cache()
def get_checkpointer() -> SqliteSaver:
    """获取 SqliteSaver 单例"""
    conn = sqlite3.connect("data/checkpoints.db", check_same_thread=False)
    return SqliteSaver(conn)


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
