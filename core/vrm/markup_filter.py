"""VRM标记过滤器"""
import re


class MarkupFilter:
    """标记过滤器
    
    用于移除文本中的VRM标记，生成纯文本用于TTS合成
    """
    
    # 标记正则表达式
    MARKUP_PATTERN = re.compile(r'\[(State|Action):[^\]]+\]')
    
    @staticmethod
    def remove_markup(text: str) -> str:
        """移除所有标记，返回纯文本
        
        Args:
            text: 带标记的文本
            
        Returns:
            纯文本
            
        Example:
            >>> MarkupFilter.remove_markup("[State:开心][Action:打招呼]你好！")
            '你好！'
        """
        return MarkupFilter.MARKUP_PATTERN.sub('', text)
    
    @staticmethod
    def has_markup(text: str) -> bool:
        """检查文本是否包含标记
        
        Args:
            text: 文本
            
        Returns:
            是否包含标记
        """
        return bool(MarkupFilter.MARKUP_PATTERN.search(text))
