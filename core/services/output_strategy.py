"""输出策略模块 - 处理不同模式的消息输出"""
import json
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from langchain_core.messages import ToolMessage
from ..logger import get_logger
from ..utils.message_utils import extract_text_from_content

logger = get_logger(__name__)


class OutputStrategy(ABC):
    """输出策略基类"""
    
    @abstractmethod
    async def process(
        self,
        agent,
        user_message: str,
        config: dict,
        context,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """处理消息并生成输出流"""
        pass
    
    @abstractmethod
    def clean_response(self, response: str) -> str:
        """清理响应文本（用于保存）"""
        pass


class TextOutputStrategy(OutputStrategy):
    """文本输出策略 - 流式文本输出"""
    
    def __init__(self, message_service):
        self.message_service = message_service
    
    async def process(
        self,
        agent,
        user_message: str,
        config: dict,
        context,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """流式处理文本消息。"""
        async for chunk_json in self.message_service.run_streaming(
            agent=agent,
            user_message=user_message,
            config=config,
            context=context
        ):
            chunk_data = json.loads(chunk_json)

            if chunk_data.get("type") == "complete":
                logger.info(f"[TEXT] 回复: {chunk_data.get('full_response', '')}")
            
            yield json.dumps(chunk_data, ensure_ascii=False)
    
    def clean_response(self, response: str) -> str:
        """清理响应"""
        return response


class VRMOutputStrategy(OutputStrategy):
    """VRM输出策略 - 生成前端命令"""
    
    async def process(
        self,
        agent,
        user_message: str,
        config: dict,
        context,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """非流式获取回复，并提取前端命令。"""
        # 非流式获取完整回复
        response = await agent.ainvoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
            context=context
        )
        
        # 提取回复
        full_response = self._extract_response(response)
        if not full_response:
            logger.warning("AI 回复为空")
            yield json.dumps({"type": "error", "message": "AI 回复为空"}, ensure_ascii=False)
            return
        
        logger.info(f"[VRM] 回复:\n{full_response}")
        
        # 返回完整文本（供保存用）
        yield json.dumps({
            "type": "full_response",
            "content": full_response
        }, ensure_ascii=False)

        action_batches, camera_commands = self._extract_frontend_commands(response)
        for commands in action_batches:
            yield json.dumps({"type": "vrm_commands", "commands": commands}, ensure_ascii=False)
        for command in camera_commands:
            yield json.dumps({"type": "camera_command", "command": command}, ensure_ascii=False)
    
    def clean_response(self, response: str) -> str:
        """VRM 模式正文已是自然语言，无需额外清理。"""
        return response
    
    def _extract_response(self, response) -> str:
        """从 Agent 响应中提取纯文本内容"""
        content = None
        if hasattr(response, 'content'):
            content = response.content
        elif isinstance(response, dict) and 'messages' in response:
            messages = response['messages']
            if messages and hasattr(messages[-1], 'content'):
                content = messages[-1].content
        
        return extract_text_from_content(content)

    def _extract_frontend_commands(self, response) -> tuple[list[list[str]], list[dict]]:
        messages = response.get("messages") if isinstance(response, dict) else None
        if not messages:
            return [], []

        tool_results: dict[str, bool] = {}
        for message in messages:
            if isinstance(message, ToolMessage):
                content = extract_text_from_content(message.content).strip().lower()
                tool_results[message.tool_call_id] = content == "ok" and message.status != "error"

        action_batches: list[list[str]] = []
        camera_commands: list[dict] = []
        for message in messages:
            tool_calls = getattr(message, "tool_calls", None) or []
            for tool_call in tool_calls:
                tool_call_id = tool_call.get("id", "")
                if not tool_results.get(tool_call_id):
                    continue

                name = tool_call.get("name")
                args = tool_call.get("args") or {}
                if not isinstance(args, dict):
                    continue

                if name == "perform_actions":
                    commands = args.get("commands")
                    if isinstance(commands, list) and commands:
                        action_batches.append([str(command) for command in commands])
                elif name == "control_camera":
                    camera_commands.append(
                        {
                            "action": args.get("action"),
                            "preset": args.get("preset"),
                            "durationMs": args.get("durationMs"),
                        }
                    )

        return action_batches, camera_commands


def get_output_strategy(mode: str, message_service=None) -> OutputStrategy:
    """工厂方法：根据模式获取输出策略"""
    strategies = {
        "text": lambda: TextOutputStrategy(message_service),
        "vrm": lambda: VRMOutputStrategy(),
    }
    
    if mode not in strategies:
        raise ValueError(f"不支持的输出模式: {mode}")
    
    return strategies[mode]()
