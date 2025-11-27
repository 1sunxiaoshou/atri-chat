# FastAPI 接口文档

## 系统架构

本系统采用 **RESTful + 分层路由 + 依赖注入** 的设计方式，将功能分为以下几个模块：

```
/api/v1/
├── /health              # 健康检查
├── /providers           # 供应商管理
├── /models              # 模型管理
├── /tts                 # TTS管理
├── /characters          # 角色管理
├── /conversations       # 会话管理
└── /messages            # 消息处理
```

### 依赖注入架构

系统使用 FastAPI 的依赖注入机制管理核心组件：

- **`AppStorage`**: 应用数据存储（角色、会话、消息等）
- **`SqliteStore`**: 长期记忆存储（跨会话数据）
- **`SqliteSaver`**: 检查点存储（对话历史）
- **`AgentManager`**: Agent 业务逻辑管理器

所有组件通过 `@lru_cache()` 实现单例模式，确保全局唯一且线程安全。

## 快速开始

### 1. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 2. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API 端点详解

### 健康检查

#### GET /api/v1/health
检查系统是否正常运行

**响应示例：**
```json
{
  "code": 200,
  "message": "系统正常运行",
  "data": {
    "status": "healthy"
  }
}
```

---

### 供应商管理

#### POST /api/v1/providers
创建供应商配置

**请求体：**
```json
{
  "provider_id": "openai",
  "config_json": {
    "api_key": "sk-xxx",
    "base_url": "https://api.openai.com/v1",
    "temperature": 0.7
  }
}
```

#### GET /api/v1/providers
列出所有供应商

#### GET /api/v1/providers/{provider_id}
获取指定供应商配置

#### PUT /api/v1/providers/{provider_id}
更新供应商配置

#### DELETE /api/v1/providers/{provider_id}
删除供应商配置

---

### 模型管理

#### POST /api/v1/models
创建模型

**请求体：**
```json
{
  "provider_id": "openai",
  "model_id": "gpt-4",
  "model_type": "text",
  "mode": "chat",
  "enabled": true
}
```

#### GET /api/v1/models
列出模型（支持过滤）

**查询参数：**
- `provider_id` (可选): 供应商ID
- `model_type` (可选): 模型类型 (text, embedding)
- `enabled_only` (可选): 仅显示启用的模型 (默认: true)

#### GET /api/v1/models/{provider_id}/{model_id}
获取指定模型

#### PUT /api/v1/models/{provider_id}/{model_id}
更新模型

#### DELETE /api/v1/models/{provider_id}/{model_id}
删除模型

---

### TTS 管理

#### POST /api/v1/tts
创建TTS

**请求体：**
```json
{
  "tts_id": "default-tts",
  "provider_id": "gpt_sovits",
  "voice_role": "female",
  "api_key": null,
  "access_url": "http://localhost:9880",
  "enabled": true
}
```

#### GET /api/v1/tts
列出TTS

**查询参数：**
- `provider_id` (可选): 供应商ID
- `enabled_only` (可选): 仅显示启用的 (默认: true)

#### GET /api/v1/tts/{tts_id}
获取指定TTS

#### PUT /api/v1/tts/{tts_id}
更新TTS

#### DELETE /api/v1/tts/{tts_id}
删除TTS

---

### 角色管理

#### POST /api/v1/characters
创建角色

**请求体：**
```json
{
  "name": "小助手",
  "description": "一个友好的AI助手",
  "system_prompt": "你是一个友好、专业的AI助手。",
  "primary_model_id": "gpt-4",
  "primary_provider_id": "openai",
  "tts_id": "default-tts",
  "enabled": true
}
```

#### GET /api/v1/characters
列出角色

**查询参数：**
- `enabled_only` (可选): 仅显示启用的角色 (默认: true)

#### GET /api/v1/characters/{character_id}
获取指定角色

#### PUT /api/v1/characters/{character_id}
更新角色

#### DELETE /api/v1/characters/{character_id}
删除角色

---

### 会话管理

#### POST /api/v1/conversations
创建会话

**请求体：**
```json
{
  "character_id": 1,
  "title": "我的第一个对话"
}
```

#### GET /api/v1/conversations
列出会话

**查询参数：**
- `character_id` (可选): 角色ID

#### GET /api/v1/conversations/{conversation_id}
获取指定会话

#### PUT /api/v1/conversations/{conversation_id}
更新会话

**请求体：**
```json
{
  "title": "新的标题"
}
```

#### DELETE /api/v1/conversations/{conversation_id}
删除会话

#### POST /api/v1/conversations/{conversation_id}/clear
清空会话历史

---

### 消息处理

#### POST /api/v1/messages/send
发送文本消息

**请求体：**
```json
{
  "conversation_id": 1,
  "character_id": 1,
  "model_id": "gpt-4",
  "provider_id": "openai",
  "content": "你好，请介绍一下你自己"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "消息发送成功",
  "data": {
    "response": "你好！我是一个AI助手..."
  }
}
```

#### GET /api/v1/conversations/{conversation_id}/history
获取会话历史

