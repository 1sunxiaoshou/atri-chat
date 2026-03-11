"""FastAPI 依赖注入"""
from __future__ import annotations

from typing import Generator, Optional
from functools import lru_cache
import aiosqlite
from sqlalchemy.orm import Session

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from .store import SqliteStore
from .db import get_session as get_db_session
from .agent_coordinator import AgentCoordinator
from .config import get_settings


# ==================== 全局变量 ====================
_checkpointer_instance: Optional[AsyncSqliteSaver] = None
_aiosqlite_conn = None


# ==================== 单例获取器 ====================

@lru_cache()
def get_store() -> SqliteStore:
    """获取 SqliteStore 单例"""
    settings = get_settings()
    return SqliteStore(db_path=settings.store_db_path)

def get_checkpointer() -> AsyncSqliteSaver:
    """获取 AsyncSqliteSaver 单例"""
    global _checkpointer_instance
    if _checkpointer_instance is None:
        raise RuntimeError("Checkpointer not initialized. Call init_checkpointer() first.")
    return _checkpointer_instance


async def init_checkpointer() -> AsyncSqliteSaver:
    """初始化 AsyncSqliteSaver (生命周期引导时调用)"""
    global _checkpointer_instance, _aiosqlite_conn
    
    settings = get_settings()
    # 创建 aiosqlite 连接
    _aiosqlite_conn = await aiosqlite.connect(settings.checkpoints_db_path)
    
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


# ==================== 工厂单例 ====================

@lru_cache()
def get_tts_factory() -> "TTSFactory":
    """获取 TTSFactory 单例
    
    TTSFactory 维护 TTS 实例缓存，使用单例避免重复创建
    """
    from .tts.factory import TTSFactory
    return TTSFactory()


@lru_cache()
def get_model_factory() -> "ModelFactory":
    """获取 ModelFactory 单例
    
    ModelFactory 注册供应商模板，使用单例避免重复注册
    """
    from .models.factory import ModelFactory
    return ModelFactory()


@lru_cache()
def get_agent_coordinator() -> AgentCoordinator:
    """获取 AgentCoordinator 单例"""
    return AgentCoordinator(
        store=get_store(),
        checkpointer=get_checkpointer()
    )


@lru_cache()
def get_asr_engine() -> "SenseVoiceASR":
    """获取 ASR 引擎单例
    
    使用 lru_cache 确保全局只有一个 ASR 实例
    """
    from .asr import get_asr_engine as _get_asr_engine
    return _get_asr_engine()


# ==================== FastAPI 依赖项 ====================

def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：获取 SQLAlchemy Session"""
    yield from get_db_session()


def get_agent() -> Generator[AgentCoordinator, None, None]:
    """FastAPI 依赖：获取 AgentCoordinator"""
    yield get_agent_coordinator()


def get_asr() -> Generator["SenseVoiceASR", None, None]:
    """FastAPI 依赖：获取 ASR 引擎"""
    yield get_asr_engine()
