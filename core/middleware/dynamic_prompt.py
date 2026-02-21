"""动态提示词生成中间件"""
from dataclasses import dataclass, field
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from typing import Dict, Any, TYPE_CHECKING
from ..logger import get_logger

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from ..services.model_service import ModelService
    from ..prompts import PromptManager

logger = get_logger(__name__)


@dataclass
class AgentContext:
    """Agent 运行时上下文
    
    包含 Agent 运行时需要的所有上下文信息。
    """
    character_id: str  # 改为 UUID
    enable_vrm: bool = False
    model_id: str = "gpt-4o"
    provider_id: str = "openai"
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    
    # 服务依赖（请求级别）
    db_session: "Session" = None
    model_service: "ModelService" = None
    prompt_manager: "PromptManager" = None


@dynamic_prompt
def build_character_prompt(request: ModelRequest) -> str:
    """动态构建角色提示词
    
    根据角色ID和VRM模式动态生成系统提示词。
    """
    context = request.runtime.context
    
    prompt = context.prompt_manager.build_character_prompt(
        character_id=context.character_id,
        include_vrm=context.enable_vrm,
        include_safety=True,
        db_session=context.db_session  # 传递数据库会话
    )
    
    logger.debug(
        f"动态提示词: character_id={context.character_id}, vrm={context.enable_vrm}",
        extra={"prompt_length": len(prompt)}
    )
    
    return prompt

