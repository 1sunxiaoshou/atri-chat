#!/usr/bin/env python3
"""
清理无效的VRM动画绑定关系
"""
import sqlite3
from core.storage import AppStorage
from core.logger import get_logger

logger = get_logger(__name__)

def cleanup_invalid_bindings():
    """清理无效的绑定关系"""
    try:
        storage = AppStorage()
        
        with sqlite3.connect(storage.db_path) as conn:
            # 查找无效的绑定关系（动画不存在）
            cursor = conn.execute("""
                SELECT ma.vrm_model_id, ma.animation_id
                FROM vrm_model_animations ma
                LEFT JOIN vrm_animations a ON ma.animation_id = a.animation_id
                WHERE a.animation_id IS NULL
            """)
            
            invalid_bindings = cursor.fetchall()
            
            if invalid_bindings:
                print(f"发现 {len(invalid_bindings)} 个无效绑定关系:")
                for model_id, anim_id in invalid_bindings:
                    print(f"  模型 {model_id} -> 动画 {anim_id} (动画不存在)")
                
                # 删除无效绑定
                for model_id, anim_id in invalid_bindings:
                    conn.execute(
                        "DELETE FROM vrm_model_animations WHERE vrm_model_id = ? AND animation_id = ?",
                        (model_id, anim_id)
                    )
                
                print(f"已清理 {len(invalid_bindings)} 个无效绑定关系")
            else:
                print("没有发现无效的绑定关系")
            
            # 显示清理后的状态
            print("\n=== 清理后的绑定关系 ===")
            cursor = conn.execute("""
                SELECT ma.vrm_model_id, ma.animation_id, a.name, a.name_cn
                FROM vrm_model_animations ma
                INNER JOIN vrm_animations a ON ma.animation_id = a.animation_id
                ORDER BY ma.vrm_model_id, a.name
            """)
            
            bindings = cursor.fetchall()
            current_model = None
            for model_id, anim_id, name, name_cn in bindings:
                if model_id != current_model:
                    print(f"\n模型 {model_id}:")
                    current_model = model_id
                print(f"  - {name} ({name_cn})")
        
    except Exception as e:
        logger.error(f"清理失败: {e}", exc_info=True)
        print(f"错误: {e}")

if __name__ == "__main__":
    cleanup_invalid_bindings()