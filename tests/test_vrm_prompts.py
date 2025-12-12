"""VRM提示词生成测试"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vrm.prompts import generate_vrm_instruction, DEFAULT_EXPRESSIONS


def test_generate_instruction():
    """测试动态生成VRM指令"""
    print("=" * 60)
    print("测试VRM提示词动态生成")
    print("=" * 60)
    
    # 测试用例1：使用自定义动作列表
    print("\n【测试1】自定义动作列表")
    actions1 = ["打招呼", "挠头", "兴奋", "和平手势"]
    instruction1 = generate_vrm_instruction(DEFAULT_EXPRESSIONS, actions1)
    print(f"表情数量: {len(DEFAULT_EXPRESSIONS)}")
    print(f"动作数量: {len(actions1)}")
    print(f"指令长度: {len(instruction1)} 字符")
    print("\n生成的指令片段:")
    print(instruction1[:300] + "...")
    
    # 测试用例2：空动作列表（使用默认）
    print("\n【测试2】空动作列表（使用默认）")
    actions2 = []
    instruction2 = generate_vrm_instruction(DEFAULT_EXPRESSIONS, actions2)
    print(f"指令长度: {len(instruction2)} 字符")
    assert "打招呼" in instruction2, "应该包含默认动作"
    print("✓ 使用了默认动作列表")
    
    # 测试用例3：大量动作
    print("\n【测试3】大量动作")
    actions3 = [
        "打招呼", "挠头", "弹手指", "羞愧", "兴奋", 
        "问候", "和平手势", "叉腰", "土下座", "喝水",
        "摔倒", "展示全身", "深蹲", "射击", "旋转"
    ]
    instruction3 = generate_vrm_instruction(DEFAULT_EXPRESSIONS, actions3)
    print(f"动作数量: {len(actions3)}")
    print(f"指令长度: {len(instruction3)} 字符")
    
    # 验证所有动作都在指令中
    for action in actions3:
        assert action in instruction3, f"动作 {action} 应该在指令中"
    print("✓ 所有动作都已包含")
    
    # 测试用例4：自定义表情列表
    print("\n【测试4】自定义表情列表")
    expressions4 = ["开心", "难过", "生气"]
    actions4 = ["打招呼", "挠头"]
    instruction4 = generate_vrm_instruction(expressions4, actions4)
    print(f"表情数量: {len(expressions4)}")
    print(f"动作数量: {len(actions4)}")
    
    # 验证表情和动作
    for expr in expressions4:
        assert expr in instruction4, f"表情 {expr} 应该在指令中"
    for action in actions4:
        assert action in instruction4, f"动作 {action} 应该在指令中"
    print("✓ 自定义表情和动作都已包含")
    
    print("\n" + "=" * 60)
    print("✓ 所有测试通过！")


def test_instruction_structure():
    """测试指令结构完整性"""
    print("\n测试指令结构")
    print("=" * 60)
    
    actions = ["打招呼", "挠头", "兴奋"]
    instruction = generate_vrm_instruction(DEFAULT_EXPRESSIONS, actions)
    
    # 检查必要的章节
    required_sections = [
        "## VRM虚拟角色标记规则",
        "### 标记语法",
        "### 可用资源",
        "### 编排规则",
        "### 示例"
    ]
    
    for section in required_sections:
        assert section in instruction, f"缺少章节: {section}"
        print(f"✓ 包含章节: {section}")
    
    # 检查关键内容
    assert "[State:" in instruction, "应该包含State标签示例"
    assert "[Action:" in instruction, "应该包含Action标签示例"
    print("✓ 包含标签示例")
    
    print("=" * 60)


if __name__ == "__main__":
    test_generate_instruction()
    test_instruction_structure()
    print("\n✓ 所有测试完成！")
