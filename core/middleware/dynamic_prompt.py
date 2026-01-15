"""动态提示词生成中间件"""
from dataclasses import dataclass, field
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from typing import Dict, Any
from ..logger import get_logger

logger = get_logger(__name__, category="MIDDLEWARE")


@dataclass
class AgentContext:
    """Agent 运行时上下文"""
    character_id: int
    enable_vrm: bool = False
    model_id: str = "gpt-4o"
    provider_id: str = "openai"
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    prompt_manager: Any = None
    model_factory: Any = None


@dynamic_prompt
def build_character_prompt(request: ModelRequest) -> str:
    """动态构建角色提示词
    
    根据角色ID和VRM模式动态生成系统提示词。
    """
    context = request.runtime.context
    
    prompt = context.prompt_manager.build_character_prompt(
        character_id=context.character_id,
        include_vrm=context.enable_vrm,
        include_safety=True
    )
    
    logger.debug(
        f"动态提示词: character_id={context.character_id}, vrm={context.enable_vrm}",
        extra={"prompt_length": len(prompt)}
    )
    
    return prompt
