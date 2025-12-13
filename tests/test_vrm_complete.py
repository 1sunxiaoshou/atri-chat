"""VRM完整功能测试套件

测试内容：
1. 标记解析器
2. 标记过滤器
3. 句子分割
4. 音频生成器（串行）
5. 音频生成器（并行）
6. VRM服务
7. 端到端集成测试
"""
import sys
import asyncio
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Tuple

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.markup_parser import VRMMarkupParser, VRMMarkup
from core.vrm.markup_filter import MarkupFilter
from core.vrm.audio_generator import AudioGenerator
from core.vrm.audio_generator_parallel import ParallelAudioGenerator
from core.vrm.vrm_service import VRMService, VRMContext


# ==================== 测试工具类 ====================

class MockTTSFactory:
    """模拟TTS工厂"""
    
    def create_tts(self, provider_id=None):
        return MockTTS()


class MockTTS:
    """模拟TTS引擎"""
    
    async def synthesize_async(self, text: str, language=None) -> bytes:
        """模拟TTS合成，返回假的音频数据"""
        # 模拟每个字符0.1秒的音频
        duration = len(text) * 0.1
        # 返回假的WAV数据（44字节WAV头 + 数据）
        wav_header = b'RIFF' + b'\x00' * 40  # 简化的WAV头
        audio_data = b'\x00' * int(duration * 16000 * 2)  # 16kHz, 16bit
        return wav_header + audio_data


class MockAppStorage:
    """模拟应用存储"""
    
    def __init__(self):
        self.characters = {
            1: {
                "character_id": 1,
                "name": "测试角色",
                "vrm_model_id": "model-001",
                "tts_id": "default"
            }
        }
        
        self.vrm_animations = {
            "model-001": [
                {"name": "wave", "name_cn": "打招呼"},
                {"name": "scratch_head", "name_cn": "挠头"},
                {"name": "excited", "name_cn": "兴奋"},
            ]
        }
    
    def get_character(self, character_id: int):
        return self.characters.get(character_id)
    
    def list_vrm_animations(self, vrm_model_id: str):
        return self.vrm_animations.get(vrm_model_id, [])


# ==================== 单元测试 ====================

def test_markup_parser():
    """测试标记解析器"""
    print("\n【测试1】标记解析器")
    print("-" * 50)
    
    action_mapping = {"打招呼": "wave", "挠头": "scratch_head"}
    parser = VRMMarkupParser(action_mapping=action_mapping)
    
    # 测试1.1：基本解析
    text = "[State:开心][Action:打招呼]你好！"
    clean, markups = parser.parse(text)
    
    assert clean == "你好！", f"纯文本错误: {clean}"
    assert len(markups) == 2, f"标记数量错误: {len(markups)}"
    assert markups[0].type == "state" and markups[0].value == "happy"
    assert markups[1].type == "action" and markups[1].value == "wave"
    print("  ✓ 基本解析正确")
    
    # 测试1.2：位置计算
    text2 = "你好[State:开心]世界"
    clean2, markups2 = parser.parse(text2)
    
    assert markups2[0].position == 2, f"位置计算错误: {markups2[0].position}"
    print("  ✓ 位置计算正确")
    
    # 测试1.3：未知动作
    text3 = "[Action:未知动作]测试"
    clean3, markups3 = parser.parse(text3)
    
    assert markups3[0].value == "未知动作", "未知动作应保留原始中文名"
    print("  ✓ 未知动作处理正确")
    
    print("✅ 标记解析器测试通过")


def test_markup_filter():
    """测试标记过滤器"""
    print("\n【测试2】标记过滤器")
    print("-" * 50)
    
    # 测试2.1：移除标记
    text = "[State:开心][Action:打招呼]你好！"
    clean = MarkupFilter.remove_markup(text)
    
    assert clean == "你好！", f"过滤结果错误: {clean}"
    print("  ✓ 标记移除正确")
    
    # 测试2.2：检测标记
    assert MarkupFilter.has_markup(text) == True
    assert MarkupFilter.has_markup("普通文本") == False
    print("  ✓ 标记检测正确")
    
    print("✅ 标记过滤器测试通过")


