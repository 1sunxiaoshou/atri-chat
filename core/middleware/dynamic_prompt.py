"""动态提示词生成中间件。"""

from langchain.agents.middleware import ModelRequest, dynamic_prompt

from ..logger import get_logger

logger = get_logger(__name__)


@dynamic_prompt
def build_character_prompt(request: ModelRequest) -> str:
    """动态构建分层后的角色提示词。"""
    context = request.runtime.context

    prompt = context.prompt_manager.build_system_prompt(
        character_id=context.character_id,
        mode="vrm" if context.enable_vrm else "text",
        db_session=context.db_session,
    )

    return prompt
