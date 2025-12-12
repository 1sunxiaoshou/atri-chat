"""VRM标记解析器"""
import re
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from ..logger import get_logger

logger = get_logger(__name__, category="VRM")


@dataclass
class VRMMarkup:
    """VRM标记"""
    type: str  # "action" 或 "state"
    value: str  # 动作名或表情名（英文ID）
    position: int  # 在纯文本中的位置
    original_position: int  # 在原始文本中的位置


class VRMMarkupParser:
    """VRM标记解析器
    
    解析嵌入式标记，将中文名映射到英文ID，计算标记在纯文本中的位置
    """
    
    # 标记正则表达式
    MARKUP_PATTERN = re.compile(r'\[(State|Action):([^\]]+)\]')
    
    # 表情映射（中文 -> 英文）- VRM规范定义的标准表情
    STATE_MAPPING = {
        "开心": "happy",
        "难过": "sad",
        "生气": "angry",
        "惊讶": "surprised",
        "中性": "neutral",
        "好奇": "curious"
    }
    
    def __init__(self, action_mapping: Optional[Dict[str, str]] = None):
        """初始化解析器
        
        Args:
            action_mapping: 动作映射字典（中文名 -> 英文ID），如果不提供则使用空映射
        """
        # 动作映射从外部传入（从数据库动态获取）
        self.action_mapping = action_mapping or {}
        
        logger.debug(
            f"VRM标记解析器初始化",
            extra={"action_count": len(self.action_mapping)}
        )
    
    def parse(self, marked_text: str) -> Tuple[str, List[VRMMarkup]]:
        """解析带标记的文本
        
        使用正向扫描，精确计算标记在纯文本中的位置
        
        Args:
            marked_text: 带标记的文本，如 "[State:开心][Action:打招呼]你好！"
            
        Returns:
            (纯文本, 标记列表)
            
        Example:
            >>> parser = VRMMarkupParser()
            >>> text, markups = parser.parse("[State:开心][Action:打招呼]你好！")
            >>> text
            '你好！'
            >>> markups
            [VRMMarkup(type='state', value='happy', position=0, original_position=0),
             VRMMarkup(type='action', value='wave', position=0, original_position=14)]
        """
        markups = []
        clean_chars = []
        i = 0
        
        while i < len(marked_text):
            char = marked_text[i]
            
            # 检测标记开始
            if char == '[':
                # 尝试匹配标记
                match = self.MARKUP_PATTERN.match(marked_text, i)
                if match:
                    markup_type = match.group(1).lower()  # "state" 或 "action"
                    markup_value_cn = match.group(2)  # 中文名
                    original_position = i
                    
                    # 映射中文名到英文ID
                    if markup_type == "state":
                        markup_value_en = self.STATE_MAPPING.get(markup_value_cn, markup_value_cn)
                    elif markup_type == "action":
                        markup_value_en = self.action_mapping.get(markup_value_cn, markup_value_cn)
                        if markup_value_cn not in self.action_mapping:
                            logger.warning(
                                f"未知动作标记: {markup_value_cn}",
                                extra={"markup": match.group(0), "available_actions": list(self.action_mapping.keys())}
                            )
                    else:
                        logger.warning(f"未知标记类型: {markup_type}", extra={"markup": match.group(0)})
                        i = match.end()
                        continue
                    
                    # 标记在纯文本中的位置 = 当前纯文本长度
                    position_in_clean_text = len(clean_chars)
                    
                    markups.append(VRMMarkup(
                        type=markup_type,
                        value=markup_value_en,
                        position=position_in_clean_text,
                        original_position=original_position
                    ))
                    
                    # 跳过整个标记
                    i = match.end()
                else:
                    # 不是有效标记，当作普通字符
                    clean_chars.append(char)
                    i += 1
            else:
                # 普通字符
                clean_chars.append(char)
                i += 1
        
        clean_text = ''.join(clean_chars)
        
        logger.debug(
            f"解析标记完成",
            extra={
                "original_length": len(marked_text),
                "clean_length": len(clean_text),
                "markup_count": len(markups)
            }
        )
        
        return clean_text, markups
    
    @staticmethod
    def has_markup(text: str) -> bool:
        """检查文本是否包含标记"""
        return bool(VRMMarkupParser.MARKUP_PATTERN.search(text))
