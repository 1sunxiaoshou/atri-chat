"""ASR和TTS使用示例"""
import asyncio
from pathlib import Path
from core.agent_manager import AgentManager
from core.storage import AppStorage
from core.store import SqliteStore
from langgraph.checkpoint.sqlite import SqliteSaver


def example_asr_basic():
    """基础ASR使用示例"""
    print("=== 基础ASR示例 ===")
    
    # 初始化
    app_storage = AppStorage("data/app.db")
    store = SqliteStore("data/store.db")
    checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
    
    agent_manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer
    )
    
    # 使用ASR转换音频文件
    audio_path = "path/to/audio.wav"  # 替换为实际音频文件路径
    
    try:
        # 方式1: 直接使用ASR
        asr = agent_manager.asr_factory.get_default_asr()
        text = asr.transcribe(audio_path, language="zh")
        print(f"识别结果: {text}")
        
        # 方式2: 通过send_audio_message发送音频消息
        # 假设已有角色ID=1, 会话ID=1
        response = agent_manager.send_audio_message(
            audio=audio_path,
            conversation_id=1,
            character_id=1,
            model_id="gpt-4",
            provider_id="openai"
        )
        print(f"Agent响应: {response}")
        
    except Exception as e:
        print(f"错误: {e}")


def example_tts_basic():
    """基础TTS使用示例"""
    print("\n=== 基础TTS示例 ===")
    
    # 初始化
    app_storage = AppStorage("data/app.db")
    store = SqliteStore("data/store.db")
    checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
    
    agent_manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer
    )
    
    try:
        # 使用TTS转换文本为语音
        text = "你好，我是AI助手。"
        audio_bytes = agent_manager.text_to_speech(text, language="zh")
        
        # 保存音频文件
        output_path = Path("output.wav")
        output_path.write_bytes(audio_bytes)
        print(f"音频已保存到: {output_path}")
        
    except Exception as e:
        print(f"错误: {e}")


async def example_async():
    """异步使用示例"""
    print("\n=== 异步示例 ===")
    
    # 初始化
    app_storage = AppStorage("data/app.db")
    store = SqliteStore("data/store.db")
    checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
    
    agent_manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer
    )
    
    try:
        # 异步ASR
        audio_path = "path/to/audio.wav"
        asr = agent_manager.asr_factory.get_default_asr()
        text = await asr.transcribe_async(audio_path, language="zh")
        print(f"异步识别结果: {text}")
        
        # 异步TTS
        audio_bytes = await agent_manager.text_to_speech_async(
            "这是异步生成的语音",
            language="zh"
        )
        print(f"异步生成音频大小: {len(audio_bytes)} bytes")
        
    except Exception as e:
        print(f"错误: {e}")


def example_audio_conversation():
    """完整的音频对话示例"""
    print("\n=== 音频对话示例 ===")
    
    # 初始化
    app_storage = AppStorage("data/app.db")
    store = SqliteStore("data/store.db")
    checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
    
    agent_manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer
    )
    
    try:
        # 1. 用户发送音频消息
        audio_path = "path/to/user_audio.wav"
        text_response = agent_manager.send_audio_message(
            audio=audio_path,
            conversation_id=1,
            character_id=1,
            model_id="gpt-4",
            provider_id="openai"
        )
        print(f"Agent文本响应: {text_response}")
        
        # 2. 将响应转换为语音
        audio_response = agent_manager.text_to_speech(text_response)
        
        # 3. 保存响应音频
        output_path = Path("response.wav")
        output_path.write_bytes(audio_response)
        print(f"响应音频已保存到: {output_path}")
        
    except Exception as e:
        print(f"错误: {e}")


if __name__ == "__main__":
    # 运行示例（根据需要取消注释）
    
    # example_asr_basic()
    # example_tts_basic()
    # asyncio.run(example_async())
    # example_audio_conversation()
    
    print("\n请根据需要取消注释相应的示例函数")
