import sys
import os
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.asr.factory import ASRFactory



def test_asr_transcribe(asr):
    """测试ASR转录功能"""
    print("\n" + "=" * 50)
    print("测试ASR转录功能")
    print("=" * 50)
    
    # 测试音频文件路径
    test_audio_path = Path(__file__).parent / "【默认】就……就算这样戳我，也不会掉落道具哦！……爱丽丝又不是怪物！.wav"
    
    if not test_audio_path.exists():
        print(f"⚠ 测试音频文件不存在: {test_audio_path}")
        print("  请提供一个test_audio.wav文件进行测试")
        return
    
    try:
        # 同步转录
        result = asr.transcribe(test_audio_path)
        print(f"✓ 转录结果: {result}")
    except Exception as e:
        print(f"✗ 转录失败: {e}")


async def test_asr_transcribe_async(asr):
    """测试ASR异步转录功能"""
    print("\n" + "=" * 50)
    print("测试ASR异步转录功能")
    print("=" * 50)
    
    
    test_audio_path = Path(__file__).parent / "【默认】就……就算这样戳我，也不会掉落道具哦！……爱丽丝又不是怪物！.wav"
    
    if not test_audio_path.exists():
        print(f"⚠ 测试音频文件不存在: {test_audio_path}")
        return
    
    try:
        # 异步转录
        result = await asr.transcribe_async(test_audio_path)
        print(f"✓ 异步转录结果: {result}")
    except Exception as e:
        print(f"✗ 异步转录失败: {e}")


if __name__ == "__main__":
    # 测试工厂类
    asr_factory = ASRFactory()
    asr = asr_factory.get_default_asr()

    # 测试转录功能
    test_asr_transcribe(asr)
    
    # 测试异步转录
    import asyncio
    asyncio.run(test_asr_transcribe_async(asr))
    
    print("\n" + "=" * 50)
    print("测试完成！")
    print("=" * 50)
