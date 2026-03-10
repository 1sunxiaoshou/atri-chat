"""提示词管理器

负责提示词的组装、缓存和动态生成

架构改进：
- 使用 CharacterRepository 获取角色信息和 VRM 资源
- 从 Markdown 文件加载模板（易于编辑和维护）
"""

from typing import Dict, List, Optional, Any
from pathlib import Path
import sys
import logging
from sqlalchemy.orm import Session

from ..repositories import CharacterRepository

logger = logging.getLogger(__name__)

# 默认资源定义（防止数据库为空）
DEFAULT_EXPRESSIONS = ["neutral", "happy", "angry", "sad", "relaxed"]
DEFAULT_ACTIONS = ["neutral"]


class PromptManager:
    """提示词管理器"""
    
    def __init__(self):
        """初始化提示词管理器"""
        self._cache = {}
        # 打包后从 PyInstaller 临时目录读取模板
        if getattr(sys, 'frozen', False):
            self._templates_dir = Path(sys._MEIPASS) / "core" / "prompts" / "templates"
        else:
            self._templates_dir = Path(__file__).parent / "templates"
    
    def _load_template(self, template_path: str) -> str:
        """从文件加载模板
        
        Args:
            template_path: 相对于 templates/ 的路径，如 "base/identity.md"
        
        Returns:
            模板内容
        """
        cache_key = f"template:{template_path}"
        
        # 检查缓存
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # 加载文件
        full_path = self._templates_dir / template_path
        if not full_path.exists():
            logger.error(f"模板文件不存在: {full_path}")
            return ""
        
        content = full_path.read_text(encoding="utf-8")
        
        # 缓存
        self._cache[cache_key] = content
        
        return content
    
    def build_character_prompt(
        self, 
        character_id: str,
        include_vrm: bool = False,
        include_safety: bool = False,
        include_memory: bool = True,
        additional_instructions: Optional[List[str]] = None,
        db_session: Session = None
    ) -> str:
        """构建角色提示词
        
        Args:
            character_id: 角色ID (UUID)
            include_vrm: True=使用VRM渲染协议, False=使用常规文本协议
            include_safety: 是否包含安全准则
            include_memory: 是否包含记忆系统说明（默认 True）
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
        
        identity_template = self._load_template("base/identity.md")
        identity_prompt = identity_template.format(
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
            normal_template = self._load_template("modes/normal.md")
            prompt_parts.append(normal_template)
            
        # -----------------------------------------------------
        # 组件 3: 记忆系统说明
        # -----------------------------------------------------
        if include_memory:
            memory_template = self._load_template("base/memory.md")
            prompt_parts.append(memory_template)
            
        # -----------------------------------------------------
        # 组件 4: 用户画像（自动加载）
        # -----------------------------------------------------
        user_profile = self._load_user_profile(character_id)
        if user_profile:
            prompt_parts.append(user_profile)
            
        # -----------------------------------------------------
        # 组件 5: 安全与额外指令
        # -----------------------------------------------------
        if include_safety:
            safety_template = self._load_template("base/safety.md")
            prompt_parts.append(safety_template)
            
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
        
        # 【新增】抽取真实表情ID用于示例（防幻觉）
        exp1 = expressions_list[0] if len(expressions_list) > 0 else "neutral"
        exp2 = expressions_list[1] if len(expressions_list) > 1 else exp1
        
        # 2. 获取动作列表与纯ID列表
        actions_str, action_ids = self._get_character_actions_detailed(character_id, character_repo)
        
        # 【新增】抽取真实动作ID用于示例（防幻觉）
        act1 = action_ids[0] if len(action_ids) > 0 else "ACT_PLACEHOLDER_1"
        act2 = action_ids[1] if len(action_ids) > 1 else act1
        
        # 3. 加载并填充模板
        vrm_template = self._load_template("modes/vrm.md")
        return vrm_template.format(
            expressions=expressions_str,
            actions=actions_str,
            exp1=exp1,
            exp2=exp2,
            act1=act1,
            act2=act2
        )

    def _get_character_actions_detailed(
        self, 
        character_id: str, 
        character_repo: CharacterRepository
    ) -> tuple[str, list[str]]:
        """获取角色动作的详细列表（格式化为字符串）及ID列表
        
        Args:
            character_id: 角色 ID
            character_repo: 角色仓储实例
            
        Returns:
            Tuple[格式化的动作列表字符串, 纯动作ID列表]
        """
        try:
            motions = character_repo.get_character_motions(character_id, category='reply')
            
            if not motions:
                # 兼容旧逻辑
                fallback_str = "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)
                return fallback_str, []
            
            action_lines = []
            action_ids = []
            for motion in motions:
                motion_id = motion.id  # 短链 ID
                action_ids.append(motion_id)  # 保存纯ID供外部提取
                
                name = motion.name
                description = motion.description or "无描述"
                
                # 【关键优化】修改格式，把 ID 突出，并用反引号包裹，把名字和描述塞进括号里当辅助信息
                # AI看了这个格式，就不会错把中文名字当成 ID 输出了
                info = f"ID: `{motion_id}` (动作含义: {name}, {description})"
                action_lines.append(info)
                
            return "\n  - " + "\n  - ".join(action_lines), action_ids
            
        except Exception as e:
            logger.error(f"获取角色动作失败: {e}", exc_info=True)
            return "\n  - " + "\n  - ".join(DEFAULT_ACTIONS), []

    
    def _load_user_profile(self, character_id: str) -> Optional[str]:
        """加载用户画像到上下文
        
        Args:
            character_id: 角色 ID
            
        Returns:
            格式化的用户画像内容，如果为空则返回 None
        """
        try:
            from ..tools.memory_tools_v3 import _resolve_path, _ensure_file_exists
            
            # 读取 user_profile
            profile_path = _resolve_path(character_id, "user_profile")
            _ensure_file_exists(profile_path)
            
            profile_content = profile_path.read_text(encoding="utf-8")
            
            # 检查是否有实际内容（不只是模板）
            if self._has_meaningful_content(profile_content):
                return f"## 用户画像\n\n{profile_content}"
            else:
                # 档案为空或只有模板，不添加
                return None
        
        except Exception as e:
            logger.warning(f"加载用户画像失败: {e}")
            return None
    
    def _has_meaningful_content(self, content: str) -> bool:
        """检查档案是否有实际内容（不只是模板）
        
        如果所有字段都是 "(未知)"，则认为没有实际内容。
        """
        # 简单检查：如果包含 "(未知)" 的行数超过 5 行，认为是空档案
        unknown_count = content.count("(未知)")
        return unknown_count < 5
