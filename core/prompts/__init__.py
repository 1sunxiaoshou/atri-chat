"""提示词管理模块

统一管理项目中的所有提示词，包括：
- 角色身份与元意识设定
- VRM 3D演出协议
- 常规文本渲染协议
- 安全准则
"""

from .prompt_manager import PromptManager

__all__ = [
    "PromptManager",
]