# AgentManager 使用指南

## 概述

`AgentManager` 是 ATRI 系统的业务逻辑管理核心，负责管理 Agent 实例的生命周期、处理消息发送、会话切换等业务逻辑。

## 核心特性

- **Agent 实例管理**：自动缓存和复用 Agent 实例
- **对话历史持久化**：基于 LangGraph 的检查点机制
- **会话隔离**：不同会话之间的对话历史完全隔离
- **双存储架构**：
  - `AppStorage`：存储业务数据（角色、会话、消息列表）
  - `SqliteSaver`：存储检查点（对话历史，用于 Agent 恢复）
  - `SqliteStore`：存储长期记忆（跨会话数据）

## 快速开始

### 1. 初始化

```python
import sqlite3
from core import AppStorage, AgentManager
from core.store import SqliteStore
from langgraph.checkpoint.sqlite import SqliteSaver

# 初始化存储
app_storage = AppStorage(db_path="data/app.db")
store = SqliteStore(db_path="data/store.db")

# 初始化检查点
conn = sqlite3.connect("data/checkpoints.db", check_same_thread=False)
checkpointer = SqliteSaver(conn)

# 创建 AgentManager
manager = AgentManager(
    app_storage=app_storage,
    store=store,
    checkpointer=checkpointer
)
```

### 2. 发送消息

```python
# 同步方式
response = manager.send_message(
    user_message="你好，请介绍一下你自己",
    conversation_id=1,
    character_id=1,
    model_id="qwen-plus",
    provider_id="openai"
)
print(response)

# 异步方式
response = await manager.send_message_async(
    user_message="你好，请介绍一下你自己",
    conversation_id=1,
    character_id=1,
    model_id="qwen-plus",
    provider_id="openai"
)
```

### 3. 切换会话

```python
# 切换到另一个会话
result = manager.switch_conversation(
    conversation_id=2,
    character_id=1,
    model_id="qwen-plus",
    provider_id="openai"
)
print(f"切换到会话: {result['title']}")

# 在新会话中发送消息
response = manager.send_message(
    user_message="这是新会话的第一条消息",
    conversation_id=2,
    character_id=1,
    model_id="qwen-plus",
    provider_id="openai"
)
```

### 4. 获取会话历史

```python
# 从 AppStorage 获取（用于 UI 展示）
messages = manager.get_conversation_history(
    conversation_id=1,
    from_checkpoint=False
)
for msg in messages:
    print(f"[{msg['message_type']}] {msg['content']}")

# 从 Checkpoint 获取（完整对话历史）
checkpoint_messages = manager.get_conversation_history(
    conversation_id=1,
    from_checkpoint=True
)
for msg in checkpoint_messages:
    print(f"[{msg['type']}] {msg['content']}")
```

### 5. 清空会话历史

```python
# 清空检查点和消息
result = manager.clear_conversation_history(
    conversation_id=1,
    clear_checkpoint=True,
    clear_messages=True
)
print(f"清空检查点: {result['checkpoint_cleared']}")
print(f"删除消息: {result['messages_deleted']} 条")
```

### 6. 管理 Agent 缓存

```python
# 查看缓存信息
cache_info = manager.get_cache_info()
print(f"缓存的 Agent 数量: {cache_info['cached_agents']}")

# 清空所有缓存
cleared = manager.clear_agent_cache()
print(f"清空了 {cleared} 个缓存")

# 只清空指定角色的缓存
cleared = manager.clear_agent_cache(character_id=1)
print(f"清空了角色 1 的 {cleared} 个缓存")
```

## 核心概念

### Agent 实例缓存

Agent 实例按 `(character_id, model_id, provider_id)` 缓存：

- **角色切换**：创建新 Agent 实例（因为 system_prompt 不同）
- **模型切换**：创建新 Agent 实例（因为底层模型不同）
- **会话切换**：复用现有 Agent 实例（只需更改 thread_id）

### Thread ID 映射

- `thread_id = str(conversation_id)`
- 每个会话对应一个独立的 thread
- LangGraph 的检查点机制自动管理每个 thread 的对话历史

### 双存储架构

