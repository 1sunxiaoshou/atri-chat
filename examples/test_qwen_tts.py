"""Qwen3-TTS 测试脚本

使用方法：
    uv run python examples/test_qwen_tts.py
"""

import asyncio
import os

# 添加项目根目录到 Python 路径
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.tts import TTSFactory


async def test_qwen_tts():
    """测试 Qwen3-TTS"""

    # 从环境变量获取 API Key
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("❌ 请设置环境变量 DASHSCOPE_API_KEY")
        print("   export DASHSCOPE_API_KEY='sk-xxxxxxxxxxxxxxxx'")
        return

    # 配置
    config = {
        # 供应商配置
        "api_key": api_key,
        "region": "beijing",  # 百联使用北京区域
        "model": "qwen3-tts-flash",
        # 音色配置
        "voice": "Cherry",
        "language_type": "Chinese",
        "instructions": "",
        "optimize_instructions": "false",
    }

    print("=" * 60)
    print("Qwen3-TTS 测试")
    print("=" * 60)

    # 创建 TTS 实例
    factory = TTSFactory()
    tts = factory.create_tts("qwen_tts", config)

    # 1. 测试连接
    print("\n1️⃣  测试连接...")
    result = await tts.test_connection()
    if result["success"]:
        print(f"   ✅ {result['message']}")
    else:
        print(f"   ❌ {result['message']}")
        return

    # 2. 测试非流式合成
    print("\n2️⃣  测试非流式合成...")
    text = "你好，欢迎使用 Qwen3-TTS 文本转语音服务！"
    print(f"   文本: {text}")

    try:
        audio_bytes = await tts.synthesize_async(text)
        print(f"   ✅ 合成成功！音频大小: {len(audio_bytes)} 字节")

        # 保存音频
        output_file = "output_qwen_tts.wav"
        with open(output_file, "wb") as f:
            f.write(audio_bytes)
        print(f"   💾 已保存到: {output_file}")

    except Exception as e:
        print(f"   ❌ 合成失败: {e}")
        return

    # 3. 测试流式合成
    print("\n3️⃣  测试流式合成...")
    text = "这是一段用于测试流式输出的较长文本。Qwen3-TTS 支持实时流式传输，可以边生成边播放。"
    print(f"   文本: {text}")

    try:
        chunks = []
        chunk_count = 0
        async for chunk in tts.synthesize_stream(text):
            chunks.append(chunk)
            chunk_count += 1

        total_size = sum(len(c) for c in chunks)
        print("   ✅ 流式合成成功！")
        print(f"   📦 接收到 {chunk_count} 个数据块")
        print(f"   📊 总大小: {total_size} 字节")

        # 保存音频
        output_file = "output_qwen_tts_stream.wav"
        with open(output_file, "wb") as f:
            for chunk in chunks:
                f.write(chunk)
        print(f"   💾 已保存到: {output_file}")

    except Exception as e:
        print(f"   ❌ 流式合成失败: {e}")
        return

    # 4. 测试不同音色
    print("\n4️⃣  测试不同音色...")
    voices = ["Cherry", "Ryan", "Vivian"]

    for voice in voices:
        config["voice"] = voice
        tts = factory.create_tts("qwen_tts", config)

        text = "你好" if voice in ["Cherry", "Vivian"] else "Hello"
        try:
            audio_bytes = await tts.synthesize_async(text)
            print(f"   ✅ {voice}: {len(audio_bytes)} 字节")
        except Exception as e:
            print(f"   ❌ {voice}: {e}")

    # 5. 测试指令控制（如果使用 instruct 模型）
    if config["model"] == "qwen3-tts-instruct-flash":
        print("\n5️⃣  测试指令控制...")
        config["instructions"] = "语速较快，语调上扬，充满热情"
        config["optimize_instructions"] = "true"

        tts = factory.create_tts("qwen_tts", config)
        text = "这是一款非常棒的产品，强烈推荐大家购买！"

        try:
            audio_bytes = await tts.synthesize_async(text)
            print(f"   ✅ 指令控制合成成功！音频大小: {len(audio_bytes)} 字节")

            output_file = "output_qwen_tts_instruct.wav"
            with open(output_file, "wb") as f:
                f.write(audio_bytes)
            print(f"   💾 已保存到: {output_file}")
        except Exception as e:
            print(f"   ❌ 指令控制合成失败: {e}")

    print("\n" + "=" * 60)
    print("✅ 测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_qwen_tts())
