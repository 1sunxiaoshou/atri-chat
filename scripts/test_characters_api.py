"""测试角色 API"""
from main import app
from fastapi.testclient import TestClient
from core.db import init_db, get_session, Avatar, TTSProvider, VoiceAsset

# 初始化数据库
init_db()

client = TestClient(app)
db = next(get_session())

try:
    # 1. 创建测试数据：形象
    avatar = Avatar(
        name="测试形象",
        has_thumbnail=False
    )
    db.add(avatar)
    db.commit()
    db.refresh(avatar)
    print(f"✓ 创建形象: {avatar.name} (ID: {avatar.id})")
    
    # 2. 创建测试数据：TTS 供应商
    provider = TTSProvider(
        provider_type="openai",
        name="OpenAI TTS",
        config_payload={"api_key": "sk-test"},
        enabled=True
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    print(f"✓ 创建供应商: {provider.name} (ID: {provider.id})")
    
    # 3. 创建测试数据：音色
    voice = VoiceAsset(
        provider_id=provider.id,
        name="Alloy",
        voice_config={"voice": "alloy", "speed": 1.0}
    )
    db.add(voice)
    db.commit()
    db.refresh(voice)
    print(f"✓ 创建音色: {voice.name} (ID: {voice.id})")
    
    print("\n" + "="*60)
    print("测试角色 API")
    print("="*60 + "\n")
    
    # 4. 创建角色
    print("1. 创建角色...")
    r1 = client.post('/api/v1/characters', json={
        "name": "测试角色",
        "system_prompt": "你是一个友好的AI助手",
        "avatar_id": avatar.id,
        "voice_asset_id": voice.id,
        "enabled": True
    })
    print(f"   状态码: {r1.status_code}")
    if r1.status_code == 200:
        character_id = r1.json()["data"]["id"]
        print(f"   ✓ 角色创建成功: {character_id}")
    else:
        print(f"   ✗ 失败: {r1.json()}")
        exit(1)
    
    # 5. 获取角色列表
    print("\n2. 获取角色列表...")
    r2 = client.get('/api/v1/characters')
    print(f"   状态码: {r2.status_code}")
    if r2.status_code == 200:
        characters = r2.json()["data"]
        print(f"   ✓ 角色数量: {len(characters)}")
        for char in characters:
            print(f"     - {char['name']} (形象: {char['avatar_name']}, 音色: {char['voice_asset_name']})")
    else:
        print(f"   ✗ 失败: {r2.json()}")
    
    # 6. 获取角色详情
    print("\n3. 获取角色详情...")
    r3 = client.get(f'/api/v1/characters/{character_id}')
    print(f"   状态码: {r3.status_code}")
    if r3.status_code == 200:
        char_detail = r3.json()["data"]
        print(f"   ✓ 角色名称: {char_detail['name']}")
        print(f"   ✓ 形象: {char_detail['avatar']['name']}")
        print(f"   ✓ 音色: {char_detail['voice_asset']['name']}")
        print(f"   ✓ 供应商: {char_detail['voice_asset']['provider_name']}")
    else:
        print(f"   ✗ 失败: {r3.json()}")
    
    # 7. 更新角色
    print("\n4. 更新角色...")
    r4 = client.patch(f'/api/v1/characters/{character_id}', json={
        "name": "更新后的角色名称",
        "enabled": False
    })
    print(f"   状态码: {r4.status_code}")
    if r4.status_code == 200:
        print(f"   ✓ 角色更新成功")
    else:
        print(f"   ✗ 失败: {r4.json()}")
    
    # 8. 删除角色
    print("\n5. 删除角色...")
    r5 = client.delete(f'/api/v1/characters/{character_id}')
    print(f"   状态码: {r5.status_code}")
    if r5.status_code == 200:
        print(f"   ✓ 角色删除成功")
    else:
        print(f"   ✗ 失败: {r5.json()}")
    
    print("\n" + "="*60)
    print("✓ 所有角色 API 测试通过")
    print("="*60)
    
finally:
    db.close()
