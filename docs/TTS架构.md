# TTS 架构说明文档

## 概述

新的 TTS 架构采用三层设计：**供应商 (Provider) → 音色 (Voice) → 角色 (Character)**

这种设计将供应商级别的配置（如 API Key、服务地址）与具体的音色配置（如 voice_id、参考音频）分离，使得管理更加灵活和清晰。

**重构状态：✅ 已完成**
- TTSFactory 已迁移到 ORM
- 删除了旧的 TTSConfigService
- 所有 API 使用新的 ORM 模型
- 支持角色级别的音色绑定
- 配置分离清晰明确

---

## 配置分离说明

### 配置级别

TTS 配置分为两个级别：

1. **供应商级别（Provider）**
   - 存储位置：`TTSProvider.config_payload`
   - 内容：API 地址、API Key、认证信息等
   - 特点：一个供应商可以有多个音色

2. **音色级别（Voice）**
   - 存储位置：`VoiceAsset.voice_config`
   - 内容：参考音频、参考文本、语言设置、音色 ID 等
   - 特点：一个音色可以被多个角色使用

### 配置模板格式

每个 TTS 实现类提供配置模板，使用 `level` 字段标记配置级别：

```python
{
    "api_url": {
        "type": "string",
        "label": "API地址",
        "description": "服务地址",
        "required": True,
        "level": "provider"  # 供应商级别
    },
    "refer_wav_path": {
        "type": "file",
        "label": "参考音频",
        "description": "参考音频文件",
        "required": True,
        "level": "voice"  # 音色级别
    }
}
```

### 使用流程

1. **前端获取模板**
   ```
   GET /api/v1/tts-providers/types/{provider_type}/template
   ```

2. **前端根据 level 分离配置**
   - `level="provider"` → 创建/更新供应商时使用
   - `level="voice"` → 创建/更新音色时使用

3. **后端自动合并配置**
   ```python
   # 使用角色音色时
   config = {**provider.config_payload, **voice_asset.voice_config}
   tts = TTSFactory().create_tts(provider_type, config)
   ```

### 配置示例

**GPT-SoVITS 供应商配置：**
```json
{
  "api_url": "http://localhost:9880"
}
```

**GPT-SoVITS 音色配置：**
```json
{
  "refer_wav_path": "/path/to/reference.wav",
  "prompt_text": "参考文本内容",
  "prompt_language": "zh",
  "text_language": "zh"
}
```

---

## 架构层级

```
TTSProvider (供应商)
    ├── 供应商类型 (openai, gpt_sovits, azure, etc.)
    ├── 供应商级别配置 (API Key, 服务地址)
    └── VoiceAsset[] (音色列表)
            ├── 音色名称
            ├── 音色级别配置 (voice_id, 参考音频)
            └── Character[] (使用该音色的角色列表)
```

---

## 数据库表结构

### 1. `tts_providers` - TTS 供应商表

存储供应商级别的配置信息。

| 字段           | 类型     | 说明                                 |
| -------------- | -------- | ------------------------------------ |
| id             | String   | 主键 (UUID)                          |
| provider_type  | String   | 供应商类型 (openai/gpt_sovits/azure) |
| name           | String   | 供应商名称                           |
| config_payload | JSON     | 供应商级别配置 (API Key、服务地址等) |
| enabled        | Boolean  | 是否启用                             |
| created_at     | DateTime | 创建时间                             |
| updated_at     | DateTime | 更新时间                             |

**示例数据：**

```json
{
  "id": "uuid-1",
  "provider_type": "openai",
  "name": "OpenAI TTS",
  "config_payload": {
    "api_key": "sk-xxx",
    "base_url": "https://api.openai.com/v1"
  },
  "enabled": true
}
```

```json
{
  "id": "uuid-2",
  "provider_type": "gpt_sovits",
  "name": "GPT-SoVITS 本地服务",
  "config_payload": {
    "api_url": "http://localhost:9880"
  },
  "enabled": true
}
```

---

### 2. `assets_voices_v2` - 音色资产表

存储具体的音色配置，是最小的可绑定单位。

| 字段         | 类型     | 说明                       |
| ------------ | -------- | -------------------------- |
| id           | String   | 主键 (UUID)                |
| provider_id  | String   | 外键 → tts_providers.id    |
| name         | String   | 音色名称                   |
| voice_config | JSON     | 音色级别配置 (voice_id 等) |
| created_at   | DateTime | 创建时间                   |
| updated_at   | DateTime | 更新时间                   |

**示例数据（OpenAI）：**

```json
{
  "id": "voice-uuid-1",
  "provider_id": "uuid-1",
  "name": "Alloy",
  "voice_config": {
    "voice": "alloy",
    "speed": 1.0
  }
}
```

```json
{
  "id": "voice-uuid-2",
  "provider_id": "uuid-1",
  "name": "Nova",
  "voice_config": {
    "voice": "nova",
    "speed": 1.2
  }
}
```

**示例数据（GPT-SoVITS）：**

```json
{
  "id": "voice-uuid-3",
  "provider_id": "uuid-2",
  "name": "角色A音色",
  "voice_config": {
    "refer_wav_path": "/path/to/reference.wav",
    "prompt_text": "参考文本内容",
    "prompt_language": "zh",
    "text_language": "zh"
  }
}
```

---

### 3. `characters` - 角色表（更新）

角色表新增 `voice_asset_id` 字段，引用音色资产。

| 字段            | 类型   | 说明                               |
| --------------- | ------ | ---------------------------------- |
| id              | String | 主键 (UUID)                        |
| name            | String | 角色名称                           |
| avatar_id       | String | 外键 → assets_avatars.id           |
| voice_asset_id  | String | 外键 → assets_voices_v2.id (新)    |
| voice_config_id | String | 外键 → assets_voices.id (旧，兼容) |
| ...             | ...    | 其他字段                           |

