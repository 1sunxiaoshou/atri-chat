"""LLM 调用日志回调处理器

记录所有 LLM 交互，包括提示词、响应、token 使用等

注意：这是一个回调处理器（Callback Handler），不是中间件（Middleware）
- 回调处理器：监听和记录事件，不修改执行流程
- 中间件：拦截和修改 Agent 执行流程
"""
from typing import Any, Optional
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
import json
from datetime import datetime
from ..logger import get_logger

logger = get_logger(__name__)


class LLMCallLogger(BaseCallbackHandler):
    """LLM 调用日志回调处理器
    
    作为 LangChain 回调处理器，记录所有 LLM 交互。
    每个请求应创建独立实例，避免日志混淆。
    
    使用方式：
        llm_logger = LLMCallLogger()
        config = {"callbacks": [llm_logger]}
        agent.invoke(input, config=config)
    """
    
    def __init__(self):
        self.calls = []
        self.current_call = None
        self.tool_calls = []  # 记录工具调用
    
    def on_llm_start(
        self,
        serialized: dict,
        prompts: list[str],
        *,
        run_id,
        parent_run_id=None,
        tags=None,
        metadata=None,
        **kwargs: Any,
    ) -> None:
        """LLM 调用开始时捕获提示词"""
        # 从 kwargs 中提取更多信息
        invocation_params = kwargs.get("invocation_params", {})
        
        self.current_call = {
            "run_id": str(run_id),
            "parent_run_id": str(parent_run_id) if parent_run_id else None,
            "timestamp_start": datetime.now().isoformat(),
            "model": serialized.get("id", ["unknown"])[-1] if isinstance(serialized.get("id"), list) else "unknown",
            "prompts": prompts,
            "tags": tags or [],
            "metadata": metadata or {},
            # 新增：模型参数
            "model_params": {
                "temperature": invocation_params.get("temperature"),
                "max_tokens": invocation_params.get("max_tokens"),
                "top_p": invocation_params.get("top_p"),
                "streaming": invocation_params.get("stream", False),
            },
            # 新增：工具信息（如果有）
            "tools": self._extract_tools(invocation_params),
            "tool_calls": [],  # 将在工具调用时填充
        }
        
        # 打印提示词（调试用）
        logger.debug(f"=== LLM 调用开始 (run_id: {run_id}) ===")
        logger.debug(f"模型: {self.current_call['model']}")
        logger.debug(f"参数: {self.current_call['model_params']}")
        if self.current_call['tools']:
            logger.debug(f"可用工具数: {len(self.current_call['tools'])}")
            logger.debug(f"工具列表: {', '.join(self.current_call['tools'])}")
        logger.debug(f"提示词数量: {len(prompts)}")
        for i, prompt in enumerate(prompts):
            logger.debug(f"--- 提示词 {i+1} ---\n{prompt}\n--- 提示词结束 ---")
    
    def _extract_tools(self, invocation_params: dict) -> list[str]:
        """从调用参数中提取工具列表"""
        tools = invocation_params.get("tools", [])
        if not tools:
            return []
        
        tool_names = []
        for tool in tools:
            if isinstance(tool, dict):
                # OpenAI 格式: {"type": "function", "function": {"name": "tool_name"}}
                if "function" in tool:
                    tool_names.append(tool["function"].get("name", "unknown"))
                # 其他格式
                elif "name" in tool:
                    tool_names.append(tool["name"])
            elif hasattr(tool, "name"):
                tool_names.append(tool.name)
        
        return tool_names
    
    def on_llm_end(self, response, *, run_id, **kwargs: Any) -> None:
        """LLM 调用结束时捕获响应"""
        if self.current_call:
            response_text = response.generations[0][0].text if response.generations else None
            
            # 提取工具调用信息（如果有）
            tool_calls_in_response = []
            if response.generations and response.generations[0]:
                generation = response.generations[0][0]
                if hasattr(generation, "message") and hasattr(generation.message, "tool_calls"):
                    for tc in generation.message.tool_calls or []:
                        tool_calls_in_response.append({
                            "id": tc.get("id"),
                            "name": tc.get("name"),
                            "args": tc.get("args"),
                        })
            
            # 计算执行时长
            start_time = datetime.fromisoformat(self.current_call["timestamp_start"])
            end_time = datetime.now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            self.current_call.update({
                "timestamp_end": end_time.isoformat(),
                "duration_ms": duration_ms,
                "response": response_text,
                "tool_calls_in_response": tool_calls_in_response,
                "token_count": {
                    "prompt": response.llm_output.get("usage", {}).get("prompt_tokens") if response.llm_output else None,
                    "completion": response.llm_output.get("usage", {}).get("completion_tokens") if response.llm_output else None,
                    "total": response.llm_output.get("usage", {}).get("total_tokens") if response.llm_output else None,
                } if response.llm_output else None,
                # 新增：完整的 llm_output（包含模型特定信息）
                "llm_output": response.llm_output if response.llm_output else None,
            })
            
            # 打印响应（调试用）
            logger.debug(f"=== LLM 调用结束 (run_id: {run_id}) ===")
            logger.debug(f"耗时: {duration_ms}ms")
            logger.debug(f"响应: {response_text[:200]}..." if response_text and len(response_text) > 200 else f"响应: {response_text}")
            if tool_calls_in_response:
                logger.debug(f"工具调用: {len(tool_calls_in_response)} 个")
                for tc in tool_calls_in_response:
                    logger.debug(f"  - {tc['name']}: {tc['args']}")
            if self.current_call["token_count"]:
                logger.debug(f"Token 使用: {self.current_call['token_count']}")
            logger.debug(f"=== 调用结束 ===")
            
            self.calls.append(self.current_call)
            self.current_call = None
    
    def on_llm_error(self, error: Exception, *, run_id, **kwargs: Any) -> None:
        """LLM 调用失败时捕获错误"""
        if self.current_call:
            # 计算执行时长
            start_time = datetime.fromisoformat(self.current_call["timestamp_start"])
            end_time = datetime.now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            self.current_call.update({
                "timestamp_end": end_time.isoformat(),
                "duration_ms": duration_ms,
                "error": str(error),
                "error_type": type(error).__name__,
            })
            
            logger.error(f"=== LLM 调用失败 (run_id: {run_id}) ===")
            logger.error(f"耗时: {duration_ms}ms")
            logger.error(f"错误类型: {type(error).__name__}")
            logger.error(f"错误: {error}")
            logger.error(f"=== 调用结束 ===")
            
            self.calls.append(self.current_call)
            self.current_call = None
    
    def on_tool_start(
        self,
        serialized: dict,
        input_str: str,
        *,
        run_id,
        parent_run_id=None,
        tags=None,
        metadata=None,
        **kwargs: Any,
    ) -> None:
        """工具调用开始"""
        tool_name = serialized.get("name", "unknown")
        tool_call = {
            "run_id": str(run_id),
            "parent_run_id": str(parent_run_id) if parent_run_id else None,
            "tool_name": tool_name,
            "input": input_str,
            "timestamp_start": datetime.now().isoformat(),
        }
        self.tool_calls.append(tool_call)
        
        logger.debug(f"=== 工具调用开始: {tool_name} (run_id: {run_id}) ===")
        logger.debug(f"输入: {input_str[:200]}..." if len(input_str) > 200 else f"输入: {input_str}")
    
    def on_tool_end(self, output: str, *, run_id, **kwargs: Any) -> None:
        """工具调用结束"""
        # 找到对应的工具调用
        for tool_call in reversed(self.tool_calls):
            if tool_call["run_id"] == str(run_id) and "timestamp_end" not in tool_call:
                start_time = datetime.fromisoformat(tool_call["timestamp_start"])
                end_time = datetime.now()
                duration_ms = int((end_time - start_time).total_seconds() * 1000)
                
                tool_call.update({
                    "timestamp_end": end_time.isoformat(),
                    "duration_ms": duration_ms,
                    "output": output,
                })
                
                logger.debug(f"=== 工具调用结束: {tool_call['tool_name']} (run_id: {run_id}) ===")
                logger.debug(f"耗时: {duration_ms}ms")
                logger.debug(f"输出: {output[:200]}..." if len(output) > 200 else f"输出: {output}")
                break
    
    def on_tool_error(self, error: Exception, *, run_id, **kwargs: Any) -> None:
        """工具调用失败"""
        # 找到对应的工具调用
        for tool_call in reversed(self.tool_calls):
            if tool_call["run_id"] == str(run_id) and "timestamp_end" not in tool_call:
                start_time = datetime.fromisoformat(tool_call["timestamp_start"])
                end_time = datetime.now()
                duration_ms = int((end_time - start_time).total_seconds() * 1000)
                
                tool_call.update({
                    "timestamp_end": end_time.isoformat(),
                    "duration_ms": duration_ms,
                    "error": str(error),
                    "error_type": type(error).__name__,
                })
                
                logger.error(f"=== 工具调用失败: {tool_call['tool_name']} (run_id: {run_id}) ===")
                logger.error(f"耗时: {duration_ms}ms")
                logger.error(f"错误类型: {type(error).__name__}")
                logger.error(f"错误: {error}")
                break
    
    def get_call_logs(self) -> str:
        """以格式化 JSON 返回所有调用日志"""
        return json.dumps({
            "llm_calls": self.calls,
            "tool_calls": self.tool_calls,
        }, indent=2, ensure_ascii=False)
    
    def get_summary(self) -> dict:
        """获取统计摘要"""
        total_tokens = sum(
            call.get("token_count", {}).get("total", 0) or 0
            for call in self.calls
        )
        total_duration = sum(
            call.get("duration_ms", 0)
            for call in self.calls
        )
        
        return {
            "llm_calls_count": len(self.calls),
            "tool_calls_count": len(self.tool_calls),
            "total_tokens": total_tokens,
            "total_duration_ms": total_duration,
            "average_duration_ms": total_duration // len(self.calls) if self.calls else 0,
            "errors": sum(1 for call in self.calls if "error" in call),
        }
    
    def clear_logs(self):
        """清空日志"""
        self.calls = []
        self.tool_calls = []
        self.current_call = None
