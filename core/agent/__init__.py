"""Agent runtime primitives.

Keep this package lightweight: importing ``core.agent`` should not eagerly load
LangChain model providers or tool definitions.
"""

from .context import AgentContext

__all__ = ["AgentContext"]
