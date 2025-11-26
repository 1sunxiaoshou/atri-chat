# 核心模块使用文档

## 概述

核心模块提供统一的数据存储和管理功能，包括：
- 模型供应商和 LLM 模型管理
- TTS 模型管理
- 虚拟角色管理
- 会话和消息管理

所有数据存储在一个 SQLite 数据库中，便于管理和查询。

## 快速开始

```python
from core import AppStorage, ModelConfig, ProviderConfig, ModelType, TextMode, ModelFactory

# 初始化存储
storage = AppStorage(db_path="data/app.db")

# 添加供应商
provider = ProviderConfig(
    provider_id="openai",
    config_json={"api_key": "sk-xxx"}
)
storage.add_provider(provider)

# 添加模型
model = ModelConfig(
    model_id="gpt-4",
    provider_id="openai",
    model_type=ModelType.TEXT,
    mode=TextMode.CHAT
)
storage.add_model(model)

# 创建模型实例
factory = ModelFactory(storage)
llm = factory.create_model("gpt-4", "openai")
```

## 模块结构

```
core/
├── storage.py           # 统一存储层
├── models/
│   ├── config.py       # 模型配置数据类
│   ├── factory.py      # 模型工厂
│   └── __init__.py
└── __init__.py
```

## API 文档

### AppStorage 类

统一的数据存储接口。

#### 初始化

```python
storage = AppStorage(db_path="data/app.db")
```

### 供应商管理

```python
# 添加供应商
provider = ProviderConfig(
    provider_id="openai",
    config_json={
        "api_key": "sk-xxx",
        "base_url": "https://api.openai.com/v1",
        "temperature": 0.7
    }
)
storage.add_provider(provider)

# 获取供应商
provider = storage.get_provider("openai")

# 列出所有供应商
providers = storage.list_providers()

# 更新供应商
provider.config_json["temperature"] = 0.5
storage.update_provider(provider)

# 删除供应商
storage.delete_provider("openai")
```

### 模型管理

```python
# 添加模型
model = ModelConfig(
    model_id="gpt-4",
    provider_id="openai",
    model_type=ModelType.TEXT,
    mode=TextMode.CHAT,
    enabled=True
)
storage.add_model(model)

# 获取模型
model = storage.get_model("openai", "gpt-4")

# 列出模型
all_models = storage.list_models()
openai_models = storage.list_models(provider_id="openai")
text_models = storage.list_models(model_type=ModelType.TEXT)

# 更新模型
model.enabled = False
storage.update_model(model)

# 删除模型
storage.delete_model("openai", "gpt-4")
```

### TTS 管理

```python
# 添加 TTS
storage.add_tts(
    tts_id="openai-tts-1",
    provider_id="openai",
    voice_role="alloy",
    api_key="sk-xxx",
    access_url="https://api.openai.com/v1/audio/speech"
)

# 获取 TTS
tts = storage.get_tts("openai-tts-1")

# 列出 TTS
all_tts = storage.list_tts()
openai_tts = storage.list_tts(provider_id="openai")

# 更新 TTS
storage.update_tts(
    tts_id="openai-tts-1",
    voice_role="nova",
    enabled=True
)

# 删除 TTS
storage.delete_tts("openai-tts-1")
```

### 角色管理

```python
# 添加角色
character_id = storage.add_character(
    name="AI助手",
    description="一个友好的AI助手",
    system_prompt="你是一个有帮助的AI助手",
    primary_model_id="gpt-4",
    primary_provider_id="openai",
    tts_id="openai-tts-1"
)

# 获取角色
character = storage.get_character(character_id)

# 列出角色
all_characters = storage.list_characters()
enabled_characters = storage.list_characters(enabled_only=True)

# 更新角色
storage.update_character(
    character_id=character_id,
    name="新名称",
    system_prompt="新的系统提示词"
)

# 删除角色
storage.delete_character(character_id)
```

### 会话管理

```python
# 创建会话
conversation_id = storage.create_conversation(
    character_id=1,
    title="测试会话"
)

# 获取会话
conversation = storage.get_conversation(conversation_id)

# 列出会话
all_conversations = storage.list_conversations()
character_conversations = storage.list_conversations(character_id=1)

# 更新会话
storage.update_conversation(
    conversation_id=conversation_id,
    title="新标题"
)

# 删除会话（同时删除关联消息）
storage.delete_conversation(conversation_id)
```

