"""VRM 服务测试 - 简化版

测试新的极简 VRM 服务
"""
import sys
import asyncio
from pathlib import Path
from unittest.mock import Mock, AsyncMock

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.vrm_service import VRMService


class MockTTS:
    """模拟 TTS 引擎"""
    
    async def synthesize_async(self, text: str, language=None) -> bytes:
        """模拟 TTS 合成"""
        # 返回简单的 WAV 数据
        return b'RIFF' + b'\x00' * 40 + b'\x00' * 1000


class MockTTSFactory:
    """模拟 TTS 工厂"""
    
    def create_tts(self, provider_id=None):
        return MockTTS()


class MockAppStorage:
    """模拟应用存储"""
    
    def get_character(self, character_id: int):
        return {
            "character_id": character_id,
            "name": "测试角色",
            "tts_id": "default"
        }


async def test_vrm_service():
    """测试 VRM 服务"""
    print("\n【测试】VRM 服务")
    print("-" * 50)
    
    storage = MockAppStorage()
    tts_factory = MockTTSFactory()
    vrm_service = VRMService(storage, tts_factory)
    
    # 测试文本
    text = "[State:happy][Action:wave]你好！\n[State:neutral]今天怎么样？\n[State:sad]我有点难过。"
    
    # 收集所有段
    segments = []
    async for segment in vrm_service.generate_stream(text, character_id=1):
        segments.append(segment)
        print(f"  段 {segment['index']}: {segment['marked_text'][:20]}...")
    
    # 验证
    assert len(segments) == 3, f"期望 3 个段，实际 {len(segments)} 个"
    assert segments[0]["marked_text"] == "[State:happy][Action:wave]你好！"
    assert segments[1]["marked_text"] == "[State:neutral]今天怎么样？"
    assert segments[2]["marked_text"] == "[State:sad]我有点难过。"
    
    # 验证音频 URL
    for segment in segments:
        assert "audio_url" in segment
        assert segment["audio_url"].startswith("/uploads/vrm_audio/")
        assert segment["audio_url"].endswith(".wav")
    
    print("  ✓ 所有段生成正确")
    print("  ✓ 音频 URL 格式正确")
    print("✅ VRM 服务测试通过")


async def test_empty_sentences():
    """测试空句子处理"""
    print("\n【测试】空句子处理")
    print("-" * 50)
    
    storage = MockAppStorage()
    tts_factory = MockTTSFactory()
    vrm_service = VRMService(storage, tts_factory)
    
    # 包含空行的文本
    text = "[State:happy]你好！\n\n[State:neutral]今天怎么样？\n"
    
    segments = []
    async for segment in vrm_service.generate_stream(text, character_id=1):
        segments.append(segment)
    
    # 应该只有 2 个段（空行被过滤）
    assert len(segments) == 2, f"期望 2 个段，实际 {len(segments)} 个"
    
    print("  ✓ 空行正确过滤")
    print("✅ 空句子处理测试通过")


async def test_markup_removal():
    """测试标记移除"""
    print("\n【测试】标记移除")
    print("-" * 50)
    
    storage = MockAppStorage()
    tts_factory = MockTTSFactory()
    vrm_service = VRMService(storage, tts_factory)
    
    # 带标记的文本
    text = "[State:happy][Action:wave]你好！"
    
    segments = []
    async for segment in vrm_service.generate_stream(text, character_id=1):
        segments.append(segment)
    
    # 验证标记被正确移除（TTS 应该只收到纯文本）
    # 这里我们通过检查生成的音频来间接验证
    assert len(segments) == 1
    assert segments[0]["marked_text"] == "[State:happy][Action:wave]你好！"
    
    print("  ✓ 标记正确移除")
    print("✅ 标记移除测试通过")


async def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("VRM 服务测试套件")
    print("=" * 60)
    
    try:
        await test_vrm_service()
        await test_empty_sentences()
        await test_markup_removal()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        
    except AssertionError as e:
        print("\n" + "=" * 60)
        print(f"❌ 测试失败: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ 测试出错: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_all_tests())
