"""AgentManager 使用示例"""
import sys
import os
import sqlite3
from pathlib import Path

# 添加项目根目录到路径
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv()

from core import AppStorage, AgentManager, ModelConfig, ProviderConfig, ModelType, TextMode
from core.store import SqliteStore
from langgraph.checkpoint.sqlite import SqliteSaver


def initialize_system():
    """初始化系统"""
    print("初始化系统...")
    
    # 1. 初始化存储
    app_storage = AppStorage(db_path="data/app.db")
    store = SqliteStore(db_path="data/store.db")
    
    # 2. 初始化检查点
    conn = sqlite3.connect("data/checkpoints.db", check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    
    # 3. 创建 AgentManager
    manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer
    )
    
    print("✓ 系统初始化完成\n")
    return manager, app_storage


def setup_character(app_storage: AppStorage):
    """设置角色和模型"""
    print("设置角色和模型...")
    
    # 1. 检查并更新供应商配置
    existing_provider = app_storage.get_provider("openai")
    provider = ProviderConfig(
        provider_id="openai",
        config_json={
            "api_key": os.getenv("DASHSCOPE_API_KEY"),
            "base_url": os.getenv("BASE_URL"),
            "temperature": 0.7
        }
    )
    
    if existing_provider:
        # 更新现有配置
        app_storage.update_provider(provider)
    else:
        # 添加新配置
        app_storage.add_provider(provider)
    
    # 2. 添加模型（如果不存在）
    model = ModelConfig(
        model_id=os.getenv("MODEL", "qwen-plus"),
        provider_id="openai",
        model_type=ModelType.TEXT,
        mode=TextMode.CHAT,
        enabled=True
    )
    app_storage.add_model(model)
    
    # 3. 添加 TTS（占位）
    app_storage.add_tts(
        tts_id="default-tts",
        provider_id="openai",
        voice_role="alloy"
    )
    
    # 4. 添加角色
    character_id = app_storage.add_character(
        name="小助手",
        description="一个友好的AI助手",
        system_prompt="你是一个友好、专业的AI助手。请用简洁、清晰的语言回答问题。",
        primary_model_id=model.model_id,
        primary_provider_id="openai",
        tts_id="default-tts"
    )
    
    print(f"✓ 角色创建完成，ID: {character_id}\n")
    return character_id, model.model_id


def chat_example(manager: AgentManager, app_storage: AppStorage):
    """对话示例"""
    print("="*60)
    print("对话示例")
    print("="*60 + "\n")
    
    # 获取或创建角色
    characters = app_storage.list_characters()
    if not characters:
        character_id, model_id = setup_character(app_storage)
    else:
        character = characters[0]
        character_id = character["character_id"]
        model_id = character["primary_model_id"]
    
    # 创建会话
    conversation_id = app_storage.create_conversation(
        character_id=character_id,
        title="示例对话"
    )
    print(f"创建会话，ID: {conversation_id}\n")
    
    # 对话 1
    print("用户: 你好，请介绍一下你自己")
    response1 = manager.send_message(
        user_message="你好，请介绍一下你自己",
        conversation_id=conversation_id,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"助手: {response1}\n")
    
    # 对话 2
    print("用户: 我刚才问了你什么？")
    response2 = manager.send_message(
        user_message="我刚才问了你什么？",
        conversation_id=conversation_id,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"助手: {response2}\n")
    
    # 查看会话历史
    print("-" * 60)
    print("会话历史:")
    messages = manager.get_conversation_history(conversation_id, from_checkpoint=False)
    for i, msg in enumerate(messages, 1):
        print(f"{i}. [{msg['message_type']}] {msg['content'][:50]}...")
    
    print("\n" + "="*60 + "\n")


def multi_conversation_example(manager: AgentManager, app_storage: AppStorage):
    """多会话示例"""
    print("="*60)
    print("多会话示例")
    print("="*60 + "\n")
    
    # 获取角色
    characters = app_storage.list_characters()
    if not characters:
        character_id, model_id = setup_character(app_storage)
    else:
        character = characters[0]
        character_id = character["character_id"]
        model_id = character["primary_model_id"]
    
    # 创建两个会话
    conv1_id = app_storage.create_conversation(character_id, "会话1：工作")
    conv2_id = app_storage.create_conversation(character_id, "会话2：生活")
    
    print(f"创建会话1，ID: {conv1_id}")
    print(f"创建会话2，ID: {conv2_id}\n")
    
    # 在会话1中对话
    print("--- 会话1：工作 ---")
    print("用户: 我需要写一份项目报告")
    response = manager.send_message(
        user_message="我需要写一份项目报告",
        conversation_id=conv1_id,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"助手: {response}\n")
    
    # 切换到会话2
    print("--- 切换到会话2：生活 ---")
    manager.switch_conversation(conv2_id, character_id, model_id, "openai")
    
    print("用户: 推荐一些周末活动")
    response = manager.send_message(
        user_message="推荐一些周末活动",
        conversation_id=conv2_id,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"助手: {response}\n")
    
    # 切换回会话1
    print("--- 切换回会话1：工作 ---")
    manager.switch_conversation(conv1_id, character_id, model_id, "openai")
    
    print("用户: 我刚才说要写什么？")
    response = manager.send_message(
        user_message="我刚才说要写什么？",
        conversation_id=conv1_id,
        character_id=character_id,
        model_id=model_id,
        provider_id="openai"
    )
    print(f"助手: {response}\n")
    
    # 查看缓存信息
    cache_info = manager.get_cache_info()
    print(f"缓存的 Agent 数量: {cache_info['cached_agents']}")
    print("（注意：两个会话共用同一个 Agent 实例）\n")
    
    print("="*60 + "\n")


def main():
    """主函数"""
    print("\n" + "="*60)
    print("AgentManager 使用示例")
    print("="*60 + "\n")
    
    # 初始化系统
    manager, app_storage = initialize_system()
    
    # 示例1：基本对话
    chat_example(manager, app_storage)
    
    # 示例2：多会话管理
    multi_conversation_example(manager, app_storage)
    
    print("示例运行完成！")


if __name__ == "__main__":
    main()
