"""消息处理服务"""
import json
from typing import AsyncGenerator, Tuple, Optional, Dict, Any
from langchain.messages import AIMessageChunk
from ..logger import get_logger

logger = get_logger(__name__)


class MessageService:
    """消息处理服务
    
    负责流式消息处理、内容解析和事件分发。
    """
    
    async def run_streaming(
        self,
        agent,
        user_message: str,
        config: dict,
        context
    ) -> AsyncGenerator[str, None]:
        """执行流式处理
        
        Args:
            agent: Agent实例
            user_message: 用户消息
            config: LangChain配置（包含thread_id）
            context: Agent运行时上下文
            
        Yields:
            JSON格式的流式事件
        """
        full_message = None
        chunk_count = 0
        tool_call_count = 0
        
        try:
            # 使用 astream_events 获取流式事件
            async for event in agent.astream_events(
                {"messages": [{"role": "user", "content": user_message}]},
                config=config,
                context=context,
                version="v2"
            ):
                event_type = event.get("event")
                
                # 工具调用开始
                if event_type == "on_tool_start":
                    tool_name = event.get("name", "未知工具")
                    tool_input = event.get("data", {}).get("input", {})
                    run_id = event.get("run_id", "")
                    tool_call_count += 1
                    
                    # 使用 run_id 的前8位作为标识
                    call_id = str(run_id)[-8:] if run_id else "unknown"
                    
                    # 格式化参数
                    params_str = self._format_tool_params(tool_input)
                    logger.info(f"[{call_id}] 工具: {tool_name}\n{params_str}")
                    
                    yield json.dumps({
                        "type": "status",
                        "content": f"正在使用工具: {tool_name}..."
                    }, ensure_ascii=False)
                
                # 工具调用结束
                elif event_type == "on_tool_end":
                    tool_name = event.get("name", "未知工具")
                    output = event.get("data", {}).get("output", "")
                    run_id = event.get("run_id", "")
                    
                    call_id = str(run_id)[-8:] if run_id else "unknown"
                    output_str = str(output)
                    output_preview = output_str[:80] + "..." if len(output_str) > 80 else output_str
                    logger.info(f"[{call_id}] 完成: {tool_name} → {output_preview}")
                    
                    yield json.dumps({
                        "type": "tool_result",
                        "tool": tool_name,
                        "content": str(output)[:200]  # 只显示前200字符
                    }, ensure_ascii=False)
                
                # 模型流式输出
                elif event_type == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if not isinstance(chunk, AIMessageChunk):
                        continue
                    
                    # 聚合消息块
                    full_message = chunk if full_message is None else full_message + chunk
                    
                    # 解析并发送内容
                    text_chunk, reasoning_chunk = self._parse_chunk(chunk)
                    
                    if reasoning_chunk:
                        yield json.dumps({
                            "type": "reasoning",
                            "content": reasoning_chunk
                        }, ensure_ascii=False)
                    
                    if text_chunk:
                        chunk_count += 1
                        yield json.dumps({
                            "type": "text",
                            "content": text_chunk
                        }, ensure_ascii=False)
            
            # 发送完成统计
            full_response = full_message.content if full_message else ""
            token_info = self._get_token_info(full_message)
            
            logger.info(
                f"完成: {chunk_count} chunks, {tool_call_count} tools, "
                f"{len(full_response)} chars{token_info}"
            )
            
            yield json.dumps({
                "type": "complete",
                "stats": {
                    "chunk_count": chunk_count,
                    "tool_call_count": tool_call_count,
                    "response_length": len(full_response)
                },
                "full_response": full_response
            }, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"流式处理失败: {e}", exc_info=True)
            raise
    
    def _parse_chunk(self, chunk: AIMessageChunk) -> Tuple[str, str]:
        """解析消息块
        
        Args:
            chunk: AI消息块
            
        Returns:
            (text_content, reasoning_content) 元组
        """
        text_content = ""
        reasoning_content = ""
        
        try:
            if hasattr(chunk, 'content') and chunk.content:
                if isinstance(chunk.content, str):
                    text_content = chunk.content
                elif isinstance(chunk.content, list):
                    for block in chunk.content:
                        if isinstance(block, str):
                            text_content += block
                        elif isinstance(block, dict):
                            if block.get('type') == 'text':
                                text_content += block.get('text', '')
                            elif block.get('type') == 'reasoning':
                                reasoning_content += block.get('reasoning', '')
            
            # 检查 additional_kwargs 中的推理内容
            if hasattr(chunk, 'additional_kwargs') and chunk.additional_kwargs:
                reasoning_content += chunk.additional_kwargs.get('reasoning_content', "")
                
        except Exception as e:
            logger.warning(f"解析消息块异常: {e}", exc_info=True)
            text_content = str(chunk.content) if chunk.content else ""
        
        return text_content, reasoning_content
    
    def _format_tool_params(self, params: Dict[str, Any]) -> str:
        """格式化工具参数为易读格式
        
        Args:
            params: 工具参数字典
            
        Returns:
            格式化后的字符串
        """
        if not params:
            return "  (无参数)"
        
        lines = []
        for key, value in params.items():
            # 处理长字符串
            if isinstance(value, str):
                if len(value) > 60:
                    value_str = f"{value[:60]}... ({len(value)} chars)"
                else:
                    value_str = value
            else:
                value_str = str(value)
            
            lines.append(f"  {key}: {value_str}")
        
        return "\n".join(lines)
    
    def _get_token_info(self, message) -> str:
        """获取 token 使用信息
        
        Args:
            message: AI 消息对象
            
        Returns:
            格式化的 token 信息字符串,如 ", tokens=100+20=120"
        """
        if not message:
            return ""
        
        usage = None
        
        # 尝试标准方式
        if hasattr(message, 'usage_metadata') and message.usage_metadata:
            usage = message.usage_metadata
        # 尝试 response_metadata
        elif hasattr(message, 'response_metadata') and message.response_metadata:
            metadata = message.response_metadata
            usage = metadata.get('token_usage') or metadata.get('usage')
        
        if not usage:
            return ""
        
        # 统一提取 token 数量 (兼容不同字段名)
        input_tokens = usage.get('input_tokens') or usage.get('prompt_tokens', 0)
        output_tokens = usage.get('output_tokens') or usage.get('completion_tokens', 0)
        total_tokens = usage.get('total_tokens', input_tokens + output_tokens)
        
        return f", tokens={input_tokens}+{output_tokens}={total_tokens}"
