"""统一存储测试"""

import sys
import os
from pathlib import Path

# 获取项目根目录：当前脚本所在目录的父目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()

# 将项目根目录加入 Python 模块搜索路径
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
    
from core import AppStorage, ModelConfig, ProviderConfig, ModelType, TextMode, ModelFactory


def test_complete_workflow():
    """完整工作流测试"""
    # 初始化存储
    storage = AppStorage(db_path="data/app.db")
    
    # 1. 添加供应商
    print("=== 添加供应商 ===")
    openai_provider = ProviderConfig(
        provider_id="openai",
        config_json={
            "api_key": "sk-test",
            "base_url": "https://api.openai.com/v1",
            "temperature": 0.7
        }
    )
    result = storage.add_provider(openai_provider)
    print(f"添加 OpenAI 供应商: {result}")
    
    # 2. 添加模型
    print("\n=== 添加模型 ===")
    gpt4_model = ModelConfig(
        model_id="gpt-4",
        provider_id="openai",
        model_type=ModelType.TEXT,
        mode=TextMode.CHAT,
        enabled=True
    )
    result = storage.add_model(gpt4_model)
    print(f"添加 GPT-4 模型: {result}")
    
    # 3. 添加 TTS
    print("\n=== 添加 TTS ===")
    tts_id = storage.add_tts(
        tts_id="openai-tts-1",
        provider_id="openai",
        voice_role="alloy",
        api_key="sk-test",
        access_url="https://api.openai.com/v1/audio/speech"
    )
    print(f"添加 TTS: {tts_id}")
    
    # 4. 添加角色
    print("\n=== 添加角色 ===")
    character_id = storage.add_character(
        name="AI助手",
        description="一个友好的AI助手",
        system_prompt="你是一个有帮助的AI助手",
        primary_model_id="gpt-4",
        primary_provider_id="openai",
        tts_id="openai-tts-1"
    )
    print(f"添加角色，ID: {character_id}")
    
    # 5. 创建会话
    print("\n=== 创建会话 ===")
    conversation_id = storage.create_conversation(
        character_id=character_id,
        title="测试会话"
    )
    print(f"创建会话，ID: {conversation_id}")
    
    # 6. 添加消息
    print("\n=== 添加消息 ===")
    msg1_id = storage.add_message(conversation_id, "user", "你好")
    msg2_id = storage.add_message(conversation_id, "assistant", "你好！有什么可以帮助你的吗？")
    print(f"添加消息，ID: {msg1_id}, {msg2_id}")
    
    # 7. 查询数据
    print("\n=== 查询数据 ===")
    
    # 查询角色
    character = storage.get_character(character_id)
    print(f"角色信息: {character}")
    
    # 查询会话
    conversation = storage.get_conversation(conversation_id)
    print(f"会话信息: {conversation}")
    
    # 查询消息
    messages = storage.list_messages(conversation_id)
    print(f"消息列表: {len(messages)} 条")
    for msg in messages:
        print(f"  [{msg['message_type']}] {msg['content']}")
    
    # 8. 使用工厂创建模型
    print("\n=== 创建模型实例 ===")
    factory = ModelFactory(storage)
    model = factory.create_model("gpt-4", "openai")
    print(f"模型实例: {model}")
    
    # 9. 列出所有数据
    print("\n=== 列出所有数据 ===")
    print(f"供应商数量: {len(storage.list_providers())}")
    print(f"模型数量: {len(storage.list_models())}")
    print(f"TTS 数量: {len(storage.list_tts())}")
    print(f"角色数量: {len(storage.list_characters())}")
    print(f"会话数量: {len(storage.list_conversations())}")


if __name__ == "__main__":
    test_complete_workflow()
