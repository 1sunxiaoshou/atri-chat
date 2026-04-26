"""稳定系统提示词服务。"""

from __future__ import annotations

from pathlib import Path
import sys

from sqlalchemy.orm import Session

from core.logger import get_logger
from core.repositories import CharacterRepository

logger = get_logger(__name__)

DEFAULT_EXPRESSIONS = ["neutral", "happy", "angry", "sad", "relaxed"]
DEFAULT_ACTIONS = ["neutral"]


class PromptTemplateLoader:
    """按路径加载并缓存 Markdown 提示词模板。"""

    def __init__(self):
        self._cache: dict[str, str] = {}
        if getattr(sys, "frozen", False):
            self._templates_dir = Path(sys._MEIPASS) / "core" / "prompts" / "templates"
        else:
            self._templates_dir = Path(__file__).parent / "templates"

    def load(self, template_path: str) -> str:
        cache_key = f"template:{template_path}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        full_path = self._templates_dir / template_path
        if not full_path.exists():
            logger.error(f"模板文件不存在: {full_path}")
            return ""

        content = full_path.read_text(encoding="utf-8")
        self._cache[cache_key] = content
        return content


class PromptService:
    """根据角色和模式生成稳定的 system prompt。"""

    def __init__(self):
        self._templates = PromptTemplateLoader()

    def build_system_prompt(
        self,
        *,
        character_id: str,
        mode: str,
        db_session: Session | None,
    ) -> str:
        if not db_session:
            raise ValueError("db_session 是必需参数")

        character_repo = CharacterRepository(db_session)
        character = character_repo.get(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")

        logger.debug(f"构建稳定提示词: ID={character_id}, mode={mode}")

        role_prompt = self._build_role_prompt(
            template=self._templates.load("identity.md"),
            character_name=character.name,
            character_profile=character.system_prompt,
        )

        if mode == "vrm":
            mode_prompt = self._build_vrm_mode_prompt(
                template=self._templates.load("vrm.md"),
                character_id=character_id,
                character_repo=character_repo,
            )
        else:
            mode_prompt = self._build_text_mode_prompt(
                template=self._templates.load("normal.md"),
            )

        return "\n\n---\n\n".join([role_prompt, mode_prompt])

    @staticmethod
    def _build_role_prompt(*, template: str, character_name: str, character_profile: str) -> str:
        return template.format(
            character_name=character_name,
            character_profile=character_profile or "你是一个友好的虚拟伴侣。",
        )

    @staticmethod
    def _build_text_mode_prompt(*, template: str) -> str:
        return template

    def _build_vrm_mode_prompt(
        self,
        *,
        template: str,
        character_id: str,
        character_repo: CharacterRepository,
    ) -> str:
        expressions_list = character_repo.get_avatar_expressions(character_id) or DEFAULT_EXPRESSIONS
        expressions_str = ", ".join(expressions_list)

        actions_str, action_ids = self._get_character_action_catalog(character_id, character_repo)
        sample_emotion = expressions_list[0] if expressions_list else "neutral"
        sample_motion = action_ids[0] if action_ids else "neutral"

        return template.format(
            expressions=expressions_str,
            actions=actions_str,
            sample_emotion=sample_emotion,
            sample_motion=sample_motion,
        )

    @staticmethod
    def _get_character_action_catalog(
        character_id: str,
        character_repo: CharacterRepository,
    ) -> tuple[str, list[str]]:
        """获取角色动作目录，供 VRM 模式提示词使用。"""

        try:
            motions = character_repo.get_character_motions(character_id, category="reply")
            if not motions:
                fallback = "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)
                return fallback, []

            action_lines: list[str] = []
            action_ids: list[str] = []
            for motion in motions:
                motion_id = motion.id
                action_ids.append(motion_id)

                name = motion.name
                description = motion.description or "无描述"
                action_lines.append(f"ID: `{motion_id}` (动作含义: {name}, {description})")

            return "\n  - " + "\n  - ".join(action_lines), action_ids
        except Exception as exc:
            logger.error(f"获取角色动作失败: {exc}")
            fallback = "\n  - " + "\n  - ".join(DEFAULT_ACTIONS)
            return fallback, []
