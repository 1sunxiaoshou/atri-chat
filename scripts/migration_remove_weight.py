"""数据库迁移脚本：移除 character_motion_bindings 表的 weight 列"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from core.dependencies import get_db
from core.logger import get_logger

logger = get_logger(__name__)


def migrate():
    """执行迁移：移除 weight 列"""
    db = next(get_db())
    
    try:
        logger.info("开始迁移：移除 character_motion_bindings.weight 列")
        
        # 检查列是否存在
        check_sql = text("""
            SELECT COUNT(*) as count
            FROM pragma_table_info('character_motion_bindings')
            WHERE name = 'weight'
        """)
        result = db.execute(check_sql).fetchone()
        
        if result[0] == 0:
            logger.info("weight 列不存在，无需迁移")
            return
        
        logger.info("检测到 weight 列，开始移除...")
        
        # SQLite 不支持直接 DROP COLUMN，需要重建表
        # 1. 创建新表（不包含 weight 列）
        create_new_table_sql = text("""
            CREATE TABLE character_motion_bindings_new (
                id VARCHAR(36) PRIMARY KEY,
                character_id VARCHAR(36) NOT NULL,
                motion_id VARCHAR(36) NOT NULL,
                category VARCHAR(50) NOT NULL,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                FOREIGN KEY (motion_id) REFERENCES assets_motions(id) ON DELETE RESTRICT,
                UNIQUE (character_id, motion_id, category)
            )
        """)
        db.execute(create_new_table_sql)
        logger.info("✓ 创建新表成功")
        
        # 2. 复制数据（不包含 weight 列）
        copy_data_sql = text("""
            INSERT INTO character_motion_bindings_new 
                (id, character_id, motion_id, category, created_at)
            SELECT id, character_id, motion_id, category, created_at
            FROM character_motion_bindings
        """)
        db.execute(copy_data_sql)
        logger.info("✓ 数据复制成功")
        
        # 3. 删除旧表
        drop_old_table_sql = text("DROP TABLE character_motion_bindings")
        db.execute(drop_old_table_sql)
        logger.info("✓ 删除旧表成功")
        
        # 4. 重命名新表
        rename_table_sql = text("""
            ALTER TABLE character_motion_bindings_new 
            RENAME TO character_motion_bindings
        """)
        db.execute(rename_table_sql)
        logger.info("✓ 重命名表成功")
        
        # 5. 重建索引
        create_indexes_sql = [
            text("CREATE INDEX idx_bindings_character_id ON character_motion_bindings(character_id)"),
            text("CREATE INDEX idx_bindings_motion_id ON character_motion_bindings(motion_id)"),
            text("CREATE INDEX idx_bindings_category ON character_motion_bindings(category)"),
            text("CREATE INDEX idx_bindings_character_category ON character_motion_bindings(character_id, category)")
        ]
        
        for sql in create_indexes_sql:
            db.execute(sql)
        logger.info("✓ 重建索引成功")
        
        # 提交事务
        db.commit()
        logger.success("✓ 迁移完成！weight 列已成功移除")
        
    except Exception as e:
        db.rollback()
        logger.error(f"✗ 迁移失败: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
