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
                # 将 LangChain 事件转换为前端标准负载
                payload = self._get_payload_from_event(event)
                
                if not payload:
                    continue
                    
                # 统一处理：将其视为列表进行统计和分发
                items = payload if isinstance(payload, list) else [payload]
                
                for item in items:
                    item_type = item.get("type")
                    if item_type == "tool_start":
                        tool_call_count += 1
                    elif item_type == "text":
                        chunk_count += 1
                    elif item_type == "complete":
                        continue
                        
                    yield json.dumps(item, ensure_ascii=False)
            
            yield json.dumps({
                "type": "complete"
                # full_response 由 AgentCoordinator 负责聚合，MessageService 不再尝试计算不准确的汇总
            }, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"流式处理失败: {e}")
            raise
    
    def _get_payload_from_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """从 LangChain 事件中提取前端负载 (类似 extract_tool_calls 的逻辑)"""
        event_type = event.get("event")
        data = event.get("data", {})
        run_id = event.get("run_id", "")
        
        # 1. 工具调用开始
        if event_type == "on_tool_start":
            return {
                "type": "tool_start",
                "tool": event.get("name"),
                "input": data.get("input"),
                "run_id": str(run_id)
            }
            
        # 2. 工具调用结束
        if event_type == "on_tool_end":
            output = data.get("output")
            # 确保输出是可序列化的，如果是消息对象则提取内容
            if hasattr(output, "content"):
                content = output.content
            elif isinstance(output, (dict, list, str, int, float, bool, type(None))):
                content = output
            else:
                content = str(output)
                
            return {
                "type": "tool_result",
                "tool": event.get("name"),
                "content": content,
                "run_id": str(run_id)
            }
            
        # 3. 模型流式内容 (Text/Reasoning)
        if event_type == "on_chat_model_stream":
            chunk = data.get("chunk")
            if not isinstance(chunk, AIMessageChunk):
                return None
            
            text, reasoning = self._parse_chunk(chunk)
            payloads = []
            if reasoning:
                payloads.append({"type": "reasoning", "content": reasoning})
            if text:
                payloads.append({"type": "text", "content": text})
            
            return payloads if payloads else None

        if event_type == "on_chat_model_end":
            pass
                
        return None

    def _parse_chunk(self, chunk: AIMessageChunk) -> Tuple[str, str]:
        """解析消息块，提取文本和思考内容"""
        text = ""
        reasoning = ""
        
        # 1. 尝试从 content 列表/字符串中提取 (极简处理)
        if isinstance(chunk.content, list):
            for block in chunk.content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        text += block.get("text", "")
                    elif block.get("type") == "reasoning":
                        reasoning += block.get("reasoning", "")
        elif isinstance(chunk.content, str):
            text = chunk.content
            
        # 2. 依据阿里云官方文档，深度思考内容在 additional_kwargs['reasoning_content'] 中
        if hasattr(chunk, 'additional_kwargs') and chunk.additional_kwargs:
            # 阿里标准字段: reasoning_content
            reasoning += chunk.additional_kwargs.get('reasoning_content') or ""
            # 其他兼容字段
            reasoning += chunk.additional_kwargs.get('thought') or ""
            reasoning += chunk.additional_kwargs.get('thinking') or ""
            
        return text, reasoning
