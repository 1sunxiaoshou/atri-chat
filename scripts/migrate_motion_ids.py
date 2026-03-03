"""迁移动作 ID 为短链（文件名无扩展名）

将现有的 UUID 格式的动作 ID 改为文件名（无扩展名），并重命名文件。

使用方法：
    uv run python scripts/migrate_motion_ids.py
"""
import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from core.db.base import get_session
from core.db import Motion, CharacterMotionBinding
from core.paths import get_path_manager
from core.logger import get_logger

logger = get_logger(__name__)


def generate_short_id(name: str, existing_ids: set) -> str:
    """生成短链 ID
    
    使用 5 位短 UUID，避免冲突
    """
    from core.utils.short_uuid import generate_short_uuid
    
    # 生成短 UUID
    short_id = generate_short_uuid(5)
    
    # 检查冲突
    while short_id in existing_ids:
        short_id = generate_short_uuid(5)
    
    return short_id


def migrate_motion_ids():
    """迁移动作 ID"""
    db = next(get_session())
    path_manager = get_path_manager()
    
    try:
        # SQLite 需要启用外键约束的延迟检查
        db.execute(text("PRAGMA foreign_keys = OFF"))
        
        # 获取所有动作
        motions = db.query(Motion).all()
        
        logger.info(f"找到 {len(motions)} 个动作需要迁移")
        
        # 收集已使用的 ID
        existing_ids = set()
        
        for motion in motions:
            old_id = motion.id
            old_file_path = path_manager.get_vrm_animation_path(f"{old_id}.vrma")
            
            # 生成新 ID（5位短UUID）
            new_id = generate_short_id(motion.name, existing_ids)
            existing_ids.add(new_id)
            
            new_file_path = path_manager.get_vrm_animation_path(f"{new_id}.vrma")
            
            logger.info(f"迁移: {motion.name}")
            logger.info(f"  旧 ID: {old_id}")
            logger.info(f"  新 ID: {new_id}")
            
            # 1. 重命名文件
            if os.path.exists(old_file_path):
                if old_file_path != new_file_path:
                    os.rename(old_file_path, new_file_path)
                    logger.info(f"  ✓ 文件已重命名")
                else:
                    logger.info(f"  - 文件名相同，跳过")
            else:
                logger.warning(f"  ⚠ 文件不存在: {old_file_path}")
            
            # 2. 更新数据库
            if old_id != new_id:
                # 先更新绑定关系中的 motion_id
                db.execute(
                    text("UPDATE character_motion_bindings SET motion_id = :new_id WHERE motion_id = :old_id"),
                    {"new_id": new_id, "old_id": old_id}
                )
                
                # 更新 Motion 表的 ID
                db.execute(
                    text("UPDATE assets_motions SET id = :new_id WHERE id = :old_id"),
                    {"new_id": new_id, "old_id": old_id}
                )
                
                logger.info(f"  ✓ 数据库已更新")
            else:
                logger.info(f"  - ID 相同，跳过")
            
            logger.info("")
        
        # 重新启用外键约束
        db.execute(text("PRAGMA foreign_keys = ON"))
        
        # 提交事务
        db.commit()
        logger.info("✅ 迁移完成！")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ 迁移失败: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_motion_ids()
