"""测试VRM模块修复后的逻辑"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.markup_parser import VRMMarkupParser
from core.vrm.audio_generator import AudioGenerator


def test_markup_parser():
    """测试标记解析器的位置计算"""
    # 创建测试用的动作映射
    action_mapping = {
        "打招呼": "wave",
        "挠头": "scratch_head"
    }
    parser = VRMMarkupParser(action_mapping=action_mapping)
    
    # 测试用例1：标记在开头
    text1 = "[State:开心]你好！"
    clean1, markups1 = parser.parse(text1)
    assert clean1 == "你好！", f"期望'你好！'，实际'{clean1}'"
    assert len(markups1) == 1, f"期望1个标记，实际{len(markups1)}个"
    assert markups1[0].position == 0, f"期望位置0，实际{markups1[0].position}"
    assert markups1[0].value == "happy", f"期望'happy'，实际'{markups1[0].value}'"
    print("✓ 测试1通过：标记在开头")
    
    # 测试用例2：标记在中间
    text2 = "你好[State:开心]世界"
    clean2, markups2 = parser.parse(text2)
    assert clean2 == "你好世界", f"期望'你好世界'，实际'{clean2}'"
    assert len(markups2) == 1, f"期望1个标记，实际{len(markups2)}个"
    assert markups2[0].position == 2, f"期望位置2，实际{markups2[0].position}"
    print("✓ 测试2通过：标记在中间")
    
    # 测试用例3：多个标记
    text3 = "[State:开心][Action:打招呼]你好！[State:好奇]今天怎么样？"
    clean3, markups3 = parser.parse(text3)
    assert clean3 == "你好！今天怎么样？", f"期望'你好！今天怎么样？'，实际'{clean3}'"
    assert len(markups3) == 3, f"期望3个标记，实际{len(markups3)}个"
    assert markups3[0].position == 0, f"标记1期望位置0，实际{markups3[0].position}"
    assert markups3[1].position == 0, f"标记2期望位置0，实际{markups3[1].position}"
    assert markups3[2].position == 3, f"标记3期望位置3，实际{markups3[2].position}"
    print("✓ 测试3通过：多个标记")
    
    # 测试用例4：标记在末尾
    text4 = "你好世界[State:开心]"
    clean4, markups4 = parser.parse(text4)
    assert clean4 == "你好世界", f"期望'你好世界'，实际'{clean4}'"
    assert len(markups4) == 1, f"期望1个标记，实际{len(markups4)}个"
    assert markups4[0].position == 4, f"期望位置4，实际{markups4[0].position}"
    print("✓ 测试4通过：标记在末尾")


def test_sentence_splitter():
    """测试句子分割器"""
    from core.tts.factory import TTSFactory
    
    # 创建一个模拟的TTS工厂（不实际调用TTS）
    class MockTTSFactory:
        pass
    
    # 创建测试用的动作映射
    action_mapping = {
        "打招呼": "wave",
        "挠头": "scratch_head"
    }
    
    generator = AudioGenerator(MockTTSFactory(), action_mapping=action_mapping)
    
    # 测试用例1：简单分割
    text1 = "[State:开心]你好！[State:好奇]今天怎么样？"
    sentences1 = generator.split_sentences(text1)
    assert len(sentences1) == 2, f"期望2个句子，实际{len(sentences1)}个"
    assert sentences1[0] == "[State:开心]你好！", f"句子1错误：{sentences1[0]}"
    assert sentences1[1] == "[State:好奇]今天怎么样？", f"句子2错误：{sentences1[1]}"
    print("✓ 测试5通过：简单句子分割")
    
    # 测试用例2：标记在句子中间
    text2 = "你好[State:开心]世界！今天[Action:挠头]很好。"
    sentences2 = generator.split_sentences(text2)
    assert len(sentences2) == 2, f"期望2个句子，实际{len(sentences2)}个"
    assert sentences2[0] == "你好[State:开心]世界！", f"句子1错误：{sentences2[0]}"
    assert sentences2[1] == "今天[Action:挠头]很好。", f"句子2错误：{sentences2[1]}"
    print("✓ 测试6通过：标记在句子中间")
    
    # 测试用例3：连续标记
    text3 = "[State:开心][Action:打招呼]你好！"
    sentences3 = generator.split_sentences(text3)
    assert len(sentences3) == 1, f"期望1个句子，实际{len(sentences3)}个"
    assert sentences3[0] == "[State:开心][Action:打招呼]你好！", f"句子错误：{sentences3[0]}"
    print("✓ 测试7通过：连续标记")
    
    # 测试用例4：没有标点符号
    text4 = "[State:开心]你好世界"
    sentences4 = generator.split_sentences(text4)
    assert len(sentences4) == 1, f"期望1个句子，实际{len(sentences4)}个"
    assert sentences4[0] == "[State:开心]你好世界", f"句子错误：{sentences4[0]}"
    print("✓ 测试8通过：没有标点符号")


if __name__ == "__main__":
    print("=" * 50)
    print("测试VRM模块修复")
    print("=" * 50)
    
    try:
        test_markup_parser()
        print()
        test_sentence_splitter()
        print()
        print("=" * 50)
        print("✓ 所有测试通过！")
        print("=" * 50)
    except AssertionError as e:
        print()
        print("=" * 50)
        print(f"✗ 测试失败：{e}")
        print("=" * 50)
        sys.exit(1)
    except Exception as e:
        print()
        print("=" * 50)
        print(f"✗ 测试出错：{e}")
        print("=" * 50)
        import traceback
        traceback.print_exc()
        sys.exit(1)
