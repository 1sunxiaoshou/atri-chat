"""VRM标记解析器"""
import re
from typing import List, Tuple
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
    
    # 表情映射（中文 -> 英文）
    STATE_MAPPING = {
        "开心": "happy",
        "难过": "sad",
        "生气": "angry",
        "惊讶": "surprised",
        "中性": "neutral",
        "好奇": "curious"
    }
    
    # 动作映射（中文 -> 英文）
    ACTION_MAPPING = {
        "打招呼": "wave",
        "挠头": "scratch_head",
        "弹手指": "snap_fingers",
        "羞愧": "shy",
        "兴奋": "excited",
        "问候": "greet",
        "和平手势": "peace_sign",
        "叉腰": "hands_on_hips",
        "土下座": "dogeza",
        "喝水": "drink",
        "摔倒": "fall",
        "展示全身": "show_body",
        "深蹲": "squat",
        "射击": "shoot",
        "旋转": "spin",
        "模特姿势": "model_pose",
        "伸展": "stretch",
        "运动姿势": "exercise",
        "玩手机": "play_phone"
    }
    
    def parse(self, marked_text: str) -> Tuple[str, List[VRMMarkup]]:
        """解析带标记的文本
        
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
        clean_text = marked_text
        offset = 0  # 用于跟踪移除标记后的位置偏移
        
        # 查找所有标记
        for match in self.MARKUP_PATTERN.finditer(marked_text):
            markup_type = match.group(1).lower()  # "state" 或 "action"
            markup_value_cn = match.group(2)  # 中文名
            original_position = match.start()  # 在原始文本中的位置
            
            # 映射中文名到英文ID
            if markup_type == "state":
                markup_value_en = self.STATE_MAPPING.get(markup_value_cn, markup_value_cn)
            elif markup_type == "action":
                markup_value_en = self.ACTION_MAPPING.get(markup_value_cn, markup_value_cn)
            else:
                logger.warning(f"未知标记类型: {markup_type}", extra={"markup": match.group(0)})
                continue
            
            # 计算在纯文本中的位置（考虑之前移除的标记）
            position_in_clean_text = original_position - offset
            
            markups.append(VRMMarkup(
                type=markup_type,
                value=markup_value_en,
                position=position_in_clean_text,
                original_position=original_position
            ))
            
            # 更新偏移量（标记长度）
            offset += len(match.group(0))
        
        # 移除所有标记，得到纯文本
        clean_text = self.MARKUP_PATTERN.sub('', marked_text)
        
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
