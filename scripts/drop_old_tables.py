#!/usr/bin/env python3
"""删除旧表，保留新的 ORM 表"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import sqlite3
from core.paths import get_path_manager
from core.logger import get_logger

logger = get_logger(__name__)

# 需要删除的旧表
OLD_TABLES = [
    "provider_config",  # 旧供应商配置（新表是 provider_configs）
    "tts_models",       # 旧 TTS 配置（新表是 assets_voices）
    "vrm_models",       # 旧 VRM 模型（新表是 assets_avatars）
    "vrm_animations",   # 旧动作（新表是 assets_motions）
    "vrm_model_animations",  # 旧模型-动作关联（新表是 character_motion_bindings）
]

def main():
    """删除旧表"""
    path_manager = get_path_manager()
    db_path = path_manager.data_dir / "app.db"
    
    logger.info(f"数据库路径: {db_path}")
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # 获取所有表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        all_tables = [row[0] for row in cursor.fetchall()]
        
        logger.info(f"\n当前共有 {len(all_tables)} 个表")
        
        # 删除旧表
        deleted_count = 0
        for table in OLD_TABLES:
            if table in all_tables:
                logger.info(f"删除旧表: {table}")
                cursor.execute(f"DROP TABLE IF EXISTS {table}")
                deleted_count += 1
            else:
                logger.warning(f"表不存在，跳过: {table}")
        
        conn.commit()
        logger.success(f"\n✓ 成功删除 {deleted_count} 个旧表")
        
        # 显示剩余的表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        remaining_tables = [row[0] for row in cursor.fetchall()]
        
        logger.info(f"\n剩余 {len(remaining_tables)} 个表:")
        for table in remaining_tables:
            logger.info(f"  - {table}")
        
    except Exception as e:
        logger.error(f"✗ 删除失败: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
