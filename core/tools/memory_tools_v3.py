"""长期记忆工具 V3。

固定目录下的简洁记忆读写指令系统：
- 每个角色拥有独立目录
- 只接受相对路径
- 默认操作 Markdown 文件
- 提供 read / write / search / list 四个基础动作
"""
from datetime import datetime
from pathlib import Path
from typing import Optional
from langchain.tools import tool, ToolRuntime
from ..middleware import AgentContext
from ..config import get_settings
from ..logger import get_logger

logger = get_logger(__name__)


# ==================== 路径管理 ====================

def _get_memory_root(character_id: str) -> Path:
    """获取角色的记忆根目录"""
    memory_root = get_settings().memory_dir
    character_dir = memory_root / str(character_id)
    character_dir.mkdir(parents=True, exist_ok=True)
    return character_dir


def _resolve_path(character_id: str, file_path: str) -> Path:
    """解析记忆文件路径，只允许访问角色自己的固定目录。"""
    root = _get_memory_root(character_id)
    
    # 自动添加 .md 后缀
    if not file_path.endswith('.md'):
        file_path = f"{file_path}.md"
    
    # 解析相对路径并规范化（resolve 会处理 ../ 等）
    full_path = (root / file_path).resolve()
    
    # 安全检查：确保路径在角色目录内
    try:
        full_path.relative_to(root)
    except ValueError:
        raise ValueError(f"安全错误：路径 '{file_path}' 超出允许范围")
    
    # 确保父目录存在
    full_path.parent.mkdir(parents=True, exist_ok=True)
    
    return full_path


# ==================== 初始化模板 ====================

TEMPLATES = {
    "user_profile.md": """# 用户核心档案

## [Basic Info]
- Name: (未知)
- Gender: (未知)
- Location: (未知)
- Career: (未知)
- Status: (未知)

## [Personality]
- Tone: (未知)
- Values: (未知)
- Language: 中文为主

## [Preferences]
- Food: (未知)
- Hobbies: (未知)

## [Social]
- Key People: (未知)

## [Current]
- Goal: (未知)
- Mood: (未知)
""",
    "memory_stream.md": """# 记忆流水账

> 格式：- [YYYY-MM-DD HH:MM] (Category) 事件描述

""",
    "topics.md": """# 话题摘要

> 深度话题的结构化整理

"""
}


def _ensure_file_exists(path: Path):
    """确保文件存在，不存在则使用模板创建"""
    if not path.exists():
        # 查找匹配的模板
        template = TEMPLATES.get(path.name, "")
        path.write_text(template, encoding="utf-8")


# ==================== 核心工具 ====================

