"""测试VRM多对多关系的API"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.storage import AppStorage
from core.logger import get_logger

logger = get_logger(__name__, category="TEST")


def test_vrm_many_to_many():
    """测试VRM多对多关系"""
    
    # 使用测试数据库
    storage = AppStorage(db_path="data/test_vrm.db")
    
    logger.info("=" * 60)
    logger.info("测试VRM多对多关系")
    logger.info("=" * 60)
    
    # 1. 创建VRM模型
    logger.info("\n1. 创建VRM模型")
    models_data = [
        {
            "vrm_model_id": "model_xiaomei",
            "name": "小美",
            "model_path": "/models/xiaomei.vrm",
            "thumbnail_path": "/thumbnails/xiaomei.png"
        },
        {
            "vrm_model_id": "model_xiaoming",
            "name": "小明",
            "model_path": "/models/xiaoming.vrm"
        }
    ]
    
    for model_data in models_data:
        success = storage.add_vrm_model(**model_data)
        logger.info(f"  创建模型 {model_data['name']}: {'✓' if success else '✗'}")
    
    # 2. 创建VRM动作（独立于模型）
    logger.info("\n2. 创建VRM动作")
    animations_data = [
        {
            "animation_id": "anim_wave",
            "name": "wave",
            "name_cn": "挥手",
            "description": "友好地挥手打招呼，适合见面、告别等场景",
            "duration": 2.5
        },
        {
            "animation_id": "anim_nod",
            "name": "nod",
            "name_cn": "点头",
            "description": "轻轻点头表示同意、理解或确认",
            "duration": 1.0
        },
        {
            "animation_id": "anim_think",
            "name": "think",
            "name_cn": "思考",
            "description": "思考状态，手托下巴，适合回答复杂问题时使用",
            "duration": 3.5
        },
        {
            "animation_id": "anim_smile",
            "name": "smile",
            "name_cn": "微笑",
            "description": "露出微笑，表达友好和愉悦",
            "duration": 1.5
        }
    ]
    
    for anim_data in animations_data:
        success = storage.add_vrm_animation(**anim_data)
        logger.info(f"  创建动作 {anim_data['name_cn']} ({anim_data['name']}): {'✓' if success else '✗'}")
    
    # 3. 为模型添加动作
    logger.info("\n3. 为模型添加动作")
    
    # 小美：添加所有动作
    logger.info("  小美的动作:")
    xiaomei_animations = ["anim_wave", "anim_nod", "anim_think", "anim_smile"]
    count = storage.batch_add_model_animations("model_xiaomei", xiaomei_animations)
    logger.info(f"    批量添加: {count}/{len(xiaomei_animations)} 个动作")
    
    # 小明：只添加部分动作
    logger.info("  小明的动作:")
    xiaoming_animations = ["anim_wave", "anim_nod"]
    count = storage.batch_add_model_animations("model_xiaoming", xiaoming_animations)
    logger.info(f"    批量添加: {count}/{len(xiaoming_animations)} 个动作")
    
    # 4. 查询模型的动作
    logger.info("\n4. 查询模型的动作")
    
    xiaomei_anims = storage.get_model_animations("model_xiaomei")
    logger.info(f"  小美的动作 ({len(xiaomei_anims)} 个):")
    for anim in xiaomei_anims:
        logger.info(f"    - {anim['name_cn']} ({anim['name']}) - {anim['duration']}秒")
        if anim.get('description'):
            logger.info(f"      描述: {anim['description']}")
    
    xiaoming_anims = storage.get_model_animations("model_xiaoming")
    logger.info(f"  小明的动作 ({len(xiaoming_anims)} 个):")
    for anim in xiaoming_anims:
        logger.info(f"    - {anim['name_cn']} ({anim['name']}) - {anim['duration']}秒")
    
    # 5. 查询动作被哪些模型使用
    logger.info("\n5. 查询动作被哪些模型使用")
    
    wave_models = storage.get_animation_models("anim_wave")
    logger.info(f"  '挥手'动作被 {len(wave_models)} 个模型使用:")
    for model in wave_models:
        logger.info(f"    - {model['name']} ({model['vrm_model_id']})")
    
    think_models = storage.get_animation_models("anim_think")
    logger.info(f"  '思考'动作被 {len(think_models)} 个模型使用:")
    for model in think_models:
        logger.info(f"    - {model['name']} ({model['vrm_model_id']})")
    
    # 6. 移除模型的动作
    logger.info("\n6. 移除模型的动作")
    success = storage.remove_model_animation("model_xiaomei", "anim_think")
    logger.info(f"  移除小美的'思考'动作: {'✓' if success else '✗'}")
    
    xiaomei_anims = storage.get_model_animations("model_xiaomei")
    logger.info(f"  小美现在有 {len(xiaomei_anims)} 个动作")
    
    # 7. 测试动作映射（用于VRMService）
    logger.info("\n7. 测试动作映射")
    
    xiaomei_anims = storage.get_model_animations("model_xiaomei")
    action_mapping = {anim["name_cn"]: anim["name"] for anim in xiaomei_anims}
    logger.info(f"  小美的动作映射:")
    for cn_name, en_name in action_mapping.items():
        logger.info(f"    {cn_name} -> {en_name}")
    
    # 8. 列出所有动作
    logger.info("\n8. 列出所有动作")
    all_animations = storage.list_vrm_animations()
    logger.info(f"  系统中共有 {len(all_animations)} 个动作:")
    for anim in all_animations:
        logger.info(f"    - {anim['name_cn']} ({anim['name']}) - {anim['duration']}秒")
    
    # 9. 删除测试
    logger.info("\n9. 删除测试")
    
    # 删除动作（会自动解除关联）
    success = storage.delete_vrm_animation("anim_smile")
    logger.info(f"  删除'微笑'动作: {'✓' if success else '✗'}")
    
    xiaomei_anims = storage.get_model_animations("model_xiaomei")
    logger.info(f"  小美现在有 {len(xiaomei_anims)} 个动作")
    
    # 删除模型（会自动解除关联）
    success = storage.delete_vrm_model("model_xiaoming")
    logger.info(f"  删除小明模型: {'✓' if success else '✗'}")
    
    wave_models = storage.get_animation_models("anim_wave")
    logger.info(f"  '挥手'动作现在被 {len(wave_models)} 个模型使用")
    
    logger.info("\n" + "=" * 60)
    logger.info("测试完成！")
    logger.info("=" * 60)


if __name__ == "__main__":
    try:
        test_vrm_many_to_many()
        print("\n✓ 测试通过！")
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)
        print(f"\n✗ 测试失败: {e}")
        sys.exit(1)