def test_sentence_splitter():
    """测试句子分割"""
    print("\n【测试3】句子分割")
    print("-" * 50)
    
    generator = AudioGenerator(MockTTSFactory(), action_mapping={})
    
    # 测试3.1：基本分割
    text = "[State:开心]你好！[State:好奇]今天怎么样？"
    sentences = generator.split_sentences(text)
    
    assert len(sentences) == 2, f"句子数量错误: {len(sentences)}"
    assert sentences[0] == "[State:开心]你好！"
    assert sentences[1] == "[State:好奇]今天怎么样？"
    print("  ✓ 基本分割正确")
    
    # 测试3.2：标记在句子中间
    text2 = "你好[State:开心]世界！今天很好。"
    sentences2 = generator.split_sentences(text2)
    
    assert len(sentences2) == 2, f"句子数量错误: {len(sentences2)}"
    print("  ✓ 标记在中间的分割正确")
    
    # 测试3.3：没有标点符号
    text3 = "[State:开心]你好世界"
    sentences3 = generator.split_sentences(text3)
    
    assert len(sentences3) == 1, f"句子数量错误: {len(sentences3)}"
    print("  ✓ 无标点符号处理正确")
    
    print("✅ 句子分割测试通过")


async def test_audio_generator_serial():
    """测试串行音频生成器"""
    print("\n【测试4】串行音频生成器")
    print("-" * 50)
    
    action_mapping = {"打招呼": "wave"}
    generator = AudioGenerator(MockTTSFactory(), action_mapping=action_mapping)
    
    # 模拟音频时长获取
    with patch.object(generator, '_get_audio_duration', return_value=1.0):
        text = "[State:开心]你好！[State:好奇]今天怎么样？"
        segments = await generator.generate_by_sentence(text)
        
        assert len(segments) == 2, f"音频段数量错误: {len(segments)}"
        assert segments[0].start_time == 0.0
        assert segments[0].end_time == 1.0
        assert segments[1].start_time == 1.0
        assert segments[1].end_time == 2.0
        print("  ✓ 时间戳计算正确")
        
        assert segments[0].text == "你好！"
        assert segments[1].text == "今天怎么样？"
        print("  ✓ 文本提取正确")
    
    print("✅ 串行音频生成器测试通过")


async def test_audio_generator_parallel():
    """测试并行音频生成器"""
    print("\n【测试5】并行音频生成器")
    print("-" * 50)
    
    action_mapping = {"打招呼": "wave"}
    generator = ParallelAudioGenerator(MockTTSFactory(), action_mapping=action_mapping)
    
    # 模拟音频时长获取
    with patch.object(generator, '_get_audio_duration', return_value=1.0):
        text = "[State:开心]你好！[State:好奇]今天怎么样？[State:开心]很高兴见到你！"
        
        import time
        start_time = time.time()
        segments = await generator.generate_by_sentence(text)
        elapsed = time.time() - start_time
        
        assert len(segments) == 3, f"音频段数量错误: {len(segments)}"
        print(f"  ✓ 生成了 {len(segments)} 个音频段")
        
        # 并行处理应该比串行快
        # 注意：由于是模拟TTS，实际时间很短，这里只是验证逻辑
        print(f"  ✓ 处理耗时: {elapsed:.3f}秒")
        
        # 验证时间戳仍然是累积的
        assert segments[0].start_time == 0.0
        assert segments[1].start_time == 1.0
        assert segments[2].start_time == 2.0
        print("  ✓ 时间戳计算正确（累积）")
    
    print("✅ 并行音频生成器测试通过")


async def test_vrm_service():
    """测试VRM服务"""
    print("\n【测试6】VRM服务")
    print("-" * 50)
    
    storage = MockAppStorage()
    tts_factory = MockTTSFactory()
    
    # 测试6.1：创建VRM上下文
    vrm_service = VRMService(storage, tts_factory, parallel_tts=False)
    context = vrm_service.create_vrm_context(character_id=1)
    
    assert context.character_id == 1
    assert context.vrm_model_id == "model-001"
    assert len(context.action_mapping) == 3
    print("  ✓ VRM上下文创建正确")
    
    # 测试6.2：获取动作映射（带缓存）
    mapping1 = vrm_service.get_action_mapping("model-001")
    mapping2 = vrm_service.get_action_mapping("model-001")  # 第二次应该从缓存获取
    
    assert mapping1 == mapping2
    assert "打招呼" in mapping1
    print("  ✓ 动作映射获取正确（带缓存）")
    
    # 测试6.3：获取可用动作列表
    actions = vrm_service.get_available_actions("model-001")
    
    assert len(actions) == 3
    assert "打招呼" in actions
    print("  ✓ 可用动作列表正确")
    
    print("✅ VRM服务测试通过")


