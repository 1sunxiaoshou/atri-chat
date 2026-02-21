"""测试会话 API"""
from main import app
from fastapi.testclient import TestClient
from core.db import init_db, get_session, Avatar, TTSProvider, VoiceAsset, Character

# 初始化数据库
init_db()

client = TestClient(app)
db = next(get_session())

try:
    print("准备测试数据...")
    
    # 创建角色
    avatar = Avatar(name="测试形象", has_thumbnail=False)
    db.add(avatar)
    
    provider = TTSProvider(provider_type="openai", name="OpenAI", config_payload={}, enabled=True)
    db.add(provider)
    db.flush()
    
    voice = VoiceAsset(provider_id=provider.id, name="Alloy", voice_config={"voice": "alloy"})
    db.add(voice)
    db.flush()
    
    character = Character(
        name="测试角色",
        system_prompt="测试",
        avatar_id=avatar.id,
        voice_asset_id=voice.id,
        enabled=True
    )
    db.add(character)
    db.commit()
    
    print(f"✓ 角色: {character.name} ({character.id})")
    
    print("\n" + "="*60)
    print("测试会话 API")
    print("="*60 + "\n")
    
    # 1. 创建会话
    print("1. 创建会话...")
    r1 = client.post('/api/v1/conversations', json={
        "character_id": character.id,
        "title": "测试会话"
    })
    print(f"   状态码: {r1.status_code}")
    if r1.status_code == 200:
        conversation_id = r1.json()["data"]["id"]
        print(f"   ✓ 会话创建成功: {conversation_id}")
    else:
        print(f"   ✗ 失败: {r1.json()}")
        exit(1)
    
    # 2. 获取会话列表
    print("\n2. 获取会话列表...")
    r2 = client.get('/api/v1/conversations')
    print(f"   状态码: {r2.status_code}")
    if r2.status_code == 200:
        conversations = r2.json()["data"]
        print(f"   ✓ 会话数量: {len(conversations)}")
        for conv in conversations:
            print(f"     - {conv['title']} (角色: {conv['character_name']}, 消息数: {conv['message_count']})")
    else:
        print(f"   ✗ 失败: {r2.json()}")
    
    # 3. 按角色过滤会话
    print("\n3. 按角色过滤会话...")
    r3 = client.get(f'/api/v1/conversations?character_id={character.id}')
    print(f"   状态码: {r3.status_code}")
    if r3.status_code == 200:
        conversations = r3.json()["data"]
        print(f"   ✓ 该角色的会话数: {len(conversations)}")
    else:
        print(f"   ✗ 失败: {r3.json()}")
    
    # 4. 获取会话详情
    print("\n4. 获取会话详情...")
    r4 = client.get(f'/api/v1/conversations/{conversation_id}')
    print(f"   状态码: {r4.status_code}")
    if r4.status_code == 200:
        conv = r4.json()["data"]
        print(f"   ✓ 标题: {conv['title']}")
        print(f"   ✓ 角色: {conv['character_name']}")
        print(f"   ✓ 消息数: {conv['message_count']}")
    else:
        print(f"   ✗ 失败: {r4.json()}")
    
    # 5. 更新会话
    print("\n5. 更新会话...")
    r5 = client.put(f'/api/v1/conversations/{conversation_id}', json={
        "title": "更新后的标题"
    })
    print(f"   状态码: {r5.status_code}")
    if r5.status_code == 200:
        print(f"   ✓ 会话更新成功")
    else:
        print(f"   ✗ 失败: {r5.json()}")
    
    # 6. 获取会话消息（空）
    print("\n6. 获取会话消息...")
    r6 = client.get(f'/api/v1/conversations/{conversation_id}/messages')
    print(f"   状态码: {r6.status_code}")
    if r6.status_code == 200:
        data = r6.json()["data"]
        print(f"   ✓ 消息数量: {len(data['messages'])}")
    else:
        print(f"   ✗ 失败: {r6.json()}")
    
    # 7. 删除会话
    print("\n7. 删除会话...")
    r7 = client.delete(f'/api/v1/conversations/{conversation_id}')
    print(f"   状态码: {r7.status_code}")
    if r7.status_code == 200:
        print(f"   ✓ 会话删除成功")
    else:
        print(f"   ✗ 失败: {r7.json()}")
    
    print("\n" + "="*60)
    print("✓ 所有会话 API 测试通过")
    print("="*60)
    
finally:
    db.close()
