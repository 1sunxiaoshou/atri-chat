# 模型管理 API 文档

## 概述

模型管理系统采用分层设计，将模型分为两个维度：

- **model_type**: 模型的功能分类（text、embedding、rerank）
- **capabilities**: 模型的能力列表（base、chat、vision、function_calling）

这样的设计提供了更灵活的模型管理方式。

## 数据模型

### ModelType（模型类型）

按功能分类：

| 类型 | 说明 |
|------|------|
| `text` | 文本模型（LLM、Chat 等） |
| `embedding` | 嵌入模型（向量化） |
| `rerank` | 重排模型（排序） |

### Capability（模型能力）

按能力分类：

| 能力 | 说明 |
|------|------|
| `base` | 基础能力（默认） |
| `chat` | 对话能力 |
| `vision` | 视觉/多模态能力 |
| `function_calling` | 函数调用能力 |

### 模型配置对象

```json
{
  "provider_id": "openai",
  "model_id": "gpt-4",
  "model_type": "text",
  "capabilities": ["base", "chat", "vision"],
  "enabled": true
}
```

## API 端点

### 1. 创建模型

**请求**

```http
POST /models
Content-Type: application/json

{
  "provider_id": "openai",
  "model_id": "gpt-4",
  "model_type": "text",
  "capabilities": ["base", "chat", "vision"],
  "enabled": true
}
```

**参数说明**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| provider_id | string | ✓ | 供应商ID |
| model_id | string | ✓ | 模型ID |
| model_type | string | ✓ | 模型类型：text、embedding、rerank |
| capabilities | array | ✗ | 能力列表，默认为 ["base"] |
| enabled | boolean | ✗ | 是否启用，默认为 true |

**响应**

```json
{
  "code": 200,
  "message": "模型创建成功",
  "data": {
    "provider_id": "openai",
    "model_id": "gpt-4"
  }
}
```

**错误响应**

```json
{
  "code": 400,
  "message": "模型已存在",
  "data": null
}
```

---

### 2. 获取模型

**请求**

```http
GET /models/{provider_id}/{model_id}
```

**路径参数**

| 参数 | 说明 |
|------|------|
| provider_id | 供应商ID |
| model_id | 模型ID |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "provider_id": "openai",
    "model_id": "gpt-4",
    "model_type": "text",
    "capabilities": ["base", "chat", "vision"],
    "enabled": true
  }
}
```

---

### 3. 列出模型

**请求**

```http
GET /models?provider_id=openai&model_type=text&enabled_only=true
```

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| provider_id | string | 供应商ID（可选） |
| model_type | string | 模型类型：text、embedding、rerank（可选） |
| enabled_only | boolean | 仅显示启用的模型，默认为 true |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "provider_id": "openai",
      "model_id": "gpt-4",
      "model_type": "text",
      "capabilities": ["base", "chat", "vision"],
      "enabled": true
    },
    {
      "provider_id": "openai",
      "model_id": "gpt-3.5-turbo",
      "model_type": "text",
      "capabilities": ["base", "chat"],
      "enabled": true
    }
  ]
}
```

---

### 4. 更新模型

**请求**

```http
PUT /models/{provider_id}/{model_id}
Content-Type: application/json

{
  "provider_id": "openai",
  "model_id": "gpt-4",
  "model_type": "text",
  "capabilities": ["base", "chat", "vision", "function_calling"],
  "enabled": true
}
```

**路径参数**

| 参数 | 说明 |
|------|------|
| provider_id | 供应商ID |
| model_id | 模型ID |

**请求体**

同创建模型的请求体

