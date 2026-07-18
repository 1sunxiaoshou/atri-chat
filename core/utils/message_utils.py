"""消息处理工具"""

from typing import Any


def extract_text_from_content(content: str | list[str | dict[str, Any]]) -> str:
    """从 LangChain 消息内容中提取纯文本

    支持:
    1. 纯字符串
    2. 字典列表 (OpenAI/Anthropic/Qwen 格式)
    3. 混合列表
    """
    if not content:
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        texts = []
        for part in content:
            if isinstance(part, str):
                texts.append(part)
            elif isinstance(part, dict):
                # 按照优先级获取文本字段
                # text: 标准文本
                # content: 某些供应商的旧格式
                t = part.get("text") or part.get("content")
                if t:
                    texts.append(str(t))
        return "".join(texts)

    return str(content)
