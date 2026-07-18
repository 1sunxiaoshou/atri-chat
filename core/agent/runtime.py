"""Lazy holder for the shared LangChain agent runtime."""

from __future__ import annotations

import asyncio
import threading

from .factory import AgentRuntimeFactory


class AgentRuntime:
    """Owns lazy creation and reuse of the compiled LangChain agent."""

    def __init__(self, factory: AgentRuntimeFactory):
        self.factory = factory
        self._agent = None
        self._agent_lock = threading.Lock()

    def create_agent(self):
        """Create a new compiled agent instance."""
        return self.factory.create()

    def get_or_create_agent_sync(self):
        """Thread-safe synchronous access for code that cannot await."""
        if self._agent is not None:
            return self._agent

        with self._agent_lock:
            if self._agent is None:
                self._agent = self.create_agent()
        return self._agent

    async def get_or_create_agent(self):
        """Get the shared agent without blocking the event loop."""
        return await asyncio.to_thread(self.get_or_create_agent_sync)

    async def warm_up(self) -> None:
        """Create the shared agent in the background."""
        await self.get_or_create_agent()