**响应**

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "provider_id": "openai",
    "model_id": "gpt-4"
  }
}
```

---

### 5. 删除模型

**请求**

```http
DELETE /models/{provider_id}/{model_id}
```

**路径参数**

| 参数 | 说明 |
|------|------|
| provider_id | 供应商ID |
| model_id | 模型ID |

**响应**

```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "provider_id": "openai",
    "model_id": "gpt-4"
  }
}
```

---

## 使用示例

### 创建一个支持多模态的 GPT-4 模型

```bash
curl -X POST http://localhost:8000/models \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "openai",
    "model_id": "gpt-4",
    "model_type": "text",
    "capabilities": ["base", "chat", "vision"],
    "enabled": true
  }'
```

### 创建一个嵌入模型

```bash
curl -X POST http://localhost:8000/models \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "openai",
    "model_id": "text-embedding-3-large",
    "model_type": "embedding",
    "capabilities": ["base"],
    "enabled": true
  }'
```

### 查询所有启用的文本模型

```bash
curl http://localhost:8000/models?model_type=text&enabled_only=true
```

### 查询特定供应商的所有模型

```bash
curl http://localhost:8000/models?provider_id=openai
```

### 更新模型能力

```bash
curl -X PUT http://localhost:8000/models/openai/gpt-4 \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "openai",
    "model_id": "gpt-4",
    "model_type": "text",
    "capabilities": ["base", "chat", "vision", "function_calling"],
    "enabled": true
  }'
```

---

## 供应商管理 API

### 1. 创建供应商

**请求**

```http
POST /providers
Content-Type: application/json

{
  "provider_id": "openai",
  "config_json": {
    "api_key": "sk-...",
    "base_url": "https://api.openai.com/v1",
    "temperature": 0.7,
    "max_tokens": 2000
  }
}
```

**响应**

```json
{
  "code": 200,
  "message": "供应商创建成功",
  "data": {
    "provider_id": "openai"
  }
}
```

---

### 2. 获取供应商

**请求**

```http
GET /providers/{provider_id}
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "provider_id": "openai",
    "config_json": {
      "api_key": "sk-...",
      "base_url": "https://api.openai.com/v1",
      "temperature": 0.7,
      "max_tokens": 2000
    }
  }
}
```

---

### 3. 列出所有供应商

**请求**

```http
GET /providers
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "provider_id": "openai",
      "config_json": { ... }
    },
    {
      "provider_id": "anthropic",
      "config_json": { ... }
    }
  ]
}
```

---

### 4. 更新供应商

**请求**

```http
PUT /providers/{provider_id}
Content-Type: application/json

{
  "provider_id": "openai",
  "config_json": {
    "api_key": "sk-new-key",
    "base_url": "https://api.openai.com/v1",
    "temperature": 0.8,
    "max_tokens": 3000
  }
}
```

**响应**

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "provider_id": "openai"
  }
}
```

---

### 5. 删除供应商

**请求**

```http
DELETE /providers/{provider_id}
```

**响应**

```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "provider_id": "openai"
  }
}
```

---

## 最佳实践

### 1. 模型能力组合

根据实际需求选择合适的能力组合：

```json
{
  "gpt-4": ["base", "chat", "vision", "function_calling"],
  "gpt-3.5-turbo": ["base", "chat", "function_calling"],
  "text-embedding-3-large": ["base"],
  "bge-reranker-large": ["base"]
}
```

### 2. 供应商配置

为每个供应商配置必要的认证信息和默认参数：

```json
{
  "provider_id": "openai",
  "config_json": {
    "api_key": "sk-...",
    "base_url": "https://api.openai.com/v1",
    "temperature": 0.7,
    "max_tokens": 2000,
    "timeout": 30
  }
}
```

### 3. 模型查询

使用查询参数高效地获取所需模型：

```bash
# 获取所有启用的文本模型
GET /models?model_type=text&enabled_only=true

# 获取特定供应商的所有模型
GET /models?provider_id=openai

# 获取特定供应商的嵌入模型
GET /models?provider_id=openai&model_type=embedding
```

---

## 错误处理

所有 API 端点都遵循统一的错误响应格式：

```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

常见错误码：

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误或资源已存在 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
