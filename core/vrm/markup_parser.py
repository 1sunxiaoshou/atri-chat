"""VRM标记解析器"""
import re
from typing import List, Tuple
from dataclasses import dataclass


@dataclass
class VRMMarkup:
    """VRM标记"""

    type: str  # "action" 或 "state"
    value: str  # 动作名或表情名
    position: int  # 在纯文本中的位置


class VRMMarkupParser:
    """VRM标记解析器

    解析带标记的文本，提取纯文本和标记信息
    """

    # 标记正则表达式：[State:表情名] 或 [Action:动作名]
    MARKUP_PATTERN = re.compile(r"\[(State|Action):([^\]]+)\]")

    def __init__(self):
        """初始化解析器"""
        pass

    def parse(self, text: str) -> Tuple[str, List[VRMMarkup]]:
        """解析带标记的文本

        Args:
            text: 带标记的文本

        Returns:
            (纯文本, 标记列表)

        Example:
            >>> parser = VRMMarkupParser()
            >>> parser.parse("[State:开心]你好！[Action:挥手]")
            ('你好！', [VRMMarkup(type='state', value='开心', position=0),
                       VRMMarkup(type='action', value='挥手', position=3)])
        """
        markups = []
        clean_text = []
        current_position = 0

        # 逐个匹配标记
        last_end = 0
        for match in self.MARKUP_PATTERN.finditer(text):
            # 添加标记前的文本
            before_text = text[last_end : match.start()]
            clean_text.append(before_text)
            current_position += len(before_text)

            # 提取标记信息
            markup_type = match.group(1).lower()  # "State" -> "state"
            markup_value = match.group(2)  # 直接使用原始值

            # 创建标记对象
            markups.append(
                VRMMarkup(type=markup_type, value=markup_value, position=current_position)
            )

            last_end = match.end()

        # 添加最后的文本
        clean_text.append(text[last_end:])

        return "".join(clean_text), markups