**查询参数：**
- `from_checkpoint` (可选): 是否从检查点获取 (默认: false)

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "conversation_id": 1,
    "messages": [
      {
        "message_id": 1,
        "conversation_id": 1,
        "message_type": "user",
        "content": "你好",
        "created_at": "2024-01-01T10:00:00"
      },
      {
        "message_id": 2,
        "conversation_id": 1,
        "message_type": "assistant",
        "content": "你好！有什么我可以帮助的吗？",
        "created_at": "2024-01-01T10:00:01"
      }
    ]
  }
}
```

#### POST /api/v1/messages/audio
发送音频消息

**请求参数：**
- `conversation_id` (必需): 会话ID
- `character_id` (必需): 角色ID
- `model_id` (必需): 模型ID
- `provider_id` (必需): 供应商ID
- `file` (必需): 音频文件
- `asr_provider` (可选): ASR提供商
- `language` (可选): 语言代码

#### POST /api/v1/tts/synthesize
文本转语音

**请求体：**
```json
{
  "text": "你好，这是一个测试",
  "tts_provider": "gpt_sovits",
  "language": "zh"
}
```

---

### 缓存管理

#### GET /api/v1/cache/info
获取缓存信息

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "cached_agents": 2,
    "cache_keys": [
      {
        "character_id": 1,
        "model_id": "gpt-4",
        "provider_id": "openai"
      }
    ]
  }
}
```

#### POST /api/v1/cache/clear
清空Agent缓存

**请求体：**
```json
{
  "character_id": null
}
```

如果 `character_id` 为 null，则清空所有缓存；否则只清空指定角色的缓存。

---

## 使用流程示例

### 完整的对话流程

1. **创建供应商配置**
   ```bash
   curl -X POST http://localhost:8000/api/v1/providers \
     -H "Content-Type: application/json" \
     -d '{
       "provider_id": "openai",
       "config_json": {"api_key": "sk-xxx", "base_url": "https://api.openai.com/v1"}
     }'
   ```

2. **创建模型**
   ```bash
   curl -X POST http://localhost:8000/api/v1/models \
     -H "Content-Type: application/json" \
     -d '{
       "provider_id": "openai",
       "model_id": "gpt-4",
       "model_type": "text",
       "mode": "chat",
       "enabled": true
     }'
   ```

3. **创建TTS**
   ```bash
   curl -X POST http://localhost:8000/api/v1/tts \
     -H "Content-Type: application/json" \
     -d '{
       "tts_id": "default-tts",
       "provider_id": "gpt_sovits",
       "voice_role": "female",
       "enabled": true
     }'
   ```

4. **创建角色**
   ```bash
   curl -X POST http://localhost:8000/api/v1/characters \
     -H "Content-Type: application/json" \
     -d '{
       "name": "小助手",
       "description": "一个友好的AI助手",
       "system_prompt": "你是一个友好、专业的AI助手。",
       "primary_model_id": "gpt-4",
       "primary_provider_id": "openai",
       "tts_id": "default-tts"
     }'
   ```

5. **创建会话**
   ```bash
   curl -X POST http://localhost:8000/api/v1/conversations \
     -H "Content-Type: application/json" \
     -d '{
       "character_id": 1,
       "title": "我的第一个对话"
     }'
   ```

6. **发送消息**
   ```bash
   curl -X POST http://localhost:8000/api/v1/messages/send \
     -H "Content-Type: application/json" \
     -d '{
       "conversation_id": 1,
       "character_id": 1,
       "model_id": "gpt-4",
       "provider_id": "openai",
       "content": "你好，请介绍一下你自己"
     }'
   ```

7. **获取会话历史**
   ```bash
   curl http://localhost:8000/api/v1/conversations/1/history
   ```

---

## 错误处理

所有错误响应都遵循以下格式：

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

常见的HTTP状态码：
- `200`: 成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器错误

---

## 性能优化

### Agent缓存

系统会自动缓存Agent实例，避免重复创建。缓存键为 `(character_id, model_id, provider_id)`。

当角色配置更新时，会自动清空该角色的缓存。

### 会话历史

- 消息存储在 `AppStorage` 中（用于UI展示）
- 对话历史存储在 `SqliteSaver` 中（用于Agent上下文）

可以通过 `from_checkpoint` 参数选择获取方式。

---

## 依赖注入详解

### 核心依赖

系统在 `core/dependencies.py` 中定义了以下依赖：

```python
from functools import lru_cache
from core.storage import AppStorage
from core.agent_manager import AgentManager

@lru_cache()
def get_app_storage() -> AppStorage:
    """获取 AppStorage 单例"""
    return AppStorage(db_path="data/app.db")

@lru_cache()
def get_agent_manager() -> AgentManager:
    """获取 AgentManager 单例"""
    return AgentManager(
        app_storage=get_app_storage(),
        store=get_store(),
        checkpointer=get_checkpointer()
    )
```

### 在路由中使用

```python
from fastapi import Depends
from core.dependencies import get_storage, get_agent

@router.post("/messages/send")
async def send_message(
    req: MessageRequest,
    agent_manager: AgentManager = Depends(get_agent)
):
    response = agent_manager.send_message(...)
    return ResponseModel(data={"response": response})
```

### 优势

1. **单例保证**: 使用 `@lru_cache()` 确保全局唯一实例
2. **线程安全**: 自动处理并发访问
3. **易于测试**: 可以轻松 mock 依赖进行单元测试
4. **清晰明确**: 每个函数明确声明需要的依赖
5. **符合最佳实践**: FastAPI 官方推荐的方式

---

## 扩展建议

1. **认证与授权**: 添加JWT认证（可作为依赖注入）
2. **速率限制**: 使用 `slowapi` 库
3. **日志记录**: 集成 `structlog` 或 `loguru`
4. **异步处理**: 使用 `Celery` 处理长时间运行的任务
5. **WebSocket**: 支持实时消息推送
6. **依赖覆盖**: 在测试中使用 `app.dependency_overrides` 替换依赖
