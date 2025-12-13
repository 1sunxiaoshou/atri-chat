"""提示词管理器

负责提示词的组装、缓存和动态生成
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

from .templates import (
    VRM_RENDER_PROMPT,
    ROLE_PLAY_BASE,
    SAFETY_GUIDELINES,
    DEFAULT_EXPRESSIONS,
    DEFAULT_ACTIONS
)
logger = logging.getLogger(__name__)


class PromptManager:
    """提示词管理器
    
    统一管理和组装各种类型的提示词
    """
    
    def __init__(self, app_storage=None):
        """初始化提示词管理器
        
        Args:
            app_storage: 应用存储实例，用于获取角色和VRM数据
        """
        self.app_storage = app_storage
        self._cache = {}
        
        logger.info("提示词管理器初始化完成")
    
    def build_character_prompt(
        self, 
        character_id: int,
        include_vrm: bool = False,
        include_safety: bool = True,
        additional_instructions: Optional[List[str]] = None
    ) -> str:
        """构建角色提示词
        
        Args:
            character_id: 角色ID
            include_vrm: 是否包含VRM指令
            include_safety: 是否包含安全准则
            additional_instructions: 额外的指令列表
            
        Returns:
            完整的角色提示词
        """
        if not self.app_storage:
            raise ValueError("需要 app_storage 实例来获取角色数据")
        
        # 获取角色数据
        character = self.app_storage.get_character(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
        
        logger.debug(
            "开始构建角色提示词",
            extra={
                "character_id": character_id,
                "character_name": character.get("name", "未知"),
                "include_vrm": include_vrm,
                "include_safety": include_safety
            }
        )
        
        # 构建提示词组件
        prompt_parts = []
        
        # 1. 使用ROLE_PLAY_BASE模板作为基础框架
        base_prompt = ROLE_PLAY_BASE.template.format(
            character_name=character.get("name", "AI助手"),
            system_prompt=character.get("system_prompt", "我是一个友好的AI助手。")
        )
        prompt_parts.append(base_prompt)
        
        # 2. VRM输出要求（如果启用）
        if include_vrm:
            vrm_prompt = self._build_vrm_prompt(character)
            if vrm_prompt:
                prompt_parts.append(vrm_prompt)
                logger.debug("已添加VRM输出要求")
        
        # 3. 安全准则（可选）
        if include_safety:
            safety_prompt = SAFETY_GUIDELINES.template
            prompt_parts.append(safety_prompt)
            logger.debug("已添加安全准则")
        
        # 4. 额外指令
        if additional_instructions:
            prompt_parts.extend(additional_instructions)
            logger.debug(f"已添加 {len(additional_instructions)} 条额外指令")
        
        # 组装最终提示词
        final_prompt = "\n\n".join(filter(None, prompt_parts))
        
        logger.info(
            "角色提示词构建完成",
            extra={
                "character_id": character_id,
                "character_name": character.get("name", "未知"),
                "include_vrm": include_vrm,
                "include_safety": include_safety,
                "prompt_length": len(final_prompt),
                "components_count": len(prompt_parts)
            }
        )
        
        return final_prompt
    
    def get_vrm_template(self) -> str:
        """获取VRM渲染模板
        
        Returns:
            VRM渲染模板内容
        """
        return VRM_RENDER_PROMPT.template
    
    def get_role_play_template(self) -> str:
        """获取角色扮演模板
        
        Returns:
            角色扮演模板内容
        """
        return ROLE_PLAY_BASE.template
    
    def get_safety_template(self) -> str:
        """获取安全准则模板
        
        Returns:
            安全准则模板内容
        """
        return SAFETY_GUIDELINES.template
    
    def clear_cache(self):
        """清空缓存"""
        self._cache.clear()
        logger.debug("提示词缓存已清空")
    
    # ==================== 私有方法 ====================
    

    
    def _build_vrm_prompt(self, character: Dict[str, Any]) -> Optional[str]:
        """构建VRM提示词"""
        vrm_model_id = character.get("vrm_model_id")
        if not vrm_model_id:
            # 即使没有VRM模型，也可以使用默认的表情和动作
            logger.debug("未找到VRM模型，使用默认表情和动作")
        
        # 获取动作列表
        actions = self._get_character_actions(character)
        
        # 使用新的VRM_RENDER_PROMPT模板
        vrm_prompt = VRM_RENDER_PROMPT.template.format(
            expressions="、".join(DEFAULT_EXPRESSIONS),
            actions="、".join(actions)
        )
        
        logger.debug(
            "VRM提示词构建完成",
            extra={
                "expressions_count": len(DEFAULT_EXPRESSIONS),
                "actions_count": len(actions),
                "prompt_length": len(vrm_prompt)
            }
        )
        
        return vrm_prompt
    
    def _get_character_actions(self, character: Dict[str, Any]) -> List[str]:
        """获取角色可用动作列表"""
        from ..vrm import VRMService
        
        vrm_model_id = character.get("vrm_model_id")
        if not vrm_model_id or not self.app_storage:
            return DEFAULT_ACTIONS
        
        # 使用VRM服务获取动作列表
        vrm_service = VRMService(self.app_storage, None)  # 这里不需要TTS工厂
        return vrm_service.get_available_actions(vrm_model_id)