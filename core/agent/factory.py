"""Factory for the shared LangChain 1.0 agent graph."""

from __future__ import annotations


class AgentRuntimeFactory:
    """Build the compiled LangChain agent used by ATRI chat requests."""

    def __init__(self, *, store, checkpointer):
        self.store = store
        self.checkpointer = checkpointer

    def create(self):
        """Create a LangChain agent with dynamic ATRI middleware.

        The placeholder model is replaced at request time by
        ``select_model_and_params``.
        """
        from langchain.agents import create_agent
        from langchain_openai import ChatOpenAI

        from ..middleware import (
            AgentContext,
            build_character_prompt,
            filter_tools_by_mode,
            persist_agent_messages,
            select_model_and_params,
        )
        from ..tools import get_action_tools
        from ..tools.memory_tools_v3 import get_memory_tools_v3

        all_tools = [
            *get_memory_tools_v3(),
            *get_action_tools(),
        ]

        placeholder_model = ChatOpenAI(model="gpt-4o", api_key="placeholder")

        return create_agent(
            model=placeholder_model,
            tools=all_tools,
            middleware=[
                select_model_and_params,
                build_character_prompt,
                filter_tools_by_mode,
                persist_agent_messages,
            ],
            context_schema=AgentContext,
            checkpointer=self.checkpointer,
            store=self.store,
        )
