"""长期记忆工具 - 让 AI 能够存储和检索长期记忆

遵循 LangChain 最佳实践：
- 使用 ToolRuntime 参数访问 store
- 通过 runtime.context 获取 character_id
- 使用 character_id 作为命名空间隔离不同角色的记忆
"""
import uuid
from datetime import datetime
from typing import Optional
from dataclasses import dataclass
from langchain.tools import tool, ToolRuntime


@dataclass
class AgentContext:
    """Agent 运行时上下文
    
    包含静态信息，在 agent 调用时注入
    """
    character_id: int


@tool
def save_memory(
    content: str,
    category: str = "general",
    tags: Optional[str] = None,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """保存长期记忆
    
    用于存储重要信息、用户偏好、对话摘要等，以便在后续对话中使用。
    记忆会保存在当前角色的命名空间下，不同角色的记忆相互隔离。
    
    Args:
        content: 要保存的内容
        category: 记忆分类（general/preference/summary/fact等）
        tags: 标签，多个标签用逗号分隔
        runtime: 运行时上下文（自动注入）
        
    Returns:
        保存成功的消息和记忆ID
    """
    try:
        if not runtime or not runtime.store:
            return "✗ Store 未配置，无法保存记忆"
        
        # 使用 character_id 作为命名空间
        character_id = runtime.context.character_id
        namespace = ("characters", str(character_id), "memories")
        memory_id = str(uuid.uuid4())
        
        memory_data = {
            "content": content,
            "category": category,
            "tags": [t.strip() for t in tags.split(",")] if tags else [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        runtime.store.put(namespace, memory_id, memory_data)
        
        return f"✓ 记忆已保存 (ID: {memory_id})\n分类: {category}\n内容: {content[:50]}..."
    except Exception as e:
        return f"✗ 保存记忆失败: {str(e)}"


@tool
def search_memory(
    query: str,
    category: Optional[str] = None,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """搜索长期记忆
    
    根据关键词搜索已保存的记忆。只会搜索当前角色的记忆。
    
    Args:
        query: 搜索关键词
        category: 可选的分类过滤
        runtime: 运行时上下文（自动注入）
        
    Returns:
        搜索结果
    """
    try:
        if not runtime or not runtime.store:
            return "✗ Store 未配置，无法搜索记忆"
        # 使用 character_id 作为命名空间
        character_id = runtime.context.character_id
        namespace = ("characters", str(character_id), "memories")
        items = runtime.store.search(namespace, query=query, limit=5)
        
        if not items:
            return f"未找到包含 '{query}' 的记忆"
        
        results = []
        for item in items:
            value = item.value
            # 如果指定了分类，则过滤
            if category and value.get("category") != category:
                continue
            
            tags_str = ', '.join(value.get('tags', []))
            result_text = f"【{value.get('category', 'general')}】{value.get('content', '')}"
            if tags_str:
                result_text += f"\n  标签: {tags_str}"
            result_text += f" | 创建: {value.get('created_at', '')[:10]}"

            results.append(result_text)
        
        if not results:
            return f"未找到分类为 '{category}' 的记忆"
        
        return "找到以下记忆:\n" + "\n".join(results)
    except Exception as e:
        return f"✗ 搜索记忆失败: {str(e)}"


@tool
def list_memories(
    category: Optional[str] = None,
    limit: int = 10,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """列出所有长期记忆
    
    列出已保存的所有记忆或指定分类的记忆。只会列出当前角色的记忆。
    
    Args:
        category: 可选的分类过滤
        limit: 返回的最大记忆数
        runtime: 运行时上下文（自动注入）
        
    Returns:
        记忆列表
    """
    try:
        if not runtime or not runtime.store:
            return "✗ Store 未配置，无法列出记忆"
        
        # 使用 character_id 作为命名空间
        character_id = runtime.context.character_id
        namespace = ("characters", str(character_id), "memories")
        items = runtime.store.list_namespace(namespace)
        
        if not items:
            return "暂无保存的记忆"
        
        # 按分类过滤
        if category:
            items = [item for item in items if item.value.get("category") == category]
        
        # 限制数量
        items = items[:limit]
        
        results = []
        for item in items:
            value = item.value
            tags_str = ', '.join(value.get('tags', []))
            results.append(
                f"【{value.get('category', 'general')}】{value.get('content', '')[:40]}...\n"
                f"  标签: {tags_str}" if tags_str else f"【{value.get('category', 'general')}】{value.get('content', '')[:40]}..."
            )

        if not results:
            return f"未找到分类为 '{category}' 的记忆"
        
        return f"共 {len(items)} 条记忆:\n" + "\n".join(results)
    except Exception as e:
        return f"✗ 列出记忆失败: {str(e)}"


@tool
def update_memory(
    memory_id: str,
    content: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[str] = None,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """更新长期记忆
    
    更新已保存的记忆内容、分类或标签。只能更新当前角色的记忆。
    
    Args:
        memory_id: 记忆ID
        content: 新的内容（可选）
        category: 新的分类（可选）
        tags: 新的标签（可选）
        runtime: 运行时上下文（自动注入）
        
    Returns:
        更新结果
    """
    try:
        if not runtime or not runtime.store:
            return "✗ Store 未配置，无法更新记忆"
        
        # 使用 character_id 作为命名空间
        character_id = runtime.context.character_id
        namespace = ("characters", str(character_id), "memories")
        item = runtime.store.get(namespace, memory_id)
        
        if not item:
            return f"✗ 记忆 {memory_id} 不存在"
        
        # 更新字段
        updated_data = item.value.copy()
        if content is not None:
            updated_data["content"] = content
        if category is not None:
            updated_data["category"] = category
        if tags is not None:
            updated_data["tags"] = [t.strip() for t in tags.split(",")]
        
        updated_data["updated_at"] = datetime.now().isoformat()
        
        runtime.store.put(namespace, memory_id, updated_data)
        
        return f"✓ 记忆已更新 (ID: {memory_id})"
    except Exception as e:
        return f"✗ 更新记忆失败: {str(e)}"


@tool
def delete_memory(
    memory_id: str,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """删除长期记忆
    
    删除指定的记忆。只能删除当前角色的记忆。
    
    Args:
        memory_id: 记忆ID
        runtime: 运行时上下文（自动注入）
        
    Returns:
        删除结果
    """
    try:
        if not runtime or not runtime.store:
            return "✗ Store 未配置，无法删除记忆"
        
        # 使用 character_id 作为命名空间
        character_id = runtime.context.character_id
        namespace = ("characters", str(character_id), "memories")
        success = runtime.store.delete(namespace, memory_id)
        
        if success:
            return f"✓ 记忆已删除 (ID: {memory_id})"
        else:
            return f"✗ 记忆 {memory_id} 不存在"
    except Exception as e:
        return f"✗ 删除记忆失败: {str(e)}"


def get_memory_tools():
    """获取长期记忆工具列表
    
    Returns:
        工具列表
    """
    return [
        save_memory,
        search_memory,
        list_memories,
        update_memory,
        delete_memory
    ]
