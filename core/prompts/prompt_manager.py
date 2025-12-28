"""提示词管理器

负责提示词的组装、缓存和动态生成
"""

from typing import Dict, List, Optional, Any
import logging

# 导入新的模板
from .templates import (
    META_IDENTITY_BASE,
    NORMAL_RENDER_PROTOCOL,
    VRM_RENDER_PROTOCOL,
    SAFETY_GUIDELINES,
    PromptTemplate
)

logger = logging.getLogger(__name__)

# 默认资源定义（防止数据库为空）
DEFAULT_EXPRESSIONS = ["neutral", "happy", "angry", "sad", "relaxed"]
DEFAULT_ACTIONS = ["neutral"]

class PromptManager:
    """提示词管理器"""
    
    def __init__(self, app_storage=None):
        self.app_storage = app_storage
        self._cache = {}
        logger.info("提示词管理器初始化完成")
    
    def build_character_prompt(
        self, 
        character_id: int,
        include_vrm: bool = False,
        include_safety: bool = False,
        additional_instructions: Optional[List[str]] = None
    ) -> str:
        """构建角色提示词
        
        Args:
            character_id: 角色ID
            include_vrm: True=使用VRM渲染协议, False=使用常规文本协议
            include_safety: 是否包含安全准则
            additional_instructions: 额外的指令列表
        """
        if not self.app_storage:
            raise ValueError("需要 app_storage 实例")
        
        # 1. 获取数据
        character = self.app_storage.get_character(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
            
        logger.debug(f"构建提示词: ID={character_id}, VRM模式={include_vrm}")
        
        prompt_parts = []
        
        # -----------------------------------------------------
        # 组件 1: 核心身份与元意识 (Meta Identity) - 始终存在
        # -----------------------------------------------------
        # 优先使用 database 中的 'prompt' 或 'profile' 字段
        profile_text = character.get("system_prompt") or character.get("description") or "你是一个友好的虚拟伴侣。"
        
        identity_prompt = META_IDENTITY_BASE.template.format(
            character_name=character.get("name", "AI"),
            character_profile=profile_text
        )
        prompt_parts.append(identity_prompt)
        
        # -----------------------------------------------------
        # 组件 2: 渲染协议 (Render Protocol) - 根据模式切换
        # -----------------------------------------------------
        if include_vrm:
            # === VRM 模式 ===
            vrm_prompt = self._build_vrm_protocol(character)
            prompt_parts.append(vrm_prompt)
        else:
            # === 常规模式 ===
            # 直接加载文本渲染协议，无需动态参数
            prompt_parts.append(NORMAL_RENDER_PROTOCOL.template)
            
        # -----------------------------------------------------
        # 组件 3: 安全与额外指令
        # -----------------------------------------------------
        if include_safety:
            prompt_parts.append(SAFETY_GUIDELINES.template)
            
        if additional_instructions:
            prompt_parts.extend(additional_instructions)
            
        # -----------------------------------------------------
        # 最终组装
        # -----------------------------------------------------
        final_prompt = "\n\n---\n\n".join(prompt_parts)
        
        return final_prompt

    def _build_vrm_protocol(self, character: Dict[str, Any]) -> str:
        """构建 VRM 渲染部分的提示词"""
        vrm_model_id = character.get("vrm_model_id")
        
        # 1. 获取表情列表 (字符串形式)
        expressions_list = self._get_model_expressions(vrm_model_id)
        expressions_str = ", ".join(expressions_list)
        
        # 2. 获取动作列表 (带详细描述的字符串形式)
        actions_str = self._get_character_actions_detailed(character)
        
        # 3. 填充模板
        return VRM_RENDER_PROTOCOL.template.format(
            expressions=expressions_str,
            actions=actions_str
        )

    # ... 以下保持原有的私有方法 (_get_character_actions_detailed 等) ...
    # 只需要确保引用正确即可，逻辑无需大改
    
    def _get_character_actions_detailed(self, character: Dict[str, Any]) -> str:
        """(保持原有的逻辑不变，用于获取详细动作列表)"""
        # 这里直接复用你之前的代码逻辑
        vrm_model_id = character.get("vrm_model_id")
        if not vrm_model_id or not self.app_storage:
             return "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)
        
        try:
            animations = self.app_storage.get_model_animations(vrm_model_id)
            if not animations:
                return "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)
            
            action_lines = []
            for anim in animations:
                name = anim.get("name", "unknown")
                description = anim.get("description", "")
                duration = anim.get("duration", 0.0)
                
                # 优化格式: name (时长): 描述
                info = f"{name} ({duration:.1f}s)"
                if description:
                    info += f": {description}"
                action_lines.append(info)
                
            return "\n  - " + "\n  - ".join(action_lines)
        except Exception:
            return "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)

    def _get_model_expressions(self, vrm_model_id: str) -> List[str]:
        """(保持原有的逻辑不变)"""
        # 复用你之前的代码逻辑
        if not self.app_storage or not vrm_model_id:
            return DEFAULT_EXPRESSIONS
        
        try:
            model = self.app_storage.get_vrm_model(vrm_model_id)
            import json
            if model and model.get("available_expressions"):
                return json.loads(model.get("available_expressions"))
            return DEFAULT_EXPRESSIONS
        except Exception:
            return DEFAULT_EXPRESSIONS