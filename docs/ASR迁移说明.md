# ASR模块迁移说明

## 变更概述

ASR配置管理已从YAML文件迁移到数据库存储，支持动态配置和API管理。

## 主要变更

### 1. 配置存储方式
- **旧方式**: `config/asr.yaml` 静态配置文件
- **新方式**: `data/app.db` 数据库表 `asr_settings`
- **注意**: `config/asr.yaml` 保留作为配置参考模板

### 2. API接口变更

#### 已删除接口
- ❌ `POST /api/v1/messages/audio` - 音频消息接口（已废弃）

#### 新增接口
- ✅ `GET /api/v1/asr/providers` - 获取配置列表与状态
- ✅ `POST /api/v1/asr/test` - 测试连接
- ✅ `POST /api/v1/asr/config` - 保存并应用配置
- ✅ `POST /api/v1/asr/transcribe` - 语音转文本

### 3. 数据库表结构

```sql
CREATE TABLE asr_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT 0,
    is_configured BOOLEAN DEFAULT 0,
    config_data TEXT,  -- 加密存储的JSON配置
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. 配置加密

- 使用 `cryptography.Fernet` 对称加密
- 密钥通过环境变量 `ASR_CONFIG_KEY` 配置
- 首次启动会自动生成临时密钥（建议保存到环境变量）

## 使用指南

### 环境变量配置

```bash
# 设置ASR配置加密密钥（可选，不设置会自动生成）
ASR_CONFIG_KEY=your-base64-encoded-key
```

### API使用示例

#### 1. 获取配置列表
```http
GET /api/v1/asr/providers
```

响应：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "active_provider": "openai",
    "providers": [
      {
        "id": "openai",
        "name": "OpenAI Whisper",
        "is_configured": true,
        "config": {
          "api_key": "sk-****",
          "model": "whisper-1"
        }
      }
    ]
  }
}
```

#### 2. 测试连接
```http
POST /api/v1/asr/test
Content-Type: application/json

{
  "provider_id": "openai",
  "config": {
    "api_key": "sk-your-real-key",
    "base_url": "https://api.openai.com/v1",
    "model": "whisper-1"
  }
}
```

#### 3. 保存配置
```http
POST /api/v1/asr/config
Content-Type: application/json

{
  "provider_id": "openai",
  "name": "OpenAI Whisper",
  "config": {
    "api_key": "sk-your-real-key",
    "model": "whisper-1"
  }
}
```

#### 4. 语音转文本
```http
POST /api/v1/asr/transcribe
Content-Type: multipart/form-data

file: <audio-file>
language: zh (可选)
```

## 代码变更

### ASRFactory 使用方式

**旧方式**:
```python
factory = ASRFactory(config_path="config/asr.yaml")
asr = factory.create_asr("openai")
```

**新方式**:
```python
factory = ASRFactory(db_path="data/app.db")
asr = factory.get_default_asr()  # 使用当前active的provider
# 或
asr = factory.create_asr("openai")  # 指定provider
```

### 测试连接

所有ASR实现现在都支持 `test_connection()` 方法：

```python
asr = factory.create_asr("openai", config={...})
result = await asr.test_connection()
# {"success": True/False, "message": "..."}
```

## 注意事项

1. **首次启动**: 数据库为空，需要通过API配置ASR服务商
2. **FunASR**: 本地模型路径也存储在数据库中
3. **加密密钥**: 建议设置 `ASR_CONFIG_KEY` 环境变量，避免重启后无法解密
4. **配置缓存**: 修改配置后会自动清空缓存，下次使用时重新加载

## 迁移步骤

1. ✅ 代码已完成迁移
2. ⚠️ 首次启动后，通过API配置ASR服务商
3. ⚠️ 设置 `ASR_CONFIG_KEY` 环境变量（可选但推荐）
4. ✅ `config/asr.yaml` 保留作为配置参考
