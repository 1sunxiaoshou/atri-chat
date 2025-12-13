"""提示词管理模块

统一管理项目中的所有提示词，包括：
- 角色扮演提示词
- VRM驱动提示词  
- 输出规范提示词
- 其他系统提示词
"""

from .prompt_manager import PromptManager
from .templates import (
    VRM_RENDER_PROMPT,
    ROLE_PLAY_BASE,
    SAFETY_GUIDELINES,
    DEFAULT_EXPRESSIONS,
    DEFAULT_ACTIONS
)

__all__ = [
    "PromptManager",
    "VRM_RENDER_PROMPT",
    "ROLE_PLAY_BASE",
    "SAFETY_GUIDELINES",
    "DEFAULT_EXPRESSIONS",
    "DEFAULT_ACTIONS"
]