### 消息管理

```python
# 添加消息
msg_id = storage.add_message(
    conversation_id=1,
    message_type="user",  # user/assistant/system
    content="你好"
)

# 获取消息
message = storage.get_message(msg_id)

# 列出会话的所有消息
messages = storage.list_messages(conversation_id=1)

# 列出最近 N 条消息
recent_messages = storage.list_messages(conversation_id=1, limit=10)

# 删除消息
storage.delete_message(msg_id)

# 删除会话的所有消息
count = storage.delete_messages_by_conversation(conversation_id=1)
```

### 模型工厂

```python
from core import ModelFactory

# 创建工厂
factory = ModelFactory(storage)

# 创建模型实例
model = factory.create_model(
    model_id="gpt-4",
    provider_id="openai"
)

# 使用模型
if model:
    response = model.invoke("你好")
    print(response)
```

## 完整示例

```python
from core import AppStorage, ModelConfig, ProviderConfig, ModelType, TextMode, ModelFactory

# 1. 初始化
storage = AppStorage(db_path="data/app.db")

# 2. 配置供应商和模型
provider = ProviderConfig(
    provider_id="openai",
    config_json={"api_key": "sk-xxx"}
)
storage.add_provider(provider)

model = ModelConfig(
    model_id="gpt-4",
    provider_id="openai",
    model_type=ModelType.TEXT,
    mode=TextMode.CHAT
)
storage.add_model(model)

# 3. 配置 TTS
storage.add_tts(
    tts_id="openai-tts-1",
    provider_id="openai",
    voice_role="alloy"
)

# 4. 创建角色
character_id = storage.add_character(
    name="AI助手",
    description="友好的助手",
    system_prompt="你是一个有帮助的AI助手",
    primary_model_id="gpt-4",
    primary_provider_id="openai",
    tts_id="openai-tts-1"
)

# 5. 创建会话
conversation_id = storage.create_conversation(
    character_id=character_id,
    title="新会话"
)

# 6. 添加消息
storage.add_message(conversation_id, "user", "你好")
storage.add_message(conversation_id, "assistant", "你好！有什么可以帮助你的吗？")

# 7. 查询消息历史
messages = storage.list_messages(conversation_id)
for msg in messages:
    print(f"[{msg['message_type']}] {msg['content']}")

# 8. 使用模型
factory = ModelFactory(storage)
character = storage.get_character(character_id)
llm = factory.create_model(
    character["primary_model_id"],
    character["primary_provider_id"]
)
```

## 数据库结构

### provider_config 表
- provider_id (TEXT, PK): 供应商ID
- config_json (TEXT): 配置JSON

### models 表
- provider_id (TEXT, FK)
- model_id (TEXT)
- model_type (TEXT): text/embedding/rerank
- mode (TEXT): llm/chat/vision/dense
- enabled (BOOLEAN)
- PK: (provider_id, model_id)

### tts_models 表
- tts_id (TEXT, PK): TTS ID
- provider_id (TEXT): 供应商ID
- voice_role (TEXT): 语音角色
- api_key (TEXT): API Key
- access_url (TEXT): 访问URL
- enabled (BOOLEAN)

### characters 表
- character_id (INTEGER, PK, AUTOINCREMENT)
- name (TEXT): 角色名称
- description (TEXT): 角色描述
- system_prompt (TEXT): 系统提示词
- primary_model_id (TEXT, FK)
- primary_provider_id (TEXT, FK)
- tts_id (TEXT, FK)
- enabled (BOOLEAN)

### conversations 表
- conversation_id (INTEGER, PK, AUTOINCREMENT)
- character_id (INTEGER, FK)
- title (TEXT): 会话标题
- created_at (TEXT): 创建时间
- updated_at (TEXT): 更新时间

### messages 表
- message_id (INTEGER, PK, AUTOINCREMENT)
- conversation_id (INTEGER, FK)
- message_type (TEXT): user/assistant/system
- content (TEXT): 消息内容
- created_at (TEXT): 创建时间

## 最佳实践

1. **统一存储实例**：在应用中使用单例模式管理 AppStorage 实例
2. **事务处理**：对于需要原子性的操作，考虑使用数据库事务
3. **错误处理**：检查返回值，处理可能的 None 或 False
4. **消息分页**：使用 limit 参数避免一次加载过多消息
5. **定期清理**：定期清理旧会话和消息，避免数据库过大
