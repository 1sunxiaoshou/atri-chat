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
                    tool_call_count += 1
                    logger.info(f"工具调用: {tool_name}")
                    yield json.dumps({
                        "type": "status",
                        "content": f"正在使用工具: {tool_name}..."
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
            logger.info(
                f"流式处理完成: chunks={chunk_count}, tools={tool_call_count}, length={len(full_response)}"
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
