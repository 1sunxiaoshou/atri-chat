"""测试 TTS 重构后的功能

验证：
1. TTSFactory 可以从 ORM 加载配置
2. TTS API 路由正常工作
3. 角色音色绑定功能正常
"""
import asyncio
from sqlalchemy.orm import Session
from core.db.base import get_session
from core.db import TTSProvider, VoiceAsset, Character
from core.tts import TTSFactory, TTSRegistry
from core.logger import get_logger

logger = get_logger(__name__)


def test_tts_factory_with_orm():
    """测试 TTSFactory 从 ORM 加载配置"""
    print("\n" + "="*60)
    print("测试 1: TTSFactory 从 ORM 加载配置")
    print("="*60)
    
    db = next(get_session())
    
    try:
        # 查询启用的供应商
        providers = db.query(TTSProvider).filter(TTSProvider.enabled == True).all()
        print(f"\n✓ 找到 {len(providers)} 个启用的 TTS 供应商")
        
        for provider in providers:
            print(f"\n供应商: {provider.name}")
            print(f"  - 类型: {provider.provider_type}")
            print(f"  - 音色数量: {len(provider.voices)}")
            
            # 测试创建 TTS 实例
            factory = TTSFactory()
            try:
                tts = factory.create_tts(
                    provider_type=provider.provider_type,
                    db_session=db
                )
                print(f"  ✓ 成功创建 TTS 实例")
            except Exception as e:
                print(f"  ✗ 创建失败: {e}")
        
        # 测试获取默认 TTS
        factory = TTSFactory()
        try:
            tts = factory.get_default_tts(db_session=db)
            print(f"\n✓ 成功获取默认 TTS 实例")
        except Exception as e:
            print(f"\n✗ 获取默认 TTS 失败: {e}")
        
    finally:
        db.close()


def test_voice_asset_binding():
    """测试音色资产绑定"""
    print("\n" + "="*60)
    print("测试 2: 音色资产绑定")
    print("="*60)
    
    db = next(get_session())
    
    try:
        # 查询所有音色资产
        voices = db.query(VoiceAsset).all()
        print(f"\n✓ 找到 {len(voices)} 个音色资产")
        
        for voice in voices:
            print(f"\n音色: {voice.name}")
            print(f"  - 供应商: {voice.provider.name} ({voice.provider.provider_type})")
            print(f"  - 被 {len(voice.characters)} 个角色使用")
            
            # 显示使用该音色的角色
            if voice.characters:
                for char in voice.characters:
                    print(f"    • {char.name}")
        
        # 查询所有角色的音色配置
        characters = db.query(Character).all()
        print(f"\n✓ 找到 {len(characters)} 个角色")
        
        for char in characters:
            print(f"\n角色: {char.name}")
            if char.voice_asset:
                print(f"  - 音色: {char.voice_asset.name}")
                print(f"  - 供应商: {char.voice_asset.provider.name}")
            else:
                print(f"  ✗ 未配置音色")
        
    finally:
        db.close()


def test_registry():
    """测试 TTS 注册中心"""
    print("\n" + "="*60)
    print("测试 3: TTS 注册中心")
    print("="*60)
    
    providers = TTSRegistry.get_all_providers()
    print(f"\n✓ 注册了 {len(providers)} 个 TTS 供应商类型")
    
    for provider_id, (provider_class, display_name) in providers.items():
        print(f"\n{display_name} ({provider_id})")
        
        # 获取配置模板
        template = provider_class.get_config_template()
        print(f"  配置字段:")
        for field_name, field_config in template.items():
            field_type = field_config.get('type', 'unknown')
            required = field_config.get('required', False)
            label = field_config.get('label', field_name)
            req_mark = " *" if required else ""
            print(f"    • {label} ({field_type}){req_mark}")


async def test_tts_synthesis():
    """测试 TTS 合成（如果有启用的供应商）"""
    print("\n" + "="*60)
    print("测试 4: TTS 合成功能")
    print("="*60)
    
    db = next(get_session())
    
    try:
        factory = TTSFactory()
        
        try:
            tts = factory.get_default_tts(db_session=db)
            print(f"\n✓ 获取到默认 TTS 实例")
            
            # 测试连接
            result = await tts.test_connection()
            if result["success"]:
                print(f"✓ 连接测试成功: {result.get('message', '')}")
            else:
                print(f"✗ 连接测试失败: {result.get('message', '')}")
            
        except ValueError as e:
            print(f"\n⚠ 未配置 TTS 供应商: {e}")
        except Exception as e:
            print(f"\n✗ TTS 测试失败: {e}")
        
    finally:
        db.close()


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("TTS 重构测试")
    print("="*60)
    
    try:
        # 同步测试
        test_registry()
        test_tts_factory_with_orm()
        test_voice_asset_binding()
        
        # 异步测试
        asyncio.run(test_tts_synthesis())
        
        print("\n" + "="*60)
        print("✓ 所有测试完成")
        print("="*60)
        
    except Exception as e:
        logger.error(f"测试失败: {e}", exc_info=True)
        print(f"\n✗ 测试失败: {e}")


if __name__ == "__main__":
    main()
