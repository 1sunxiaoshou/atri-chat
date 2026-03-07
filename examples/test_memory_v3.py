"""测试记忆系统 V3

使用方法:
    uv run python examples/test_memory_v3.py
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.tools.memory_tools_v3 import (
    memory_read,
    memory_write,
    memory_search,
    memory_list,
    _get_memory_root
)
from core.middleware import AgentContext


class MockRuntime:
    """模拟 Runtime"""
    def __init__(self, character_id: str):
        self.context = AgentContext(
            character_id=character_id,
            enable_vrm=False,
            model_id="test",
            provider_id="test",
            model_kwargs={},
            db_session=None,
            model_service=None,
            prompt_manager=None
        )


def test_memory_system():
    """测试记忆系统"""
    print("=" * 60)
    print("记忆系统 V3 测试")
    print("=" * 60)
    
    # 使用测试角色 ID
    test_character_id = "test-character-001"
    runtime = MockRuntime(test_character_id)
    
    print(f"\n测试角色 ID: {test_character_id}")
    print(f"记忆目录: {_get_memory_root(test_character_id)}")
    
    # 测试 1: 列出文件
    print("\n" + "-" * 60)
    print("测试 1: 列出所有文件")
    print("-" * 60)
    result = memory_list.invoke({"runtime": runtime})
    print(result)
    
    # 测试 2: 读取用户档案
    print("\n" + "-" * 60)
    print("测试 2: 读取用户档案")
    print("-" * 60)
    result = memory_read.invoke({"file": "user_profile", "runtime": runtime})
    print(result[:200] + "...")
    
    # 测试 3: 更新档案章节
    print("\n" + "-" * 60)
    print("测试 3: 更新档案章节（模拟用户提供信息）")
    print("-" * 60)
    result = memory_write.invoke({
        "file": "user_profile",
        "section": "Basic Info",
        "content": "- Name: 测试用户\n- Career: AI 研究员\n- Location: 北京",
        "mode": "replace",
        "runtime": runtime
    })
    print(result)
    
    result = memory_write.invoke({
        "file": "user_profile",
        "section": "Preferences",
        "content": "- Food: 喜欢川菜，不吃香菜\n- Hobbies: 编程、阅读科幻小说",
        "mode": "replace",
        "runtime": runtime
    })
    print(result)
    
    # 测试 4: 读取更新后的章节
    print("\n" + "-" * 60)
    print("测试 4: 读取更新后的章节")
    print("-" * 60)
    result = memory_read.invoke({
        "file": "user_profile",
        "section": "Basic Info",
        "runtime": runtime
    })
    print(result)
    
    # 测试 5: 记录事件
    print("\n" + "-" * 60)
    print("测试 5: 记录事件")
    print("-" * 60)
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    result = memory_write.invoke({
        "file": "memory_stream",
        "content": f"- [{timestamp}] (Test) 测试记忆系统 V3",
        "mode": "append",
        "runtime": runtime
    })
    print(result)
    
    result = memory_write.invoke({
        "file": "memory_stream",
        "content": f"- [{timestamp}] (Chat) 用户询问记忆系统如何工作",
        "mode": "append",
        "runtime": runtime
    })
    print(result)
    
    # 测试 6: 读取最近事件
    print("\n" + "-" * 60)
    print("测试 6: 读取最近事件")
    print("-" * 60)
    result = memory_read.invoke({
        "file": "memory_stream",
        "tail_lines": 5,
        "runtime": runtime
    })
    print(result)
    
    # 测试 7: 搜索记忆
    print("\n" + "-" * 60)
    print("测试 7: 搜索记忆")
    print("-" * 60)
    result = memory_search.invoke({
        "query": "测试",
        "runtime": runtime
    })
    print(result)
    
    # 测试 8: 创建话题摘要
    print("\n" + "-" * 60)
    print("测试 8: 创建话题摘要")
    print("-" * 60)
    result = memory_write.invoke({
        "file": "topics",
        "section": "Topic: 记忆系统",
        "content": "- **设计理念**: 简洁、统一、灵活\n- **核心工具**: read, write, search, list\n- **特点**: 支持相对路径，AI 可自主管理",
        "mode": "replace",
        "runtime": runtime
    })
    print(result)
    
    # 测试 9: 列出话题
    print("\n" + "-" * 60)
    print("测试 9: 列出话题")
    print("-" * 60)
    result = memory_list.invoke({
        "file": "topics",
        "runtime": runtime
    })
    print(result)
    
    # 测试 10: 创建归档文件（测试相对路径）
    print("\n" + "-" * 60)
    print("测试 10: 创建归档文件（相对路径）")
    print("-" * 60)
    result = memory_write.invoke({
        "file": "archive/2026_Q1",
        "content": f"- [{timestamp}] (Archive) 这是一条归档记录",
        "mode": "append",
        "runtime": runtime
    })
    print(result)
    
    # 测试 11: 列出所有文件（包括归档）
    print("\n" + "-" * 60)
    print("测试 11: 列出所有文件")
    print("-" * 60)
    result = memory_list.invoke({"runtime": runtime})
    print(result)
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print(f"\n请检查目录: {_get_memory_root(test_character_id)}")


if __name__ == "__main__":
    test_memory_system()


    # 测试 12: 验证自动加载功能
    print("\n" + "-" * 60)
    print("测试 12: 验证自动加载功能")
    print("-" * 60)
    from core.middleware.load_memory import load_user_profile, _has_meaningful_content
    
    # 读取档案
    profile_path = _get_memory_root(test_character_id) / "user_profile.md"
    profile_content = profile_path.read_text(encoding="utf-8")
    
    # 检查是否有实际内容
    has_content = _has_meaningful_content(profile_content)
    print(f"档案是否有实际内容: {has_content}")
    
    if has_content:
        print("\n✓ 档案有实际内容，会被自动加载到对话上下文中")
    else:
        print("\n✗ 档案为空或只有模板，不会被加载")
    
    print("\n档案内容预览:")
    print(profile_content[:300] + "...")