#### AppStorage（业务数据）
- 角色配置（包含 system_prompt）
- 会话元数据（标题、创建时间等）
- 消息列表（用于 UI 展示、搜索）

#### SqliteSaver（检查点）
- 完整对话历史（包含中间状态）
- Agent 状态恢复
- 自动管理，无需手动操作

#### SqliteStore（长期记忆）
- 跨会话的用户数据
- 用户偏好设置
- 持久化的知识库

## 最佳实践

### 1. 错误处理

```python
try:
    response = manager.send_message(
        user_message="你好",
        conversation_id=1,
        character_id=1,
        model_id="qwen-plus",
        provider_id="openai"
    )
except ValueError as e:
    print(f"参数错误: {e}")
except Exception as e:
    print(f"发送消息失败: {e}")
```

### 2. 配置更新后清空缓存

```python
# 更新角色的 system_prompt 后
app_storage.update_character(
    character_id=1,
    system_prompt="新的系统提示"
)

# 清空该角色的缓存，强制重新创建 Agent
manager.clear_agent_cache(character_id=1)
```

### 3. 会话管理

```python
# 创建新会话
conversation_id = app_storage.create_conversation(
    character_id=1,
    title="新会话"
)

# 切换到新会话
manager.switch_conversation(
    conversation_id=conversation_id,
    character_id=1,
    model_id="qwen-plus",
    provider_id="openai"
)

# 在新会话中对话
response = manager.send_message(
    user_message="你好",
    conversation_id=conversation_id,
    character_id=1,
    model_id="qwen-plus",
    provider_id="openai"
)
```

### 4. 异步处理

```python
import asyncio

async def chat_async():
    response = await manager.send_message_async(
        user_message="你好",
        conversation_id=1,
        character_id=1,
        model_id="qwen-plus",
        provider_id="openai"
    )
    return response

# 运行异步任务
response = asyncio.run(chat_async())
```

## 架构图

```
AgentManager
├── 依赖
│   ├── AppStorage (角色、会话、消息)
│   ├── SqliteStore (长期记忆)
│   ├── SqliteSaver (检查点)
│   └── ModelFactory (模型实例化)
│
├── Agent 缓存
│   └── {(character_id, model_id, provider_id): agent}
│
└── 核心方法
    ├── get_or_create_agent() - 获取/创建 Agent
    ├── send_message() - 发送消息（同步）
    ├── send_message_async() - 发送消息（异步）
    ├── switch_conversation() - 切换会话
    ├── get_conversation_history() - 获取历史
    ├── clear_conversation_history() - 清空历史
    ├── clear_agent_cache() - 清空缓存
    └── get_cache_info() - 获取缓存信息
```

## 数据流

```
用户发送消息
    ↓
manager.send_message()
    ↓
检测配置 → [需要新实例] → 创建并缓存 Agent
    ↓              ↓
    ↓         [已缓存] → 复用 Agent
    ↓              ↓
agent.invoke(messages, config={"thread_id": conversation_id})
    ↓
[自动] SqliteSaver 保存检查点
    ↓
[手动] AppStorage.add_message() × 2
    ↓
返回响应
```

## 常见问题

### Q: 为什么需要双存储？

A: 
- **AppStorage**：用于 UI 展示、搜索、统计等业务需求
- **SqliteSaver**：用于 Agent 状态恢复，包含完整的对话历史和中间状态

### Q: 会话切换时需要重新创建 Agent 吗？

A: 不需要。会话切换只需要更改 `thread_id`，Agent 实例可以复用。

### Q: 什么时候需要清空缓存？

A: 
- 角色的 `system_prompt` 更新后
- 模型配置更新后
- 供应商配置更新后

### Q: 如何实现流式输出？

A: 使用 `agent.stream()` 方法：

```python
agent = manager.get_or_create_agent(character_id, model_id, provider_id)

for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "你好"}]},
    config={"configurable": {"thread_id": str(conversation_id)}}
):
    print(chunk)
```

## 参考

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [LangChain Agent 文档](https://python.langchain.com/docs/modules/agents/)
- [检查点机制](https://langchain-ai.github.io/langgraph/concepts/persistence/)