@tool
def memory_read(
    file: str,
    section: Optional[str] = None,
    tail_lines: Optional[int] = None,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """读取固定记忆目录中的 Markdown 文件。

    常用文件：
    - `user_profile`
    - `memory_stream`
    - `topics`

    常见用法：
    - 完整读取：`memory_read(file="user_profile")`
    - 读取章节：`memory_read(file="user_profile", section="Basic Info")`
    - 读取尾部：`memory_read(file="memory_stream", tail_lines=50)`
    """
    try:
        if not runtime or not runtime.context:
            return "✗ 系统错误：Context 未配置"
        
        character_id = runtime.context.character_id
        file_path = _resolve_path(character_id, file)
        _ensure_file_exists(file_path)
        
        content = file_path.read_text(encoding="utf-8")
        
        # 模式 1: 章节读取
        if section:
            import re
            pattern = rf"## \[{re.escape(section)}\](.*?)(?=\n## \[|\Z)"
            match = re.search(pattern, content, re.DOTALL)
            if not match:
                return f"✗ 章节 [{section}] 不存在"
            return f"[{file}] 章节 [{section}]:\n{match.group(1).strip()}"
        
        # 模式 2: 尾部读取
        if tail_lines:
            lines = content.split("\n")
            event_lines = [l for l in lines if l.strip().startswith("- [")]
            tail = event_lines[-tail_lines:] if len(event_lines) > tail_lines else event_lines
            if not tail:
                return f"[{file}] 暂无记录"
            return f"[{file}] 最近 {len(tail)} 条:\n" + "\n".join(tail)
        
        # 模式 3: 完整读取
        return f"[{file}]:\n{content}"
    
    except ValueError as e:
        # 路径安全错误
        return f"✗ {str(e)}"
    except Exception as e:
        logger.error(f"memory_read 工具执行失败: {e}")
        return f"✗ 读取失败: {str(e)}"


@tool
def memory_write(
    file: str,
    content: str,
    section: Optional[str] = None,
    mode: str = "append",
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """写入固定记忆目录中的 Markdown 文件。

    模式：
    - `append`：追加到文件末尾，适合 `memory_stream`
    - `replace`：替换指定章节，适合 `user_profile` / `topics`

    常见用法：
    - `memory_write(file="memory_stream", content="...", mode="append")`
    - `memory_write(file="user_profile", section="Basic Info", content="...", mode="replace")`
    """
    try:
        if not runtime or not runtime.context:
            return "✗ 系统错误：Context 未配置"
        
        character_id = runtime.context.character_id
        file_path = _resolve_path(character_id, file)
        _ensure_file_exists(file_path)
        
        # 模式 1: 追加
        if mode == "append":
            with open(file_path, "a", encoding="utf-8") as f:
                f.write(content if content.endswith("\n") else content + "\n")
            return f"✓ 已追加到 [{file}]"
        
        # 模式 2: 替换章节
        if mode == "replace":
            if not section:
                return "✗ 替换模式需要指定 section 参数"
            
            import re
            full_content = file_path.read_text(encoding="utf-8")
            pattern = rf"(## \[{re.escape(section)}\])(.*?)(?=\n## \[|\Z)"
            
            if not re.search(pattern, full_content, re.DOTALL):
                # 章节不存在，追加新章节
                new_section = f"\n## [{section}]\n{content.strip()}\n"
                file_path.write_text(full_content.rstrip() + new_section, encoding="utf-8")
                return f"✓ 已创建章节 [{section}] 在 [{file}]"
            
            # 章节存在，替换内容
            new_section = f"## [{section}]\n{content.strip()}\n"
            updated = re.sub(pattern, new_section, full_content, flags=re.DOTALL)
            file_path.write_text(updated, encoding="utf-8")
            return f"✓ 已更新章节 [{section}] 在 [{file}]"
        
        return f"✗ 不支持的模式: {mode}"
    
    except ValueError as e:
        # 路径安全错误
        return f"✗ {str(e)}"
    except Exception as e:
        logger.error(f"memory_write 工具执行失败: {e}")
        return f"✗ 写入失败: {str(e)}"


@tool
def memory_search(
    query: str,
    file: Optional[str] = None,
    limit: int = 10,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """搜索固定记忆目录中的内容。

    常见用法：
    - 全局搜索：`memory_search(query="创业项目")`
    - 单文件搜索：`memory_search(query="创业", file="memory_stream")`
    """
    try:
        if not runtime or not runtime.context:
            return "✗ 系统错误：Context 未配置"
        
        character_id = runtime.context.character_id
        root = _get_memory_root(character_id)
        
        # 确定搜索范围
        if file:
            files_to_search = [_resolve_path(character_id, file)]
        else:
            # 搜索所有 .md 文件
            files_to_search = list(root.rglob("*.md"))
        
        results = []
        for file_path in files_to_search:
            if not file_path.exists():
                continue
            
            content = file_path.read_text(encoding="utf-8")
            lines = content.split("\n")
            
            # 搜索匹配行
            for i, line in enumerate(lines, 1):
                if query.lower() in line.lower():
                    # 获取相对路径
                    rel_path = file_path.relative_to(root)
                    results.append(f"[{rel_path} :: Line {i}]\n{line.strip()}")
                    
                    if len(results) >= limit:
                        break
            
            if len(results) >= limit:
                break
        
        if not results:
            return f"未找到包含 '{query}' 的内容"
        
        return f"找到 {len(results)} 条结果:\n\n" + "\n\n".join(results)
    
    except ValueError as e:
        # 路径安全错误
        return f"✗ {str(e)}"
    except Exception as e:
        logger.error(f"memory_search 工具执行失败: {e}")
        return f"✗ 搜索失败: {str(e)}"


@tool
def memory_list(
    file: Optional[str] = None,
    runtime: ToolRuntime[AgentContext] = None
) -> str:
    """列出固定记忆目录中的文件或章节。

    常见用法：
    - `memory_list()`
    - `memory_list(file="user_profile")`
    """
    try:
        if not runtime or not runtime.context:
            return "✗ 系统错误：Context 未配置"
        
        character_id = runtime.context.character_id
        root = _get_memory_root(character_id)
        
        # 模式 1: 列出所有文件
        if not file:
            files = list(root.rglob("*.md"))
            if not files:
                return "暂无记忆文件"
            
            rel_paths = [f.relative_to(root) for f in files]
            return "记忆文件:\n" + "\n".join(f"- {p}" for p in rel_paths)
        
        # 模式 2: 列出文件的章节
        file_path = _resolve_path(character_id, file)
        if not file_path.exists():
            return f"✗ 文件 [{file}] 不存在"
        
        content = file_path.read_text(encoding="utf-8")
        
        # 提取章节
        import re
        sections = re.findall(r"## \[(.+?)\]", content)
        
        if not sections:
            return f"[{file}] 无章节"
        
        return f"[{file}] 章节:\n" + "\n".join(f"- {s}" for s in sections)
    
    except ValueError as e:
        # 路径安全错误
        return f"✗ {str(e)}"
    except Exception as e:
        logger.error(f"memory_list 工具执行失败: {e}")
        return f"✗ 列出失败: {str(e)}"


# ==================== 工具导出 ====================

def get_memory_tools_v3():
    """获取记忆工具 V3 列表"""
    return [
        memory_read,
        memory_write,
        memory_search,
        memory_list,
    ]
