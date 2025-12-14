"""VRM数据库迁移脚本：从一对多迁移到多对多关系

使用方法：
    python scripts/migrate_vrm_to_many_to_many.py
"""
import sqlite3
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.paths import get_app_db_path
from core.logger import get_logger

logger = get_logger(__name__, category="MIGRATION")


def backup_database(db_path: str) -> str:
    """备份数据库"""
    import shutil
    from datetime import datetime
    
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(db_path, backup_path)
    logger.info(f"数据库已备份到: {backup_path}")
    return backup_path


def migrate_vrm_tables():
    """迁移VRM表结构"""
    db_path = get_app_db_path()
    
    logger.info(f"开始迁移VRM表结构: {db_path}")
    
    # 1. 备份数据库
    backup_path = backup_database(db_path)
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 2. 检查旧表是否存在
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='vrm_animations'
            """)
            
            if not cursor.fetchone():
                logger.info("未找到旧的vrm_animations表，跳过迁移")
                return
            
            # 3. 检查旧表结构（是否有vrm_model_id列）
            cursor.execute("PRAGMA table_info(vrm_animations)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'vrm_model_id' not in columns:
                logger.info("vrm_animations表已经是新结构，跳过迁移")
                return
            
            logger.info("检测到旧表结构，开始迁移...")
            
            # 4. 读取旧数据
            cursor.execute("""
                SELECT animation_id, vrm_model_id, name, name_cn, 
                       animation_path, duration, type 
                FROM vrm_animations
            """)
            old_animations = cursor.fetchall()
            
            logger.info(f"读取到 {len(old_animations)} 条旧动作数据")
            
            # 5. 创建临时表（新结构）
            cursor.execute("""
                CREATE TABLE vrm_animations_new (
                    animation_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    name_cn TEXT NOT NULL,
                    description TEXT,
                    duration REAL
                )
            """)
            
            # 6. 提取唯一动作（去重）
            unique_animations = {}
            model_animation_relations = []
            
            for anim in old_animations:
                animation_id, vrm_model_id, name, name_cn, animation_path, duration, anim_type = anim
                
                # 使用name作为唯一标识
                if name not in unique_animations:
                    unique_animations[name] = {
                        'animation_id': animation_id,
                        'name': name,
                        'name_cn': name_cn,
                        'description': f"从旧数据迁移（类型: {anim_type}）",
                        'duration': duration
                    }
                
                # 记录关联关系
                model_animation_relations.append((vrm_model_id, animation_id))
            
            logger.info(f"提取到 {len(unique_animations)} 个唯一动作")
            
            # 7. 插入唯一动作到新表
            for anim_data in unique_animations.values():
                cursor.execute("""
                    INSERT INTO vrm_animations_new 
                    (animation_id, name, name_cn, description, duration)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    anim_data['animation_id'],
                    anim_data['name'],
                    anim_data['name_cn'],
                    anim_data['description'],
                    anim_data['duration']
                ))
            
            logger.info(f"插入 {len(unique_animations)} 个动作到新表")
            
            # 8. 创建关联表
            cursor.execute("""
                CREATE TABLE vrm_model_animations (
                    vrm_model_id TEXT NOT NULL,
                    animation_id TEXT NOT NULL,
                    PRIMARY KEY (vrm_model_id, animation_id),
                    FOREIGN KEY (vrm_model_id) REFERENCES vrm_models(vrm_model_id) ON DELETE CASCADE,
                    FOREIGN KEY (animation_id) REFERENCES vrm_animations_new(animation_id) ON DELETE CASCADE
                )
            """)
            
            # 9. 插入关联关系
            for vrm_model_id, animation_id in model_animation_relations:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO vrm_model_animations 
                        (vrm_model_id, animation_id)
                        VALUES (?, ?)
                    """, (vrm_model_id, animation_id))
                except Exception as e:
                    logger.warning(f"插入关联关系失败: {e}")
            
            logger.info(f"插入 {len(model_animation_relations)} 条关联关系")
            
            # 10. 删除旧表，重命名新表
            cursor.execute("DROP TABLE vrm_animations")
            cursor.execute("ALTER TABLE vrm_animations_new RENAME TO vrm_animations")
            
            # 11. 创建索引
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_model_animations_model 
                ON vrm_model_animations(vrm_model_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_model_animations_animation 
                ON vrm_model_animations(animation_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_animations_name 
                ON vrm_animations(name)
            """)
            
            # 12. 更新vrm_models表（移除不需要的字段）
            cursor.execute("PRAGMA table_info(vrm_models)")
            model_columns = [row[1] for row in cursor.fetchall()]
            
            if 'description' in model_columns or 'created_at' in model_columns:
                logger.info("更新vrm_models表结构...")
                
                # 读取旧数据
                cursor.execute("""
                    SELECT vrm_model_id, name, model_path, thumbnail_path
                    FROM vrm_models
                """)
                old_models = cursor.fetchall()
                
                # 创建新表
                cursor.execute("""
                    CREATE TABLE vrm_models_new (
                        vrm_model_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        model_path TEXT NOT NULL,
                        thumbnail_path TEXT DEFAULT '/static/default_vrm_thumbnail.png'
                    )
                """)
                
                # 插入数据
                for model in old_models:
                    cursor.execute("""
                        INSERT INTO vrm_models_new 
                        (vrm_model_id, name, model_path, thumbnail_path)
                        VALUES (?, ?, ?, ?)
                    """, model)
                
                # 删除旧表，重命名新表
                cursor.execute("DROP TABLE vrm_models")
                cursor.execute("ALTER TABLE vrm_models_new RENAME TO vrm_models")
                
                logger.info("vrm_models表结构更新完成")
            
            conn.commit()
            
            logger.info("✓ VRM表结构迁移完成")
            logger.info(f"备份文件: {backup_path}")
            
    except Exception as e:
        logger.error(f"迁移失败: {e}", exc_info=True)
        logger.info(f"可以从备份恢复: {backup_path}")
        raise


if __name__ == "__main__":
    try:
        migrate_vrm_tables()
        print("\n✓ 迁移成功完成！")
    except Exception as e:
        print(f"\n✗ 迁移失败: {e}")
        sys.exit(1)
