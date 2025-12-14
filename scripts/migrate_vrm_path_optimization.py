"""优化VRM模型表结构 - 只存储文件名而非完整路径

迁移说明：
- 将 model_path 改为 filename（只存储文件名）
- 将 thumbnail_path 改为 thumbnail_filename（只存储文件名，可为NULL）
- 路径拼接逻辑移到代码层
"""
import sqlite3
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.paths import get_app_db_path
from core.logger import get_logger

logger = get_logger(__name__, category="MIGRATION")


def extract_filename_from_path(path: str) -> str:
    """从路径中提取文件名
    
    Args:
        path: 完整路径，如 /uploads/vrm_models/xxx.vrm
        
    Returns:
        文件名，如 xxx.vrm
    """
    if not path:
        return ""
    return Path(path).name


def migrate():
    """执行迁移"""
    db_path = get_app_db_path()
    logger.info(f"开始迁移数据库: {db_path}")
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 1. 检查是否已经迁移过
            cursor.execute("PRAGMA table_info(vrm_models)")
            columns = [col[1] for col in cursor.fetchall()]
            
            if 'filename' in columns:
                logger.info("数据库已经迁移过，跳过")
                return
            
            logger.info("开始迁移 vrm_models 表...")
            
            # 2. 创建新表
            cursor.execute("""
                CREATE TABLE vrm_models_new (
                    vrm_model_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    thumbnail_filename TEXT
                )
            """)
            logger.info("✓ 创建新表成功")
            
            # 3. 迁移数据
            cursor.execute("SELECT vrm_model_id, name, model_path, thumbnail_path FROM vrm_models")
            rows = cursor.fetchall()
            
            migrated_count = 0
            for row in rows:
                vrm_model_id, name, model_path, thumbnail_path = row
                
                # 提取文件名
                filename = extract_filename_from_path(model_path)
                thumbnail_filename = extract_filename_from_path(thumbnail_path) if thumbnail_path and not thumbnail_path.startswith('/static/') else None
                
                cursor.execute(
                    "INSERT INTO vrm_models_new (vrm_model_id, name, filename, thumbnail_filename) VALUES (?, ?, ?, ?)",
                    (vrm_model_id, name, filename, thumbnail_filename)
                )
                migrated_count += 1
                logger.debug(f"迁移记录: {vrm_model_id} | {filename}")
            
            logger.info(f"✓ 迁移 {migrated_count} 条记录")
            
            # 4. 删除旧表
            cursor.execute("DROP TABLE vrm_models")
            logger.info("✓ 删除旧表")
            
            # 5. 重命名新表
            cursor.execute("ALTER TABLE vrm_models_new RENAME TO vrm_models")
            logger.info("✓ 重命名新表")
            
            conn.commit()
            logger.info("✓ 迁移完成！")
            
    except Exception as e:
        logger.error(f"迁移失败: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    print("=" * 60)
    print("VRM模型表结构优化迁移")
    print("=" * 60)
    print()
    
    try:
        migrate()
        print("\n✓ 迁移成功完成！")
    except Exception as e:
        print(f"\n✗ 迁移失败: {e}")
        sys.exit(1)
