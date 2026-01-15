"""输出策略模块 - 处理不同模式的消息输出"""
import json
import re
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from ..logger import get_logger

logger = get_logger(__name__, category="SERVICE")


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
        """流式处理文本消息，过滤 [xxx] 标签"""
        ignoring = False  # 是否在标签内
        accumulated = []  # 累积已过滤的文本
        
        async for chunk_json in self.message_service.run_streaming(
            agent=agent,
            user_message=user_message,
            config=config,
            context=context
        ):
            chunk_data = json.loads(chunk_json)
            
            # 只过滤 text 类型
            if chunk_data.get("type") == "text":
                content = chunk_data.get("content", "")
                filtered = []
                
                for char in content:
                    if char == '[':
                        ignoring = True
                    elif char == ']':
                        ignoring = False
                    elif not ignoring:
                        filtered.append(char)
                
                filtered_text = ''.join(filtered)
                chunk_data["content"] = filtered_text
                accumulated.append(filtered_text)  # 累积
            
            # complete 类型用累积的文本
            elif chunk_data.get("type") == "complete":
                cleaned_resp = ''.join(accumulated)
                chunk_data["full_response"] = cleaned_resp
                logger.info(f"[TEXT] 回复: {cleaned_resp}")
            
            yield json.dumps(chunk_data, ensure_ascii=False)
    
    def clean_response(self, response: str) -> str:
        """清理响应"""
        return response


class VRMOutputStrategy(OutputStrategy):
    """VRM输出策略 - 生成音频段"""
    
    def __init__(self, vrm_service):
        self.vrm_service = vrm_service
    
    async def process(
        self,
        agent,
        user_message: str,
        config: dict,
        context,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """非流式获取回复，然后流式生成音频"""
        character_id = context.character_id
        
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
        
        logger.info(f"[VRM] 回复:\n {full_response}")
        
        # 返回完整文本（供保存用）
        yield json.dumps({
            "type": "full_response",
            "content": full_response
        }, ensure_ascii=False)
        
        # 流式生成音频段
        segment_count = 0
        async for segment in self.vrm_service.generate_stream(full_response, character_id):
            segment_count += 1
            yield json.dumps({"type": "vrm_segment", "data": segment}, ensure_ascii=False)
        
        yield json.dumps({"type": "vrm_complete", "total_segments": segment_count}, ensure_ascii=False)
    
    def clean_response(self, response: str) -> str:
        """去除VRM标记，保留换行"""
        # 按行处理，保留换行结构
        lines = response.split('\n')
        cleaned_lines = []
        for line in lines:
            # 去除标签
            cleaned = re.sub(r'\[[^\]]+:[^\]]+\]', '', line).strip()
            if cleaned:  # 只保留非空行
                cleaned_lines.append(cleaned)
        return '\n'.join(cleaned_lines)
    
    def _extract_response(self, response) -> str:
        if hasattr(response, 'content'):
            return response.content
        elif isinstance(response, dict) and 'messages' in response:
            messages = response['messages']
            if messages and hasattr(messages[-1], 'content'):
                return messages[-1].content
        return ""


def get_output_strategy(mode: str, message_service=None, vrm_service=None) -> OutputStrategy:
    """工厂方法：根据模式获取输出策略"""
    strategies = {
        "text": lambda: TextOutputStrategy(message_service),
        "vrm": lambda: VRMOutputStrategy(vrm_service),
    }
    
    if mode not in strategies:
        raise ValueError(f"不支持的输出模式: {mode}")
    
    return strategies[mode]()
