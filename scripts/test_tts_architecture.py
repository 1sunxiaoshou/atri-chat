"""测试新的 TTS 架构（Provider → Voice → Character）"""
import asyncio
from core.db import init_db, get_session, TTSProvider, VoiceAsset, Character, Avatar
from core.logger import get_logger

logger = get_logger(__name__)


async def test_tts_architecture():
    """测试 TTS 供应商和音色资产"""
    
    # 初始化数据库
    init_db()
    
    # 获取会话
    db = next(get_session())
    
    try:
        logger.info("=" * 60)
        logger.info("测试 1: 创建 TTS 供应商")
        logger.info("=" * 60)
        
        # 创建 OpenAI 供应商
        openai_provider = TTSProvider(
            provider_type="openai",
            name="OpenAI TTS",
            config_payload={
                "api_key": "sk-test-key",
                "base_url": "https://api.openai.com/v1"
            },
            enabled=True
        )
        db.add(openai_provider)
        db.commit()
        db.refresh(openai_provider)
        
        logger.success(f"✓ 创建供应商: {openai_provider.name} (ID: {openai_provider.id})")
        
        # 创建 GPT-SoVITS 供应商
        gpt_sovits_provider = TTSProvider(
            provider_type="gpt_sovits",
            name="GPT-SoVITS 本地服务",
            config_payload={
                "api_url": "http://localhost:9880"
            },
            enabled=True
        )
        db.add(gpt_sovits_provider)
        db.commit()
        db.refresh(gpt_sovits_provider)
        
        logger.success(f"✓ 创建供应商: {gpt_sovits_provider.name} (ID: {gpt_sovits_provider.id})")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("测试 2: 为供应商创建音色")
        logger.info("=" * 60)
        
        # 为 OpenAI 创建多个音色
        openai_voices = [
            VoiceAsset(
                provider_id=openai_provider.id,
                name="Alloy",
                voice_config={"voice": "alloy", "speed": 1.0}
            ),
            VoiceAsset(
                provider_id=openai_provider.id,
                name="Echo",
                voice_config={"voice": "echo", "speed": 1.0}
            ),
            VoiceAsset(
                provider_id=openai_provider.id,
                name="Nova",
                voice_config={"voice": "nova", "speed": 1.0}
            )
        ]
        
        for voice in openai_voices:
            db.add(voice)
        
        db.commit()
        
        for voice in openai_voices:
            db.refresh(voice)
            logger.success(f"✓ 创建音色: {voice.name} (供应商: {openai_provider.name})")
        
        # 为 GPT-SoVITS 创建音色
        gpt_sovits_voice = VoiceAsset(
            provider_id=gpt_sovits_provider.id,
            name="角色A音色",
            voice_config={
                "refer_wav_path": "/path/to/reference.wav",
                "prompt_text": "参考文本",
                "prompt_language": "zh",
                "text_language": "zh"
            }
        )
        db.add(gpt_sovits_voice)
        db.commit()
        db.refresh(gpt_sovits_voice)
        
        logger.success(f"✓ 创建音色: {gpt_sovits_voice.name} (供应商: {gpt_sovits_provider.name})")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("测试 3: 查询供应商及其音色")
        logger.info("=" * 60)
        
        # 查询所有供应商
        all_providers = db.query(TTSProvider).all()
        
        for provider in all_providers:
            logger.info(f"\n供应商: {provider.name} ({provider.provider_type})")
            logger.info(f"  - 启用状态: {provider.enabled}")
            logger.info(f"  - 音色数量: {len(provider.voices)}")
            
            for voice in provider.voices:
                logger.info(f"    • {voice.name}")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("测试 4: 测试级联删除")
        logger.info("=" * 60)
        
        # 创建测试供应商
        test_provider = TTSProvider(
            provider_type="test",
            name="测试供应商",
            config_payload={},
            enabled=False
        )
        db.add(test_provider)
        db.commit()
        db.refresh(test_provider)
        
        # 创建测试音色
        test_voice = VoiceAsset(
            provider_id=test_provider.id,
            name="测试音色",
            voice_config={}
        )
        db.add(test_voice)
        db.commit()
        db.refresh(test_voice)
        
        logger.info(f"创建测试供应商: {test_provider.name}")
        logger.info(f"创建测试音色: {test_voice.name}")
        
        # 删除供应商（应该级联删除音色）
        db.delete(test_provider)
        db.commit()
        
        # 验证音色是否被删除
        deleted_voice = db.query(VoiceAsset).filter(VoiceAsset.id == test_voice.id).first()
        
        if deleted_voice is None:
            logger.success("✓ 级联删除成功：删除供应商时自动删除了音色")
        else:
            logger.error("✗ 级联删除失败：音色仍然存在")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("测试 5: 数据库表结构")
        logger.info("=" * 60)
        
        # 统计数据
        provider_count = db.query(TTSProvider).count()
        voice_count = db.query(VoiceAsset).count()
        
        logger.info(f"TTS 供应商总数: {provider_count}")
        logger.info(f"音色资产总数: {voice_count}")
        
        logger.info("")
        logger.success("=" * 60)
        logger.success("所有测试完成！")
        logger.success("=" * 60)
        
        logger.info("\n新架构说明：")
        logger.info("1. TTSProvider (供应商) - 存储供应商级别配置（API Key、服务地址等）")
        logger.info("2. VoiceAsset (音色) - 存储具体音色配置（voice_id、参考音频等）")
        logger.info("3. Character (角色) - 引用 VoiceAsset，一个音色可被多个角色使用")
        logger.info("\n层级关系：Provider (1) → Voices (N) → Characters (N)")
        
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_tts_architecture())
