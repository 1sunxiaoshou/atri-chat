"""记忆系统迁移脚本：从 V1 (Store KV) 迁移到 V2 (Markdown 文档)

使用方法:
    uv run python scripts/migrate_memory_to_v2.py
"""
import sys
from pathlib import Path
from datetime import datetime

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.store import SqliteStore
from core.tools.memory_tools_v2 import (
    _get_memory_dir,
    _get_profile_path,
    _get_stream_path,
    _ensure_file_exists,
    PROFILE_TEMPLATE,
    STREAM_TEMPLATE
)


def migrate_character_memories(store: SqliteStore, character_id: str):
    """迁移单个角色的记忆"""
    print(f"\n迁移角色 {character_id} 的记忆...")
    
    # 获取该角色的所有记忆
    namespace = ("characters", str(character_id), "memories")
    items = store.list_namespace(namespace)
    
    if not items:
        print(f"  角色 {character_id} 没有记忆数据")
        return
    
    print(f"  找到 {len(items)} 条记忆")
    
    # 确保文件存在
    profile_path = _get_profile_path(character_id)
    stream_path = _get_stream_path(character_id)
    _ensure_file_exists(profile_path, PROFILE_TEMPLATE)
    _ensure_file_exists(stream_path, STREAM_TEMPLATE)
    
    # 分类处理记忆
    profile_updates = {}
    stream_events = []
    
    for item in items:
        value = item.value
        category = value.get("category", "general")
        content = value.get("content", "")
        created_at = value.get("created_at", datetime.now().isoformat())
        
        # 根据分类决定迁移目标
        if category == "preference":
            # 偏好 -> user_profile.md [Preferences]
            if "Preferences" not in profile_updates:
                profile_updates["Preferences"] = []
            profile_updates["Preferences"].append(f"- {content}")
        
        elif category == "fact":
            # 事实 -> user_profile.md [Basic Info] 或 memory_stream.md
            # 简单处理：都放到流水账
            timestamp = created_at[:16].replace("T", " ")  # YYYY-MM-DD HH:MM
            stream_events.append(f"- [{timestamp}] (Fact) {content}")
        
        elif category == "summary":
            # 摘要 -> memory_stream.md
            timestamp = created_at[:16].replace("T", " ")
            stream_events.append(f"- [{timestamp}] (Summary) {content}")
        
        else:
            # 其他 -> memory_stream.md
            timestamp = created_at[:16].replace("T", " ")
            stream_events.append(f"- [{timestamp}] ({category.capitalize()}) {content}")
    
    # 写入 user_profile.md
    if profile_updates:
        profile_content = profile_path.read_text(encoding="utf-8")
        for section, lines in profile_updates.items():
            section_content = "\n".join(lines)
            # 简单替换（实际应该用 rewrite_profile_section 的逻辑）
            import re
            pattern = rf"(## \[{section}\])(.*?)(?=\n## \[|\Z)"
            new_section = f"## [{section}]\n{section_content}\n"
            profile_content = re.sub(pattern, new_section, profile_content, flags=re.DOTALL)
        
        profile_path.write_text(profile_content, encoding="utf-8")
        print(f"  ✓ 已更新 user_profile.md ({len(profile_updates)} 个章节)")
    
    # 写入 memory_stream.md
    if stream_events:
        with open(stream_path, "a", encoding="utf-8") as f:
            f.write("\n".join(stream_events) + "\n")
        print(f"  ✓ 已追加 {len(stream_events)} 条事件到 memory_stream.md")


def main():
    """主函数"""
    print("=" * 60)
    print("记忆系统迁移工具 V1 -> V2")
    print("=" * 60)
    
    # 初始化 Store
    store = SqliteStore()
    
    # 获取所有角色的命名空间
    namespaces = store.list_namespaces(prefix=("characters",))
    
    # 提取角色 ID
    character_ids = set()
    for ns in namespaces:
        if len(ns) >= 3 and ns[2] == "memories":
            character_ids.add(ns[1])
    
    if not character_ids:
        print("\n未找到需要迁移的记忆数据")
        return
    
    print(f"\n找到 {len(character_ids)} 个角色需要迁移")
    
    # 迁移每个角色
    for character_id in character_ids:
        try:
            migrate_character_memories(store, character_id)
        except Exception as e:
            print(f"  ✗ 迁移失败: {e}")
    
    print("\n" + "=" * 60)
    print("迁移完成！")
    print("=" * 60)
    print("\n提示:")
    print("1. 请检查 data/memory/{character_id}/ 目录下的文件")
    print("2. 确认迁移正确后，可以删除旧的 Store 数据")
    print("3. 重启应用以使用新的记忆系统")


if __name__ == "__main__":
    main()
