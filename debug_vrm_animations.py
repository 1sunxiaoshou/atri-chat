#!/usr/bin/env python3
"""
调试VRM动画绑定问题的脚本
"""
import sqlite3
from pathlib import Path
from core.storage import AppStorage
from core.logger import get_logger

logger = get_logger(__name__)

def debug_vrm_animations():
    """调试VRM动画绑定"""
    try:
        # 初始化存储
        storage = AppStorage()
        
        print("=== VRM模型列表 ===")
        models = storage.list_vrm_models()
        for model in models:
            print(f"模型ID: {model['vrm_model_id']}")
            print(f"名称: {model['name']}")
            print(f"文件名: {model['filename']}")
            print()
        
        print("=== VRM动画列表 ===")
        animations = storage.list_vrm_animations()
        print(f"总共有 {len(animations)} 个动画")
        for anim in animations:
            print(f"动画ID: {anim['animation_id']}")
            print(f"名称: {anim['name']} ({anim['name_cn']})")
            print(f"文件名: {anim.get('filename', 'N/A')}")
            print()
        
        print("=== 模型-动画绑定关系 ===")
        # 直接查询关联表
        with sqlite3.connect(storage.db_path) as conn:
            cursor = conn.execute("SELECT vrm_model_id, animation_id FROM vrm_model_animations")
            bindings = cursor.fetchall()
            
        print(f"总共有 {len(bindings)} 个绑定关系")
        for model_id, anim_id in bindings:
            print(f"模型 {model_id} -> 动画 {anim_id}")
        
        # 检查特定模型的动画
        if models:
            first_model_id = models[0]['vrm_model_id']
            print(f"\n=== 检查模型 {first_model_id} 的动画 ===")
            model_animations = storage.get_model_animations(first_model_id)
            print(f"该模型有 {len(model_animations)} 个动画")
            for anim in model_animations:
                print(f"- {anim['name']} ({anim['name_cn']})")
                print(f"  文件: {anim.get('filename', 'N/A')}")
                print(f"  路径: {anim.get('animation_path', 'N/A')}")
        
    except Exception as e:
        logger.error(f"调试失败: {e}", exc_info=True)
        print(f"错误: {e}")

if __name__ == "__main__":
    debug_vrm_animations()