"""中间件模块的惰性导出。

避免仅导入 ``logging_middleware`` 时连带拉起 LangChain 中间件依赖链。
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .dynamic_model import select_model_and_params
    from .dynamic_prompt import AgentContext, build_character_prompt
    from .dynamic_tools import filter_tools_by_mode

__all__ = ["select_model_and_params", "build_character_prompt", "filter_tools_by_mode", "AgentContext"]


def __getattr__(name: str):
    if name == "select_model_and_params":
        from .dynamic_model import select_model_and_params

        return select_model_and_params
    if name in {"build_character_prompt", "AgentContext"}:
        from .dynamic_prompt import AgentContext, build_character_prompt

        return {"build_character_prompt": build_character_prompt, "AgentContext": AgentContext}[name]
    if name == "filter_tools_by_mode":
        from .dynamic_tools import filter_tools_by_mode

        return filter_tools_by_mode
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
