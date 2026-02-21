"""测试角色API的完整集成"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.schemas import CharacterCreate, CharacterUpdate
from core.db import get_session
from core.db.models import Character, Avatar, VoiceAsset
from core.logger import get_logger

logger = get_logger(__name__)


def test_character_schemas():
    """测试角色 Schema 的完整性"""
    print("\n=== 测试 CharacterCreate Schema ===")
    
    # 测试创建 schema
    create_data = {
        "name": "测试角色",
        "system_prompt": "你是一个测试角色",
        "portrait_url": "https://example.com/portrait.png",
        "avatar_id": "test-avatar-id",
        "voice_asset_id": "test-voice-id",
        "voice_speaker_id": "speaker-1",
        "primary_model_id": "gpt-4",
        "primary_provider_id": "openai",
        "enabled": True
    }
    
    try:
        char_create = CharacterCreate(**create_data)
        print("✅ CharacterCreate 验证通过")
        print(f"   - name: {char_create.name}")
        print(f"   - portrait_url: {char_create.portrait_url}")
        print(f"   - avatar_id: {char_create.avatar_id}")
        print(f"   - voice_asset_id: {char_create.voice_asset_id}")
    except Exception as e:
        print(f"❌ CharacterCreate 验证失败: {e}")
        return False
    
    print("\n=== 测试 CharacterUpdate Schema ===")
    
    # 测试更新 schema
    update_data = {
        "portrait_url": "https://example.com/new-portrait.png",
        "system_prompt": "更新后的提示词"
    }
    
    try:
        char_update = CharacterUpdate(**update_data)
        print("✅ CharacterUpdate 验证通过")
        print(f"   - portrait_url: {char_update.portrait_url}")
        print(f"   - system_prompt: {char_update.system_prompt}")
    except Exception as e:
        print(f"❌ CharacterUpdate 验证失败: {e}")
        return False
    
    return True


def test_database_integration():
    """测试数据库集成"""
    print("\n=== 测试数据库集成 ===")
    
    session = next(get_session())
    
    try:
        # 检查是否有可用的资产
        avatars = session.query(Avatar).all()
        voice_assets = session.query(VoiceAsset).all()
        
        print(f"可用形象资产: {len(avatars)}")
        print(f"可用音色资产: {len(voice_assets)}")
        
        if not avatars or not voice_assets:
            print("⚠️  缺少必要的资产,跳过创建测试")
            return True
        
        # 检查现有角色
        characters = session.query(Character).all()
        print(f"\n当前角色数量: {len(characters)}")
        
        for char in characters[:3]:
            print(f"\n角色: {char.name}")
            print(f"  - ID: {char.id}")
            print(f"  - portrait_url: {char.portrait_url}")
            print(f"  - avatar_id: {char.avatar_id}")
            print(f"  - voice_asset_id: {char.voice_asset_id}")
            print(f"  - voice_speaker_id: {char.voice_speaker_id}")
        
        print("\n✅ 数据库集成测试通过")
        return True
        
    except Exception as e:
        logger.error(f"数据库集成测试失败: {e}", exc_info=True)
        return False
    finally:
        session.close()


def main():
    """主测试函数"""
    print("=" * 60)
    print("角色 API 集成测试")
    print("=" * 60)
    
    # 测试 Schema
    schema_ok = test_character_schemas()
    
    # 测试数据库
    db_ok = test_database_integration()
    
    print("\n" + "=" * 60)
    if schema_ok and db_ok:
        print("✅ 所有测试通过!")
    else:
        print("❌ 部分测试失败")
    print("=" * 60)


if __name__ == "__main__":
    main()
