"""添加available_expressions字段到vrm_models表"""
import sqlite3
from pathlib import Path
from core.paths import get_path_manager
from core.logger import get_logger

logger = get_logger(__name__, category="Migration")


def migrate():
    """执行迁移"""
    path_manager = get_path_manager()
    db_path = path_manager.data_dir / "app.db"
    
    if not db_path.exists():
        logger.error(f"数据库文件不存在: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(vrm_models)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "available_expressions" in columns:
            logger.info("available_expressions字段已存在，跳过迁移")
            conn.close()
            return True
        
        logger.info("开始添加available_expressions字段...")
        
        # 添加新字段
        cursor.execute("""
            ALTER TABLE vrm_models 
            ADD COLUMN available_expressions TEXT
        """)
        
        conn.commit()
        logger.info("✅ 迁移成功：已添加available_expressions字段")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"迁移失败: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    success = migrate()
    exit(0 if success else 1)
