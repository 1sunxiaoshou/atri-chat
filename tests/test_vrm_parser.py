"""VRM标记解析器测试"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.markup_parser import VRMMarkupParser
from core.vrm.markup_filter import MarkupFilter


def test_markup_parser():
    """测试标记解析器"""
    print("=" * 60)
    print("测试VRM标记解析器")
    print("=" * 60)
    
    parser = VRMMarkupParser()
    
    # 测试用例1：简单问候
    print("\n【测试1】简单问候")
    text1 = "[State:开心][Action:打招呼]你好！"
    clean_text1, markups1 = parser.parse(text1)
    print(f"原始文本: {text1}")
    print(f"纯文本: {clean_text1}")
    print(f"标记数量: {len(markups1)}")
    for markup in markups1:
        print(f"  - {markup.type}: {markup.value} @ position {markup.position}")
    
    # 测试用例2：情绪转折
    print("\n【测试2】情绪转折")
    text2 = "[State:好奇][Action:挠头]嗯...让我想想，[State:难过]这个功能好像还没做完。"
    clean_text2, markups2 = parser.parse(text2)
    print(f"原始文本: {text2}")
    print(f"纯文本: {clean_text2}")
    print(f"标记数量: {len(markups2)}")
    for markup in markups2:
        print(f"  - {markup.type}: {markup.value} @ position {markup.position}")
    
    # 测试用例3：多个动作
    print("\n【测试3】多个动作")
    text3 = "[State:开心][Action:兴奋]太棒了！[Action:和平手势]我终于完成了这个项目！"
    clean_text3, markups3 = parser.parse(text3)
    print(f"原始文本: {text3}")
    print(f"纯文本: {clean_text3}")
    print(f"标记数量: {len(markups3)}")
    for markup in markups3:
        print(f"  - {markup.type}: {markup.value} @ position {markup.position}")
    
    print("\n" + "=" * 60)


def test_markup_filter():
    """测试标记过滤器"""
    print("\n测试VRM标记过滤器")
    print("=" * 60)
    
    # 测试用例
    test_cases = [
        "[State:开心][Action:打招呼]你好！",
        "[State:好奇]今天想学点什么？",
        "没有标记的普通文本",
        "[State:开心]你好！[State:好奇]今天怎么样？"
    ]
    
    for i, text in enumerate(test_cases, 1):
        print(f"\n【测试{i}】")
        print(f"原始文本: {text}")
        print(f"是否包含标记: {MarkupFilter.has_markup(text)}")
        print(f"移除标记后: {MarkupFilter.remove_markup(text)}")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    test_markup_parser()
    test_markup_filter()
    print("\n✓ 所有测试完成！")
