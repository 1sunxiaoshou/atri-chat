# Qwen3-TTS 集成文档

## 概述

Qwen3-TTS 是阿里云推出的高质量文本转语音服务，支持多语言、多音色，并提供指令控制功能。

## 功能特性

- ✅ **9 种预置音色**：Cherry、Ryan、Aiden、Vivian、Serena、Uncle_Fu、Dylan、Eric、Ono_Anna、Sohee
- ✅ **10+ 语言支持**：中文、英文、日语、韩语、德语、法语、西班牙语、意大利语、葡萄牙语、俄语
- ✅ **流式/非流式输出**：支持实时流式传输和一次性返回
- ✅ **指令控制**：通过自然语言控制情感、语速、语调（需使用 `qwen3-tts-instruct-flash` 模型）
- ✅ **自动语言检测**：支持混合语言文本

## 前置要求

### 1. 获取 API Key

1. 访问 [阿里云 Model Studio](https://www.alibabacloud.com/help/en/model-studio/get-api-key)
2. 注册/登录阿里云账号
3. 创建 API Key
4. 注意：新加坡和北京区域的 API Key 不同

### 2. 安装依赖

```bash
uv pip install dashscope httpx
```

### 3. 配置环境变量（可选）

```bash
export DASHSCOPE_API_KEY="sk-xxxxxxxxxxxxxxxx"
```

## 使用方法

### 方式 1：通过管理界面配置

1. 进入 TTS 管理页面
2. 添加新的 TTS 供应商
3. 选择 "Qwen3-TTS"
4. 填写配置：
   - **API Key**：你的 DashScope API Key
   - **服务区域**：选择 `singapore` 或 `beijing`
   - **模型**：选择 `qwen3-tts-flash`（标准）或 `qwen3-tts-instruct-flash`（支持指令）

5. 添加音色配置：
   - **音色**：选择预置音色（如 Cherry、Ryan）
   - **语言**：选择目标语言或 `Auto`（自动检测）
   - **指令控制**（可选）：输入自然语言指令，如 "语速较快，语调上扬，适合介绍时尚产品"
   - **优化指令**（可选）：启用自动优化指令

### 方式 2：通过代码使用

```python
from core.tts import TTSFactory

# 创建工厂实例
factory = TTSFactory()

# 配置
config = {
    # 供应商配置
    "api_key": "sk-xxxxxxxxxxxxxxxx",
    "region": "singapore",  # 或 "beijing"
    "model": "qwen3-tts-flash",
    
    # 音色配置
    "voice": "Cherry",
    "language_type": "Chinese",
    "instructions": "",  # 可选：指令控制
    "optimize_instructions": "false"
}

# 创建 TTS 实例
tts = factory.create_tts("qwen_tts", config)

# 测试连接
result = await tts.test_connection()
print(result)  # {"success": True, "message": "连接成功！..."}

# 非流式合成
audio_bytes = await tts.synthesize_async("你好，欢迎使用 Qwen3-TTS！")

# 流式合成
async for chunk in tts.synthesize_stream("这是一段较长的文本..."):
    # 处理音频块
    pass
```

## 配置说明

### 供应商级别配置

| 参数      | 类型   | 必填 | 默认值          | 说明                               |
| --------- | ------ | ---- | --------------- | ---------------------------------- |
| `api_key` | string | ✅    | -               | DashScope API Key                  |
| `region`  | select | ✅    | singapore       | 服务区域：`singapore` 或 `beijing` |
| `model`   | select | ✅    | qwen3-tts-flash | 模型选择                           |

### 音色级别配置

| 参数                    | 类型   | 必填 | 默认值 | 说明                         |
| ----------------------- | ------ | ---- | ------ | ---------------------------- |
| `voice`                 | select | ✅    | Cherry | 预置音色                     |
| `language_type`         | select | ❌    | Auto   | 目标语言                     |
| `instructions`          | string | ❌    | ""     | 指令控制（仅 instruct 模型） |
| `optimize_instructions` | select | ❌    | false  | 自动优化指令                 |

## 可用音色

| 音色     | 语言 | 性别 | 描述       |
| -------- | ---- | ---- | ---------- |
| Cherry   | 中文 | 女   | 专业、清晰 |
| Ryan     | 英文 | 男   | 清晰、自然 |
| Aiden    | 英文 | 男   | 温暖       |
| Vivian   | 中文 | 女   | 专业       |
| Serena   | 中文 | 女   | 友好       |
| Uncle_Fu | 中文 | 男   | 成熟       |
| Dylan    | 中文 | 男   | 北京口音   |
| Eric     | 中文 | 男   | 四川口音   |
| Ono_Anna | 日语 | 女   | -          |
| Sohee    | 韩语 | 女   | -          |

## 支持的语言

- `Auto` - 自动检测（支持混合语言）
- `Chinese` - 中文
- `English` - 英文
- `Japanese` - 日语
- `Korean` - 韩语
- `German` - 德语
- `French` - 法语
- `Spanish` - 西班牙语
- `Italian` - 意大利语
- `Portuguese` - 葡萄牙语
- `Russian` - 俄语

## 指令控制示例

仅在使用 `qwen3-tts-instruct-flash` 模型时有效：

```python
config = {
    "model": "qwen3-tts-instruct-flash",
    "voice": "Cherry",
    "instructions": "语速较快，语调上扬，充满热情，适合介绍时尚产品",
    "optimize_instructions": "true"
}
```

**指令示例**：
- "语速较快，语调上扬，适合介绍时尚产品"
- "语速缓慢，语调平稳，适合讲述故事"
- "充满热情和活力，适合广告宣传"
- "温柔亲切，适合儿童故事"

## 限制说明

- **文本长度**：最多 600 字符（标准模型）或 512 tokens（Qwen-TTS）
- **指令长度**：最多 1600 tokens
- **指令语言**：仅支持中文和英文
- **采样率**：24000 Hz

## 价格

请参考 [阿里云 Model Studio 定价](https://www.alibabacloud.com/help/en/model-studio/pricing)

## API 端点

- **新加坡区域**：`https://dashscope-intl.aliyuncs.com/api/v1`
- **北京区域**：`https://dashscope.aliyuncs.com/api/v1`

## 错误处理

常见错误及解决方案：

| 错误                  | 原因         | 解决方案                     |
| --------------------- | ------------ | ---------------------------- |
| 401 Unauthorized      | API Key 无效 | 检查 API Key 是否正确        |
| 403 Forbidden         | 无权限访问   | 确认 API Key 有 TTS 服务权限 |
| 400 Bad Request       | 参数错误     | 检查文本长度、音色名称等参数 |
| 429 Too Many Requests | 请求过多     | 降低请求频率或升级配额       |

## 测试连接

```python
result = await tts.test_connection()

if result["success"]:
    print(f"✅ {result['message']}")
else:
    print(f"❌ {result['message']}")
```

## 参考资料

- [Qwen-TTS API 官方文档](https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api)
- [DashScope Python SDK](https://help.aliyun.com/zh/model-studio/developer-reference/python-sdk)
- [获取 API Key](https://www.alibabacloud.com/help/en/model-studio/get-api-key)

## 更新日志

- **2026-02-21**：初始集成，支持流式/非流式输出、指令控制
  - ✅ 测试通过：非流式合成、流式合成、多音色切换
  - ✅ 支持阿里云百联 API Key
  - ✅ 自动处理 URL 和 base64 两种音频返回格式
