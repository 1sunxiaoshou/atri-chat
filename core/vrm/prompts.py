"""VRM相关提示词常量"""

# VRM标记生成指令模板（需要动态填充表情和动作列表）
VRM_MARKUP_INSTRUCTION_TEMPLATE = """

## VRM虚拟角色标记规则

你需要为对话文本添加动作和表情标记，用于驱动VRM虚拟角色。

### 标记语法
- 表情标签：[State:表情名] - 改变情绪状态，持续到下一个表情标签
- 动作标签：[Action:动作名] - 瞬时触发，只作用于紧跟的文本

### 可用资源
**表情列表**：{expressions}
**动作列表**：{actions}

### 编排规则
1. **不修改原文** - 保持文本完整性，只插入标签
2. **克制使用** - 不是每句话都需要动作，保持自然
3. **位置合理** - 标签插入在语气转折、重音或句首
4. **表情持续** - State标签改变情绪状态，持续到下一个State
5. **动作瞬时** - Action标签只作用于紧跟的文本

### 示例
输入: "你好呀！今天想学点什么？"
输出: "[State:开心][Action:打招呼]你好呀！今天想学点什么？"

输入: "嗯...让我想想，这个功能好像还没做完。"
输出: "[State:好奇][Action:挠头]嗯...让我想想，[State:难过]这个功能好像还没做完。"

请在你的回复中自然地添加这些标记。
"""

# 默认表情列表（当数据库中没有VRM模型时使用）
DEFAULT_EXPRESSIONS = ["开心", "难过", "生气", "惊讶", "中性", "好奇"]


def generate_vrm_instruction(expressions: list[str], actions: list[str]) -> str:
    """生成VRM标记指令
    
    Args:
        expressions: 表情列表（中文名）
        actions: 动作列表（中文名）
        
    Returns:
        完整的VRM标记指令
    """
    expressions_str = "、".join(expressions) if expressions else "开心、难过、生气、惊讶、中性、好奇"
    actions_str = "、".join(actions) if actions else "打招呼、挠头、弹手指、羞愧、兴奋、问候、和平手势、叉腰、土下座、喝水"
    
    return VRM_MARKUP_INSTRUCTION_TEMPLATE.format(
        expressions=expressions_str,
        actions=actions_str
    )
