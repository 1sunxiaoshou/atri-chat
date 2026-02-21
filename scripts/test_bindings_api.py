"""测试角色-动作绑定 API"""
from main import app
from fastapi.testclient import TestClient
from core.db import init_db, get_session, Avatar, TTSProvider, VoiceAsset, Character, Motion

# 初始化数据库
init_db()

client = TestClient(app)
db = next(get_session())

try:
    print("准备测试数据...")
    
    # 1. 创建形象
    avatar = Avatar(name="测试形象", has_thumbnail=False)
    db.add(avatar)
    
    # 2. 创建 TTS 供应商和音色
    provider = TTSProvider(provider_type="openai", name="OpenAI", config_payload={}, enabled=True)
    db.add(provider)
    db.flush()
    
    voice = VoiceAsset(provider_id=provider.id, name="Alloy", voice_config={"voice": "alloy"})
    db.add(voice)
    db.flush()
    
    # 3. 创建角色
    character = Character(
        name="测试角色",
        system_prompt="测试",
        avatar_id=avatar.id,
        voice_asset_id=voice.id,
        enabled=True
    )
    db.add(character)
    db.flush()
    
    # 4. 创建动作
    motion1 = Motion(name="待机动作1", duration_ms=3000)
    motion2 = Motion(name="待机动作2", duration_ms=2500)
    motion3 = Motion(name="思考动作", duration_ms=2000)
    db.add_all([motion1, motion2, motion3])
    db.commit()
    
    print(f"✓ 角色: {character.name} ({character.id})")
    print(f"✓ 动作: {motion1.name}, {motion2.name}, {motion3.name}")
    
    print("\n" + "="*60)
    print("测试角色-动作绑定 API")
    print("="*60 + "\n")
    
    # 5. 创建单个绑定
    print("1. 创建单个绑定...")
    r1 = client.post('/api/v1/character-motion-bindings', json={
        "character_id": character.id,
        "motion_id": motion1.id,
        "category": "idle",
        "weight": 1.0
    })
    print(f"   状态码: {r1.status_code}")
    if r1.status_code == 200:
        binding_id = r1.json()["data"]["id"]
        print(f"   ✓ 绑定创建成功: {binding_id}")
    else:
        print(f"   ✗ 失败: {r1.json()}")
        exit(1)
    
    # 6. 批量创建绑定
    print("\n2. 批量创建绑定...")
    r2 = client.post('/api/v1/character-motion-bindings/batch', json={
        "character_id": character.id,
        "motion_ids": [motion2.id, motion3.id],
        "category": "idle",
        "weight": 0.8
    })
    print(f"   状态码: {r2.status_code}")
    if r2.status_code == 200:
        result = r2.json()["data"]
        print(f"   ✓ 创建 {result['created_count']} 个，跳过 {result['skipped_count']} 个")
    else:
        print(f"   ✗ 失败: {r2.json()}")
    
    # 7. 获取角色的所有动作
    print("\n3. 获取角色的所有动作...")
    r3 = client.get(f'/api/v1/characters/{character.id}/motions')
    print(f"   状态码: {r3.status_code}")
    if r3.status_code == 200:
        data = r3.json()["data"]
        print(f"   ✓ 角色: {data['character_name']}")
        print(f"   ✓ 总绑定数: {data['total_bindings']}")
        for cat, bindings in data['bindings_by_category'].items():
            print(f"   ✓ 分类 '{cat}': {len(bindings)} 个动作")
            for b in bindings:
                print(f"     - {b['motion_name']} (权重: {b['weight']})")
    else:
        print(f"   ✗ 失败: {r3.json()}")
    
    # 8. 获取所有绑定（按角色过滤）
    print("\n4. 获取所有绑定...")
    r4 = client.get(f'/api/v1/character-motion-bindings?character_id={character.id}')
    print(f"   状态码: {r4.status_code}")
    if r4.status_code == 200:
        bindings = r4.json()["data"]
        print(f"   ✓ 绑定数量: {len(bindings)}")
    else:
        print(f"   ✗ 失败: {r4.json()}")
    
    # 9. 更新绑定
    print("\n5. 更新绑定...")
    r5 = client.put(f'/api/v1/character-motion-bindings/{binding_id}', json={
        "weight": 2.0,
        "category": "thinking"
    })
    print(f"   状态码: {r5.status_code}")
    if r5.status_code == 200:
        print(f"   ✓ 绑定更新成功")
    else:
        print(f"   ✗ 失败: {r5.json()}")
    
    # 10. 删除绑定
    print("\n6. 删除单个绑定...")
    r6 = client.delete(f'/api/v1/character-motion-bindings/{binding_id}')
    print(f"   状态码: {r6.status_code}")
    if r6.status_code == 200:
        print(f"   ✓ 绑定删除成功")
    else:
        print(f"   ✗ 失败: {r6.json()}")
    
    # 11. 批量删除
    print("\n7. 批量删除绑定...")
    r7 = client.post(
        f'/api/v1/characters/{character.id}/motions/batch-delete?category=idle',
        json=[motion2.id, motion3.id]
    )
    print(f"   状态码: {r7.status_code}")
    if r7.status_code == 200:
        result = r7.json()["data"]
        print(f"   ✓ 删除 {result['deleted_count']} 个绑定")
    else:
        print(f"   ✗ 失败: {r7.json()}")
    
    print("\n" + "="*60)
    print("✓ 所有角色-动作绑定 API 测试通过")
    print("="*60)
    
finally:
    db.close()