async def test_vrm_integration():
    """测试VRM端到端集成"""
    print("\n【测试7】VRM端到端集成")
    print("-" * 50)
    
    storage = MockAppStorage()
    tts_factory = MockTTSFactory()
    
    # 测试串行模式
    vrm_service_serial = VRMService(storage, tts_factory, parallel_tts=False)
    context = vrm_service_serial.create_vrm_context(character_id=1)
    
    text = "[State:开心][Action:打招呼]你好！[State:好奇]今天怎么样？"
    
    # 收集所有输出
    chunks = []
    with patch('core.vrm.audio_generator.AudioGenerator._get_audio_duration', return_value=1.0):
        async for chunk in vrm_service_serial.generate_vrm_audio_segments(text, context):
            chunks.append(chunk)
    
    # 验证输出
    assert len(chunks) > 0, "应该有输出"
    
    # 检查是否有音频段和完成信号
    import json
    has_segments = False
    has_complete = False
    
    for chunk in chunks:
        data = json.loads(chunk)
        if data.get("type") == "vrm_audio_segment":
            has_segments = True
        elif data.get("type") == "vrm_audio_complete":
            has_complete = True
    
    assert has_segments, "应该有音频段"
    assert has_complete, "应该有完成信号"
    print("  ✓ 串行模式集成测试通过")
    
    # 测试并行模式
    vrm_service_parallel = VRMService(storage, tts_factory, parallel_tts=True)
    chunks_parallel = []
    
    with patch('core.vrm.audio_generator.AudioGenerator._get_audio_duration', return_value=1.0):
        async for chunk in vrm_service_parallel.generate_vrm_audio_segments(text, context):
            chunks_parallel.append(chunk)
    
    assert len(chunks_parallel) > 0, "并行模式应该有输出"
    print("  ✓ 并行模式集成测试通过")
    
    print("✅ VRM端到端集成测试通过")


# ==================== 性能测试 ====================

async def test_performance_comparison():
    """性能对比测试"""
    print("\n【测试8】性能对比")
    print("-" * 50)
    
    storage = MockAppStorage()
    tts_factory = MockTTSFactory()
    
    # 生成较长的测试文本（10句话）
    sentences = [
        f"[State:开心]这是第{i}句话。"
        for i in range(1, 11)
    ]
    text = "".join(sentences)
    
    # 测试串行模式
    import time
    
    vrm_service_serial = VRMService(storage, tts_factory, parallel_tts=False)
    context = vrm_service_serial.create_vrm_context(character_id=1)
    
    with patch('core.vrm.audio_generator.AudioGenerator._get_audio_duration', return_value=0.5):
        start = time.time()
        chunks_serial = []
        async for chunk in vrm_service_serial.generate_vrm_audio_segments(text, context):
            chunks_serial.append(chunk)
        serial_time = time.time() - start
    
    print(f"  串行模式耗时: {serial_time:.3f}秒")
    
    # 测试并行模式
    vrm_service_parallel = VRMService(storage, tts_factory, parallel_tts=True)
    
    with patch('core.vrm.audio_generator.AudioGenerator._get_audio_duration', return_value=0.5):
        start = time.time()
        chunks_parallel = []
        async for chunk in vrm_service_parallel.generate_vrm_audio_segments(text, context):
            chunks_parallel.append(chunk)
        parallel_time = time.time() - start
    
    print(f"  并行模式耗时: {parallel_time:.3f}秒")
    
    # 并行应该更快（或至少不慢）
    speedup = serial_time / parallel_time if parallel_time > 0 else 1.0
    print(f"  性能提升: {speedup:.2f}x")
    
    print("✅ 性能对比测试完成")


# ==================== 主测试函数 ====================

async def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("VRM完整功能测试套件")
    print("=" * 60)
    
    try:
        # 同步测试
        test_markup_parser()
        test_markup_filter()
        test_sentence_splitter()
        
        # 异步测试
        await test_audio_generator_serial()
        await test_audio_generator_parallel()
        await test_vrm_service()
        await test_vrm_integration()
        await test_performance_comparison()
        
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
