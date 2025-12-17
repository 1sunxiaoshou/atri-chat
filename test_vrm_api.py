#!/usr/bin/env python3
"""
测试VRM API是否正确返回动画数据
"""
from core.storage import AppStorage
from core.logger import get_logger

logger = get_logger(__name__)

def test_vrm_api():
    """测试VRM API"""
    try:
        storage = AppStorage()
        
        # 获取第一个VRM模型
        models = storage.list_vrm_models()
        if not models:
            print("没有找到VRM模型")
            return
        
        model_id = models[0]['vrm_model_id']
        print(f"测试模型: {model_id} ({models[0]['name']})")
        
        # 获取模型详情（模拟API调用）
        model = storage.get_vrm_model(model_id)
        if not model:
            print("模型不存在")
            return
        
        print(f"模型信息:")
        print(f"  名称: {model['name']}")
        print(f"  文件名: {model['filename']}")
        
        # 获取动画数据
        animations = storage.get_model_animations(model_id)
        print(f"\n动画数据 ({len(animations)} 个):")
        
        for anim in animations:
            print(f"  - {anim['name']} ({anim['name_cn']})")
            print(f"    ID: {anim['animation_id']}")
            print(f"    时长: {anim['duration']}秒")
            print(f"    文件名: {anim['filename']}")
            print(f"    路径: {anim['animation_path']}")
            print()
        
        # 模拟完整的API响应
        model["model_path"] = f"/uploads/vrm_models/{model['filename']}"
        model["thumbnail_path"] = f"/uploads/vrm_thumbnails/{model['thumbnail_filename']}" if model.get('thumbnail_filename') else None
        model["animations"] = animations
        
        print("=== 完整API响应 ===")
        print(f"模型路径: {model['model_path']}")
        print(f"缩略图路径: {model['thumbnail_path']}")
        print(f"动画数量: {len(model['animations'])}")
        
        if model['animations']:
            print("前端应该能检测到动画！")
        else:
            print("前端仍然检测不到动画")
        
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)
        print(f"错误: {e}")

if __name__ == "__main__":
    test_vrm_api()