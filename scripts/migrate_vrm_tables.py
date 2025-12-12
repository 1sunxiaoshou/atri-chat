"""VRM表迁移脚本

为现有数据库添加VRM相关表和字段
"""
import sys
import sqlite3
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.paths import get_app_db_path
from core.logger import get_logger

logger = get_logger(__name__, category="MIGRATION")


def migrate_vrm_tables():
    """迁移VRM表"""
    db_path = get_app_db_path()
    
    print(f"数据库路径: {db_path}")
    print("=" * 60)
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 1. 检查VRM模型表是否存在
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='vrm_models'
            """)
            
            if cursor.fetchone():
                print("✓ VRM模型表已存在，跳过创建")
            else:
                print("创建VRM模型表...")
                cursor.execute("""
                    CREATE TABLE vrm_models (
                        vrm_model_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        model_path TEXT NOT NULL,
                        thumbnail_path TEXT,
                        description TEXT,
                        created_at TEXT NOT NULL
                    )
                """)
                print("✓ VRM模型表创建成功")
            
            # 2. 检查VRM动作表是否存在
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='vrm_animations'
            """)
            
            if cursor.fetchone():
                print("✓ VRM动作表已存在，跳过创建")
            else:
                print("创建VRM动作表...")
                cursor.execute("""
                    CREATE TABLE vrm_animations (
                        animation_id TEXT PRIMARY KEY,
                        vrm_model_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        name_cn TEXT NOT NULL,
                        animation_path TEXT NOT NULL,
                        duration REAL,
                        type TEXT DEFAULT 'short',
                        FOREIGN KEY (vrm_model_id) REFERENCES vrm_models(vrm_model_id)
                    )
                """)
                print("✓ VRM动作表创建成功")
            
            # 3. 检查角色表是否有vrm_model_id字段
            cursor.execute("PRAGMA table_info(characters)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'vrm_model_id' in columns:
                print("✓ 角色表已有vrm_model_id字段，跳过添加")
            else:
                print("为角色表添加vrm_model_id字段...")
                cursor.execute("""
                    ALTER TABLE characters 
                    ADD COLUMN vrm_model_id TEXT
                """)
                print("✓ vrm_model_id字段添加成功")
            
            conn.commit()
            
            print("=" * 60)
            print("✓ VRM表迁移完成！")
            
            # 显示表结构
            print("\n当前数据库表：")
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                ORDER BY name
            """)
            for row in cursor.fetchall():
                print(f"  - {row[0]}")
            
    except Exception as e:
        print(f"✗ 迁移失败: {str(e)}")
        logger.error(f"VRM表迁移失败", extra={"error": str(e)}, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    print("VRM表迁移脚本")
    print("=" * 60)
    migrate_vrm_tables()
