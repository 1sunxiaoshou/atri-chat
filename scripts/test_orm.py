#!/usr/bin/env python3
"""测试 ORM 功能"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.db import get_session, Avatar, Motion, Voice, Character, CharacterMotionBinding
from core.logger import get_logger

logger = get_logger(__name__)


def test_create_assets():
    """测试创建资产"""
    logger.info("测试创建资产...")
    
    # 获取数据库会话
    session_gen = get_session()
    db = next(session_gen)
    
    try:
        # 1. 创建形象
        avatar = Avatar(
            name="测试形象",
            has_thumbnail=False
        )
        db.add(avatar)
        db.commit()
        db.refresh(avatar)
        logger.success(f"✓ 创建形象: {avatar.id} - {avatar.name}")
        
        # 2. 创建动作
        motion = Motion(
            name="测试动作",
            duration_ms=2500,
            description="这是一个测试动作",
            tags=["test", "idle"]
        )
        db.add(motion)
        db.commit()
        db.refresh(motion)
        logger.success(f"✓ 创建动作: {motion.id} - {motion.name}")
        
        # 3. 创建语音配置
        voice = Voice(
            name="测试语音",
            provider="openai",
            config_payload={
                "model": "tts-1",
                "voice": "alloy",
                "speed": 1.0
            }
        )
        db.add(voice)
        db.commit()
        db.refresh(voice)
        logger.success(f"✓ 创建语音配置: {voice.id} - {voice.name}")
        
        # 4. 创建角色
        character = Character(
            name="测试角色",
            system_prompt="你是一个测试角色",
            avatar_id=avatar.id,
            voice_config_id=voice.id,
            voice_speaker_id="alloy"
        )
        db.add(character)
        db.commit()
        db.refresh(character)
        logger.success(f"✓ 创建角色: {character.id} - {character.name}")
        
        # 5. 创建角色-动作绑定
        binding = CharacterMotionBinding(
            character_id=character.id,
            motion_id=motion.id,
            category="idle"
        )
        db.add(binding)
        db.commit()
        db.refresh(binding)
        logger.success(f"✓ 创建绑定: {binding.id}")
        
        # 6. 测试关系查询
        logger.info("\n测试关系查询...")
        
        # 通过角色访问资产
        char = db.query(Character).filter(Character.id == character.id).first()
        logger.info(f"角色名称: {char.name}")
        logger.info(f"  形象: {char.avatar.name}")
        logger.info(f"  语音: {char.voice_config.name} ({char.voice_config.provider})")
        logger.info(f"  动作绑定数: {len(char.motion_bindings)}")
        
        for binding in char.motion_bindings:
            logger.info(f"    - {binding.motion.name} ({binding.category})")
        
        logger.success("\n✓ 所有测试通过！")
        
        return {
            "avatar_id": avatar.id,
            "motion_id": motion.id,
            "voice_id": voice.id,
            "character_id": character.id,
            "binding_id": binding.id
        }
        
    except Exception as e:
        logger.error(f"✗ 测试失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def test_cleanup(ids: dict):
    """清理测试数据"""
    logger.info("\n清理测试数据...")
    
    session_gen = get_session()
    db = next(session_gen)
    
    try:
        # 删除角色（会级联删除绑定）
        character = db.query(Character).filter(Character.id == ids["character_id"]).first()
        if character:
            db.delete(character)
            logger.info("✓ 删除角色")
        
        # 删除资产
        motion = db.query(Motion).filter(Motion.id == ids["motion_id"]).first()
        if motion:
            db.delete(motion)
            logger.info("✓ 删除动作")
        
        voice = db.query(Voice).filter(Voice.id == ids["voice_id"]).first()
        if voice:
            db.delete(voice)
            logger.info("✓ 删除语音配置")
        
        avatar = db.query(Avatar).filter(Avatar.id == ids["avatar_id"]).first()
        if avatar:
            db.delete(avatar)
            logger.info("✓ 删除形象")
        
        db.commit()
        logger.success("✓ 清理完成")
        
    except Exception as e:
        logger.error(f"✗ 清理失败: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    """主函数"""
    try:
        ids = test_create_assets()
        test_cleanup(ids)
    except Exception as e:
        logger.error(f"测试失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
