"""测试VRM动态动作映射"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.markup_parser import VRMMarkupParser


def test_dynamic_action_mapping():
    """测试动态动作映射"""
    
    # 测试1：使用自定义动作映射
    custom_mapping = {
        "跳舞": "dance",
        "鞠躬": "bow",
        "拍手": "clap"
    }
    
    parser = VRMMarkupParser(action_mapping=custom_mapping)
    
    text = "[Action:跳舞]开始表演！[Action:鞠躬]谢谢大家。"
    clean, markups = parser.parse(text)
    
    assert clean == "开始表演！谢谢大家。", f"期望'开始表演！谢谢大家。'，实际'{clean}'"
    assert len(markups) == 2, f"期望2个标记，实际{len(markups)}个"
    assert markups[0].value == "dance", f"期望'dance'，实际'{markups[0].value}'"
    assert markups[1].value == "bow", f"期望'bow'，实际'{markups[1].value}'"
    print("✓ 测试1通过：自定义动作映射")
    
    # 测试2：未知动作使用原始中文名
    text2 = "[Action:未知动作]测试"
    clean2, markups2 = parser.parse(text2)
    
    assert clean2 == "测试", f"期望'测试'，实际'{clean2}'"
    assert len(markups2) == 1, f"期望1个标记，实际{len(markups2)}个"
    assert markups2[0].value == "未知动作", f"期望'未知动作'（原始值），实际'{markups2[0].value}'"
    print("✓ 测试2通过：未知动作保留原始中文名")
    
    # 测试3：空映射
    parser_empty = VRMMarkupParser(action_mapping={})
    text3 = "[Action:任意动作]测试"
    clean3, markups3 = parser_empty.parse(text3)
    
    assert clean3 == "测试", f"期望'测试'，实际'{clean3}'"
    assert len(markups3) == 1, f"期望1个标记，实际{len(markups3)}个"
    assert markups3[0].value == "任意动作", f"期望'任意动作'，实际'{markups3[0].value}'"
    print("✓ 测试3通过：空映射时保留原始中文名")
    
    # 测试4：表情映射不受影响（固定映射）
    text4 = "[State:开心]你好！"
    clean4, markups4 = parser.parse(text4)
    
    assert clean4 == "你好！", f"期望'你好！'，实际'{clean4}'"
    assert len(markups4) == 1, f"期望1个标记，实际{len(markups4)}个"
    assert markups4[0].type == "state", f"期望'state'，实际'{markups4[0].type}'"
    assert markups4[0].value == "happy", f"期望'happy'，实际'{markups4[0].value}'"
    print("✓ 测试4通过：表情映射使用固定映射")
    
    # 测试5：混合使用表情和自定义动作
    text5 = "[State:开心][Action:跳舞]开始表演！"
    clean5, markups5 = parser.parse(text5)
    
    assert clean5 == "开始表演！", f"期望'开始表演！'，实际'{clean5}'"
    assert len(markups5) == 2, f"期望2个标记，实际{len(markups5)}个"
    assert markups5[0].type == "state" and markups5[0].value == "happy", \
        f"标记1期望state:happy，实际{markups5[0].type}:{markups5[0].value}"
    assert markups5[1].type == "action" and markups5[1].value == "dance", \
        f"标记2期望action:dance，实际{markups5[1].type}:{markups5[1].value}"
    print("✓ 测试5通过：混合使用表情和自定义动作")


if __name__ == "__main__":
    print("=" * 50)
    print("测试VRM动态动作映射")
    print("=" * 50)
    
    try:
        test_dynamic_action_mapping()
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