---

## API 端点

### TTS 供应商管理 (`/api/v1/tts-providers`)

| 方法   | 端点                                          | 说明                       |
| ------ | --------------------------------------------- | -------------------------- |
| GET    | `/api/v1/tts-providers`                       | 列出所有供应商             |
| GET    | `/api/v1/tts-providers/{id}`                  | 获取供应商详情             |
| POST   | `/api/v1/tts-providers`                       | 创建供应商                 |
| PUT    | `/api/v1/tts-providers/{id}`                  | 更新供应商                 |
| DELETE | `/api/v1/tts-providers/{id}`                  | 删除供应商（级联删除音色） |
| GET    | `/api/v1/tts-providers/types/list`            | 获取支持的供应商类型列表   |
| GET    | `/api/v1/tts-providers/types/{type}/template` | 获取配置模板               |
| POST   | `/api/v1/tts-providers/{id}/test`             | 测试供应商配置             |

### 音色资产管理 (`/api/v1/voice-assets`)

| 方法   | 端点                        | 说明                   |
| ------ | --------------------------- | ---------------------- |
| GET    | `/api/v1/voice-assets`      | 列出所有音色           |
| GET    | `/api/v1/voice-assets/{id}` | 获取音色详情           |
| POST   | `/api/v1/voice-assets`      | 创建音色               |
| PUT    | `/api/v1/voice-assets/{id}` | 更新音色               |
| DELETE | `/api/v1/voice-assets/{id}` | 删除音色（带引用检查） |

---

## 使用示例

### 1. 创建 OpenAI 供应商

```bash
POST /api/v1/tts-providers
{
  "provider_type": "openai",
  "name": "OpenAI TTS",
  "config_payload": {
    "api_key": "sk-xxx",
    "base_url": "https://api.openai.com/v1"
  },
  "enabled": true
}
```

### 2. 为供应商创建音色

```bash
POST /api/v1/voice-assets
{
  "provider_id": "uuid-1",
  "name": "Alloy",
  "voice_config": {
    "voice": "alloy",
    "speed": 1.0
  }
}
```

### 3. 创建角色并绑定音色

```bash
POST /api/v1/characters
{
  "name": "AI助手",
  "avatar_id": "avatar-uuid",
  "voice_asset_id": "voice-uuid-1",
  "system_prompt": "你是一个友好的AI助手"
}
```

### 4. 使用角色音色进行语音合成

```bash
POST /api/v1/tts/synthesize
{
  "text": "你好，我是AI助手",
  "character_id": "character-uuid"
}
```

---

## 优势

### 1. 配置分离
- 供应商级别配置（API Key）与音色配置（voice_id）分离
- 修改 API Key 不影响音色配置
- 一个供应商可以有多个音色

### 2. 灵活性
- 同一个供应商可以创建多个音色配置
- 不同角色可以共享同一个音色
- 支持动态添加新的供应商类型

### 3. 可维护性
- 清晰的层级关系
- 级联删除：删除供应商时自动删除其音色
- 引用保护：音色被角色使用时无法删除

### 4. 扩展性
- 新增供应商类型只需注册到 `TTSRegistry`
- 配置模板动态生成，前端自动适配
- 支持不同供应商的不同配置结构

---

## 迁移指南

### ✅ 重构已完成

TTS 模块已完全迁移到新架构：

**已完成：**
- ✅ 数据库模型：`TTSProvider` + `VoiceAsset`
- ✅ API 路由：`/api/v1/tts-providers` + `/api/v1/voice-assets`
- ✅ TTSFactory：使用 ORM 加载配置
- ✅ 删除旧代码：TTSConfigService 和 tts_settings 表
- ✅ 角色音色绑定：支持 `character_id` 参数

**使用新架构：**
1. 通过 `/api/v1/tts-providers` 管理供应商
2. 通过 `/api/v1/voice-assets` 管理音色
3. 角色自动绑定 `voice_asset_id`
4. 语音合成支持角色级别配置

**数据迁移：**
- 旧的 `tts_settings` 表已废弃
- 需要重新配置 TTS 供应商和音色
- 角色需要重新绑定音色资产

---

## 支持的供应商类型

当前支持的供应商类型（通过 `TTSRegistry` 注册）：

- `openai` - OpenAI TTS
- `gpt_sovits` - GPT-SoVITS
- `azure` - Azure TTS
- `genie_tts` - Genie TTS
- 更多供应商可通过注册中心动态添加

---

## 配置模板示例

### OpenAI 配置模板

```json
{
  "api_key": {
    "type": "password",
    "label": "API Key",
    "required": true,
    "sensitive": true
  },
  "base_url": {
    "type": "string",
    "label": "API 地址",
    "default": "https://api.openai.com/v1"
  }
}
```

### GPT-SoVITS 配置模板

```json
{
  "api_url": {
    "type": "string",
    "label": "API地址",
    "default": "http://localhost:9880",
    "required": true
  },
  "refer_wav_path": {
    "type": "file",
    "label": "参考音频路径",
    "required": true,
    "accept": ".wav,.mp3"
  },
  "prompt_text": {
    "type": "string",
    "label": "参考文本",
    "required": true
  }
}
```

---

## 总结

新的 TTS 架构通过三层设计实现了配置的清晰分离和灵活管理：

1. **TTSProvider** - 管理供应商级别配置
2. **VoiceAsset** - 管理具体音色配置（最小绑定单位）
3. **Character** - 引用音色资产

这种设计使得系统更加模块化、可维护和可扩展。
