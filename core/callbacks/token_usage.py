"""Token 统计回调处理器"""

from typing import Any

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

from ..logger import get_logger

logger = get_logger(__name__)


class TokenUsageCallback(AsyncCallbackHandler):
    """Token 统计回调处理器

    专门负责在 LLM 调用结束时提取并保存 Token 使用信息。
    """

    def __init__(self):
        self.usage_history: list[dict[str, Any]] = []
        self.run_usages: dict[str, dict[str, int]] = {}
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_tokens = 0

    async def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """LLM 调用结束时捕获 tokens"""
        run_id = str(kwargs.get("run_id", "default"))
        if response.generations:
            msg = response.generations[0][0].message
            if hasattr(msg, "usage_metadata") and msg.usage_metadata:
                self._extract_usage(msg.usage_metadata, run_id)

        if response.llm_output:
            self._extract_usage(
                response.llm_output.get("token_usage")
                or response.llm_output.get("usage"),
                run_id,
            )

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """流式过程中捕获 tokens"""
        run_id = str(kwargs.get("run_id", "default"))
        chunk = kwargs.get("chunk")
        if chunk and hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
            self._extract_usage(chunk.usage_metadata, run_id)

    def _extract_usage(self, usage: Any, run_id: str) -> None:
        """记录单个 run_id 的最大使用量"""
        if not usage or not isinstance(usage, dict):
            return

        input_t = usage.get("input_tokens") or usage.get("prompt_tokens", 0)
        output_t = usage.get("output_tokens") or usage.get("completion_tokens", 0)
        total_t = usage.get("total_tokens") or (input_t + output_t)

        if total_t > 0:
            # 记录每个 run 的最大值（避免流式重复计算）
            if run_id not in self.run_usages:
                self.run_usages[run_id] = {"input": 0, "output": 0, "total": 0}

            cur = self.run_usages[run_id]
            cur["input"] = max(cur["input"], input_t)
            cur["output"] = max(cur["output"], output_t)
            cur["total"] = max(cur["total"], total_t)

            # 同步更新累计总数 (用于 get_summary 快速返回)
            self.total_input_tokens = sum(u["input"] for u in self.run_usages.values())
            self.total_output_tokens = sum(
                u["output"] for u in self.run_usages.values()
            )
            self.total_tokens = sum(u["total"] for u in self.run_usages.values())

            if not self.usage_history:
                self.usage_history.append({})  # 保持兼容性计数

    def get_summary(self) -> dict[str, Any]:
        """获取累计 Token 信息"""
        return {
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "total_tokens": self.total_tokens,
            "calls_count": max(1, len(self.usage_history)),
        }
