"""Agent runtime context passed into LangChain middleware."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentContext:
    """Per-request context for the shared LangChain agent runtime."""

    character_id: str
    conversation_id: str | None = None
    enable_vrm: bool = False
    model_id: str = "gpt-4o"
    provider_config_id: int = 1
    model_kwargs: dict[str, Any] = field(default_factory=dict)

    # Request-scoped dependencies. They are intentionally typed as Any to avoid
    # pulling ORM/service imports into LangChain middleware module import time.
    db_session: Any | None = None
    model_service: Any | None = None
    prompt_manager: Any | None = None
