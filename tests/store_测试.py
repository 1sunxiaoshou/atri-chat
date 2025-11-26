"""SQLite Store 测试"""

import sys
import os
from pathlib import Path
import uuid

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.store import SqliteStore


def test_basic_operations():
    """测试基本操作"""
    print("=== 测试基本操作 ===\n")
    
    # 创建 Store
    store = SqliteStore(db_path="data/test_store.db")
    
    # 定义用户命名空间
    user_id = "user_123"
    namespace = (user_id, "memories")
    
    # 1. 存储用户偏好
    print("1. 存储用户偏好")
    memory_id_1 = str(uuid.uuid4())
    store.put(namespace, memory_id_1, {
        "food_preference": "I like pizza",
        "type": "preference"
    })
    print(f"   存储偏好: {memory_id_1}")
    
    # 2. 存储用户历史
    print("\n2. 存储用户历史")
    memory_id_2 = str(uuid.uuid4())
    store.put(namespace, memory_id_2, {
        "previous_topics": ["AI", "LangGraph", "Python"],
        "type": "history"
    })
    print(f"   存储历史: {memory_id_2}")
    
    # 3. 存储用户信息
    print("\n3. 存储用户信息")
    memory_id_3 = str(uuid.uuid4())
    store.put(namespace, memory_id_3, {
        "expertise_level": "intermediate",
        "communication_style": "formal",
        "type": "profile"
    })
    print(f"   存储信息: {memory_id_3}")
    
    # 4. 检索单个项
    print("\n4. 检索单个项")
    item = store.get(namespace, memory_id_1)
    if item:
        print(f"   键: {item.key}")
        print(f"   值: {item.value}")
        print(f"   创建时间: {item.created_at}")
    
    # 5. 列出命名空间中的所有项
    print("\n5. 列出命名空间中的所有项")
    items = store.list_namespace(namespace)
    print(f"   总共 {len(items)} 项:")
    for item in items:
        print(f"     - {item.key}: {item.value}")
    
    # 6. 搜索项
    print("\n6. 搜索项")
    search_results = store.search(namespace, query="pizza", limit=5)
    print(f"   搜索 'pizza' 结果: {len(search_results)} 项")
    for item in search_results:
        print(f"     - {item.value}")
    
    # 7. 更新项
    print("\n7. 更新项")
    store.put(namespace, memory_id_1, {
        "food_preference": "I like pizza and pasta",
        "type": "preference",
        "updated": True
    })
    updated_item = store.get(namespace, memory_id_1)
    print(f"   更新后: {updated_item.value}")
    
    # 8. 删除项
    print("\n8. 删除项")
    deleted = store.delete(namespace, memory_id_2)
    print(f"   删除成功: {deleted}")
    
    # 9. 清空命名空间
    print("\n9. 清空命名空间")
    # 先创建新的命名空间用于测试
    test_namespace = (user_id, "temp")
    for i in range(3):
        store.put(test_namespace, f"key_{i}", {"data": f"value_{i}"})
    
    count = store.clear_namespace(test_namespace)
    print(f"   清空 {count} 项")
    
    remaining = store.list_namespace(test_namespace)
    print(f"   剩余项数: {len(remaining)}")


def test_multi_user_scenario():
    """测试多用户场景"""
    print("\n\n=== 测试多用户场景 ===\n")
    
    store = SqliteStore(db_path="data/test_store.db")
    
    # 为不同用户存储数据
    users = ["user_1", "user_2", "user_3"]
    
    print("1. 为多个用户存储数据")
    for user_id in users:
        namespace = (user_id, "memories")
        memory_id = str(uuid.uuid4())
        store.put(namespace, memory_id, {
            "user_id": user_id,
            "preference": f"User {user_id}'s preference",
            "created_for": user_id
        })
        print(f"   为 {user_id} 存储数据")
    
    # 检索特定用户的数据
    print("\n2. 检索特定用户的数据")
    user_1_namespace = ("user_1", "memories")
    user_1_items = store.list_namespace(user_1_namespace)
    print(f"   User 1 有 {len(user_1_items)} 项数据")
    for item in user_1_items:
        print(f"     - {item.value}")
    
    # 跨线程访问相同用户的数据
    print("\n3. 模拟跨线程访问")
    print("   线程 1 访问 user_1 数据:")
    thread1_items = store.search(user_1_namespace, limit=10)
    print(f"     找到 {len(thread1_items)} 项")
    
    print("   线程 2 访问 user_1 数据:")
    thread2_items = store.search(user_1_namespace, limit=10)
    print(f"     找到 {len(thread2_items)} 项")
    
    print("   数据一致性: ", thread1_items[0].value == thread2_items[0].value if thread1_items else "无数据")


def test_langgraph_integration():
    """测试与 LangGraph 的集成"""
    print("\n\n=== 测试 LangGraph 集成 ===\n")
    
    try:
        from langgraph.graph import StateGraph, START, END
        from langgraph.checkpoint.memory import InMemorySaver
        from typing_extensions import TypedDict
        
        store = SqliteStore(db_path="data/test_store.db")
        
        # 定义状态
        class State(TypedDict):
            messages: list
            user_id: str
        
        # 定义节点
        def node_a(state: State):
            return {"messages": state["messages"] + ["node_a"]}
        
        def node_b(state: State):
            # 在节点中访问 Store
            user_id = state["user_id"]
            namespace = (user_id, "memories")
            
            # 存储信息
            store.put(namespace, "last_node", {"node": "node_b", "timestamp": "now"})
            
            # 检索信息
            items = store.list_namespace(namespace)
            
            return {"messages": state["messages"] + [f"node_b (found {len(items)} memories)"]}
        
        # 构建图
        workflow = StateGraph(State)
        workflow.add_node("node_a", node_a)
        workflow.add_node("node_b", node_b)
        workflow.add_edge(START, "node_a")
        workflow.add_edge("node_a", "node_b")
        workflow.add_edge("node_b", END)
        
        # 编译图
        checkpointer = InMemorySaver()
        graph = workflow.compile(checkpointer=checkpointer, store=store)
        
        # 执行图
        print("1. 执行 LangGraph")
        config = {"configurable": {"thread_id": "1", "user_id": "user_123"}}
        result = graph.invoke({"messages": [], "user_id": "user_123"}, config)
        print(f"   执行结果: {result['messages']}")
        
        # 验证 Store 中的数据
        print("\n2. 验证 Store 中的数据")
        namespace = ("user_123", "memories")
        items = store.list_namespace(namespace)
        print(f"   Store 中有 {len(items)} 项数据")
        for item in items:
            print(f"     - {item.value}")
        
        print("\n✓ LangGraph 集成测试成功")
        
    except ImportError:
        print("⚠ LangGraph 未安装，跳过集成测试")


if __name__ == "__main__":
    test_basic_operations()
    test_multi_user_scenario()
    test_langgraph_integration()
    print("\n\n✓ 所有测试完成")
