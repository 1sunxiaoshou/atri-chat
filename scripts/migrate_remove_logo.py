"""
数据库迁移脚本：移除 provider_configs 表的 logo 字段

运行方式：
    uv run python scripts/migrate_remove_logo.py
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from core.db.base import get_engine
from core.logger import get_logger

logger = get_logger(__name__)


def migrate():
    """移除 logo 字段"""
    engine = get_engine()
    
    try:
        with engine.connect() as conn:
            # 检查列是否存在
            result = conn.execute(text(
                "SELECT COUNT(*) FROM pragma_table_info('provider_configs') WHERE name='logo'"
            ))
            column_exists = result.scalar() > 0
            
            if not column_exists:
                logger.info("logo 列不存在，无需迁移")
                return
            
            logger.info("开始迁移：移除 logo 列")
            
            # SQLite 不支持直接 DROP COLUMN，需要重建表
            # 1. 创建新表（不包含 logo 列）
            conn.execute(text("""
                CREATE TABLE provider_configs_new (
                    id TEXT PRIMARY KEY,
                    provider_id TEXT UNIQUE NOT NULL,
                    config_json TEXT NOT NULL,
                    template_type TEXT DEFAULT 'openai',
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
            """))
            
            # 2. 复制数据（排除 logo 列）
            conn.execute(text("""
                INSERT INTO provider_configs_new 
                    (id, provider_id, config_json, template_type, created_at, updated_at)
                SELECT 
                    id, provider_id, config_json, template_type, created_at, updated_at
                FROM provider_configs
            """))
            
            # 3. 删除旧表
            conn.execute(text("DROP TABLE provider_configs"))
            
            # 4. 重命名新表
            conn.execute(text("ALTER TABLE provider_configs_new RENAME TO provider_configs"))
            
            # 5. 重建索引
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_provider_configs_provider_id 
                ON provider_configs(provider_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_provider_configs_created_at 
                ON provider_configs(created_at)
            """))
            
            conn.commit()
            logger.info("✅ 迁移完成：logo 列已移除")
            
    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    migrate()
