"""AgentManager 测试"""
import sys
import os
import sqlite3
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv()

from core import AppStorage, ModelConfig, ProviderConfig, ModelType, TextMode
from core.store import SqliteStore
from core.agent_manager import AgentManager
from langgraph.checkpoint.sqlite import SqliteSaver


def setup_test_data(storage: AppStorage):
    """设置测试数据"""
    print("=== 设置测试数据 ===")
    
    # 1. 添加供应商
    provider = ProviderConfig(
        provider_id="openai",
        config_json={
            "api_key": os.getenv("DASHSCOPE_API_KEY"),
            "base_url": os.getenv("BASE_URL"),
            "temperature": 0.7
        }
    )
    storage.add_provider(provider)
    print(f"✓ 添加供应商: {provider.provider_id}")
    
    # 2. 添加模型
    model = ModelConfig(
        model_id=os.getenv("MODEL", "qwen-plus"),
        provider_id="openai",
        model_type=ModelType.TEXT,
        mode=TextMode.CHAT,
        enabled=True
    )
    storage.add_model(model)
    print(f"✓ 添加模型: {model.model_id}")
    
    # 3. 添加 TTS（占位）
    storage.add_tts(
        tts_id="test-tts",
        provider_id="openai",
        voice_role="alloy"
    )
    print("✓ 添加 TTS")
    
    # 4. 添加角色
    character_id = storage.add_character(
        name="AI助手",
        description="一个友好的AI助手",
        system_prompt="你是一个友好的AI助手，请用简洁的语言回答问题。",
        primary_model_id=model.model_id,
        primary_provider_id="openai",
        tts_id="test-tts"
    )
    print(f"✓ 添加角色，ID: {character_id}")
    
    # 5. 创建会话
    conversation_id = storage.create_conversation(
        character_id=character_id,
        title="测试会话"
    )
    print(f"✓ 创建会话，ID: {conversation_id}")
    
    return character_id, conversation_id, model.model_id


def test_agent_manager():
    """测试 AgentManager 完整流程"""
    print("\n" + "="*60)
    print("AgentManager 测试")
    print("="*60 + "\n")
    
    # 初始化存储
    app_storage = AppStorage(db_path="data/test_agent_manager.db")
    store = SqliteStore(db_path="data/test_store.db")
    
    # 初始化检查点
    conn = sqlite3.connect("data/test_checkpoints.db", check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    
    # 设置测试数据
    character_id, conversation_id, model_id = setup_test_data(app_storage)
    
    # 创建 AgentManager
    print("\n=== 创建 AgentManager ===")
    manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer
    )
    print("✓ AgentManager 创建成功")
    
    # 测试 1: 发送第一条消息
    print("\n=== 测试 1: 发送第一条消息 ===")
    try:
        response1 = manager.send_message(
            user_message="你好，请介绍一下你自己",
            conversation_id=conversation_id,
            character_id=character_id,
            model_id=model_id,
            provider_id="openai"
        )
        print(f"用户: 你好，请介绍一下你自己")
        print(f"助手: {response1}")
        print("✓ 第一条消息发送成功")
    except Exception as e:
        print(f"✗ 发送消息失败: {e}")
        return
    
    # 测试 2: 发送第二条消息（测试对话历史）
    print("\n=== 测试 2: 发送第二条消息（测试对话历史）===")
    try:
        response2 = manager.send_message(
            user_message="我刚才问了你什么问题？",
            conversation_id=conversation_id,
            character_id=character_id,
            model_id=model_id,
            provider_id="openai"
        )
        print(f"用户: 我刚才问了你什么问题？")
        print(f"助手: {response2}")
        print("✓ 第二条消息发送成功（agent 记住了上下文）")
    except Exception as e:
        print(f"✗ 发送消息失败: {e}")
    
    # 测试 3: 查看缓存信息
    print("\n=== 测试 3: 查看缓存信息 ===")
    cache_info = manager.get_cache_info()
    print(f"缓存的 Agent 数量: {cache_info['cached_agents']}")
    for key in cache_info['cache_keys']:
        print(f"  - 角色ID: {key['character_id']}, 模型: {key['provider_id']}/{key['model_id']}")
    
    # 测试 4: 获取会话历史（从 AppStorage）
    print("\n=== 测试 4: 获取会话历史（从 AppStorage）===")
    messages = manager.get_conversation_history(conversation_id, from_checkpoint=False)
    print(f"消息数量: {len(messages)}")
    for msg in messages:
        print(f"  [{msg['message_type']}] {msg['content'][:50]}...")
    
    # 测试 5: 获取会话历史（从 Checkpoint）
    print("\n=== 测试 5: 获取会话历史（从 Checkpoint）===")
    checkpoint_messages = manager.get_conversation_history(conversation_id, from_checkpoint=True)
    print(f"检查点消息数量: {len(checkpoint_messages)}")
    for msg in checkpoint_messages:
        print(f"  [{msg['type']}] {msg['content'][:50]}...")
    
    # 测试 6: 创建第二个会话并切换
    print("\n=== 测试 6: 创建第二个会话并切换 ===")
    conversation_id_2 = app_storage.create_conversation(
        character_id=character_id,
        title="第二个测试会话"
    )
    print(f"✓ 创建第二个会话，ID: {conversation_id_2}")
    
    switch_result = manager.switch_conversation(
        conversation_id=conversation_id_2,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"✓ 切换到会话: {switch_result['title']}")
    
    # 在新会话中发送消息
    response3 = manager.send_message(
        user_message="这是新会话，你还记得我之前问的问题吗？",
        conversation_id=conversation_id_2,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"用户: 这是新会话，你还记得我之前问的问题吗？")
    print(f"助手: {response3}")
    print("✓ 新会话中的消息发送成功（应该不记得旧会话内容）")
    
    # 测试 7: 清空缓存
    print("\n=== 测试 7: 清空缓存 ===")
    cleared = manager.clear_agent_cache()
    print(f"✓ 清空了 {cleared} 个缓存的 Agent")
    
    cache_info_after = manager.get_cache_info()
    print(f"清空后缓存数量: {cache_info_after['cached_agents']}")
    
    # 测试 8: 清空会话历史
    print("\n=== 测试 8: 清空会话历史 ===")
    clear_result = manager.clear_conversation_history(
        conversation_id=conversation_id_2,
        clear_checkpoint=True,
        clear_messages=True
    )
    print(f"✓ 清空检查点: {clear_result['checkpoint_cleared']}")
    print(f"✓ 删除消息: {clear_result['messages_deleted']} 条")
    
    print("\n" + "="*60)
    print("测试完成！")
    print("="*60)


if __name__ == "__main__":
    test_agent_manager()
