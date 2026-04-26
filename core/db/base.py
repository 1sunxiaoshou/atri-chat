"""数据库基础配置和会话管理"""

from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from core.logger import get_logger

logger = get_logger(__name__)

# 创建声明式基类
Base = declarative_base()

# 全局引擎和会话工厂
_engine = None
_SessionLocal = None


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """启用 SQLite 高性能配置"""
    cursor = dbapi_conn.cursor()
    # 启用外键
    cursor.execute("PRAGMA foreign_keys=ON")
    # 启用 WAL 模式 (极大提升并发读写性能)
    cursor.execute("PRAGMA journal_mode=WAL")
    # 设置同步级别为 NORMAL (兼顾性能与安全)
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


def get_database_url() -> str:
    """从统一配置中获取数据库连接串"""
    from core.config import get_settings

    return get_settings().app_db_url


def get_engine_config(database_url: str) -> dict:
    """根据数据库类型返回引擎配置"""
    config = {
        "echo": False,  # 设置为 True 可以看到 SQL 语句
    }

    if database_url.startswith("sqlite"):
        config["connect_args"] = {"check_same_thread": False}
    elif database_url.startswith("postgresql"):
        config["pool_size"] = 10
        config["max_overflow"] = 20
        config["pool_pre_ping"] = True
    elif database_url.startswith("mysql"):
        config["pool_size"] = 10
        config["max_overflow"] = 20
        config["pool_pre_ping"] = True
        config["pool_recycle"] = 3600

    return config


def get_engine():
    """获取数据库引擎（单例）"""
    global _engine
    if _engine is None:
        database_url = get_database_url()
        engine_config = get_engine_config(database_url)

        logger.info(f"初始化数据库连接: {database_url}")
        _engine = create_engine(database_url, **engine_config)

    return _engine


def get_session_factory():
    """获取会话工厂（单例）"""
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine()
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionLocal


def get_session() -> Generator[Session, None, None]:
    """获取数据库会话（依赖注入用）

    使用示例:
        from fastapi import Depends
        from core.db import get_session

        @app.get("/items")
        def read_items(db: Session = Depends(get_session)):
            return db.query(Item).all()
    """
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_message_schema(engine):
    """Apply lightweight SQLite-compatible schema updates for messages."""
    inspector = inspect(engine)
    if "messages" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("messages")}
    columns_to_add = {
        "turn_id": "VARCHAR(36)",
        "lc_message_id": "VARCHAR(255)",
        "tool_call_id": "VARCHAR(255)",
        "tool_name": "VARCHAR(255)",
        "raw_json": "JSON",
    }

    with engine.begin() as conn:
        for column, ddl_type in columns_to_add.items():
            if column not in existing_columns:
                logger.info(f"正在升级 messages 表字段: {column}")
                conn.execute(
                    text(f"ALTER TABLE messages ADD COLUMN {column} {ddl_type}")
                )

        indexes = {
            index["name"]
            for index in inspector.get_indexes("messages")
            if index.get("name")
        }
        if "ix_messages_turn_id" not in indexes:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_messages_turn_id ON messages (turn_id)"
                )
            )
        if "ix_messages_lc_message_id" not in indexes:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_messages_lc_message_id "
                    "ON messages (lc_message_id)"
                )
            )
        if "ix_messages_tool_call_id" not in indexes:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_messages_tool_call_id "
                    "ON messages (tool_call_id)"
                )
            )
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "uq_messages_conversation_lc_message "
                "ON messages (conversation_id, lc_message_id)"
            )
        )


def init_db():
    """初始化数据库（创建所有表）"""
    engine = get_engine()
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # 获取需要创建的表名
    tables_to_create = [
        table.name
        for table in Base.metadata.sorted_tables
        if table.name not in existing_tables
    ]

    if tables_to_create:
        logger.info(f"正在创建数据库表: {', '.join(tables_to_create)}")
        Base.metadata.create_all(bind=engine)
        logger.success("✓ 数据库表创建完成")

    _ensure_message_schema(engine)


def drop_all_tables():
    """删除所有表（仅用于测试）"""
    engine = get_engine()
    logger.warning("正在删除所有数据库表...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("✓ 所有表已删除")
