"""提示词管理器

负责提示词的组装、缓存和动态生成

架构改进：
- 完全移除对 AppStorage 的依赖 ✅
- 使用 CharacterRepository 获取角色信息和 VRM 资源
"""

from typing import Dict, List, Optional, Any
import logging
from sqlalchemy.orm import Session

from ..repositories import CharacterRepository

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
    
    def __init__(self):
        """初始化提示词管理器"""
        self._cache = {}
    
    def build_character_prompt(
        self, 
        character_id: str,
        include_vrm: bool = False,
        include_safety: bool = False,
        additional_instructions: Optional[List[str]] = None,
        db_session: Session = None
    ) -> str:
        """构建角色提示词
        
        Args:
            character_id: 角色ID (UUID)
            include_vrm: True=使用VRM渲染协议, False=使用常规文本协议
            include_safety: 是否包含安全准则
            additional_instructions: 额外的指令列表
            db_session: 数据库会话（必需）
        """
        if not db_session:
            raise ValueError("db_session 是必需参数")
        
        # 使用 Repository 获取角色信息
        character_repo = CharacterRepository(db_session)
        character = character_repo.get(character_id)
        
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
            
        logger.debug(f"构建提示词: ID={character_id}, VRM模式={include_vrm}")
        
        prompt_parts = []
        
        # -----------------------------------------------------
        # 组件 1: 核心身份与元意识 (Meta Identity) - 始终存在
        # -----------------------------------------------------
        profile_text = character.system_prompt or "你是一个友好的虚拟伴侣。"
        
        identity_prompt = META_IDENTITY_BASE.template.format(
            character_name=character.name,
            character_profile=profile_text
        )
        prompt_parts.append(identity_prompt)
        
        # -----------------------------------------------------
        # 组件 2: 渲染协议 (Render Protocol) - 根据模式切换
        # -----------------------------------------------------
        if include_vrm:
            # === VRM 模式 ===
            vrm_prompt = self._build_vrm_protocol(character_id, character_repo)
            prompt_parts.append(vrm_prompt)
        else:
            # === 常规模式 ===
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

    def _build_vrm_protocol(self, character_id: str, character_repo: CharacterRepository) -> str:
        """构建 VRM 渲染部分的提示词
        
        Args:
            character_id: 角色 ID
            character_repo: 角色仓储实例
        """
        # 1. 获取表情列表
        expressions_list = character_repo.get_avatar_expressions(character_id)
        expressions_str = ", ".join(expressions_list)
        
        # 2. 获取动作列表（带详细描述）
        actions_str = self._get_character_actions_detailed(character_id, character_repo)
        
        # 3. 填充模板
        return VRM_RENDER_PROTOCOL.template.format(
            expressions=expressions_str,
            actions=actions_str
        )

    def _get_character_actions_detailed(
        self, 
        character_id: str, 
        character_repo: CharacterRepository
    ) -> str:
        """获取角色动作的详细列表（格式化为字符串）
        
        Args:
            character_id: 角色 ID
            character_repo: 角色仓储实例
            
        Returns:
            格式化的动作列表字符串
        """
        try:
            motions = character_repo.get_character_motions(character_id)
            
            if not motions:
                return "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)
            
            action_lines = []
            for motion in motions:
                name = motion.name
                description = motion.description or ""
                duration_sec = motion.duration_ms / 1000.0
                
                # 格式: name (时长): 描述
                info = f"{name} ({duration_sec:.1f}s)"
                if description:
                    info += f": {description}"
                action_lines.append(info)
                
            return "\n  - " + "\n  - ".join(action_lines)
        except Exception as e:
            logger.error(f"获取角色动作失败: {e}", exc_info=True)
            return "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)