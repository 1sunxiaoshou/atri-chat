# TTS 架构

本文档说明当前 TTS 模块的实现边界、数据模型和维护入口。

## 当前模型

TTS 使用三层结构：

```text
供应商 TTS Provider
 -> 音色 Voice Asset
 -> 角色 Character
```

含义：

- 供应商保存服务级配置，如 API Key、Base URL、服务类型。
- 音色保存 voice id、参考音频、音色参数等资产级配置。
- 角色通过 `voice_asset_id` 绑定音色。

## 主要代码

| 路径 | 职责 |
|---|---|
| `core/tts/base.py` | TTS 抽象基类 |
| `core/tts/registry.py` | 供应商类型注册 |
| `core/tts/factory.py` | TTS 实例创建与缓存 |
| `core/tts/synthesis.py` | 按角色合成语音文件 |
| `api/routes/tts.py` | 合成与状态接口 |
| `api/routes/tts_providers.py` | TTS 供应商管理 |
| `api/routes/voice_assets.py` | 音色资产管理 |
| `frontend/services/api/tts.ts` | 前端 TTS API |
| `frontend/hooks/useTTS.ts` | 前端播放侧 Hook |

## 数据表

| 表 | 用途 |
|---|---|
| `tts_providers` | TTS 供应商配置 |
| `assets_voices_v2` | 音色资产 |
| `characters.voice_asset_id` | 角色绑定音色 |

兼容字段：

- `characters.voice_config_id` 是旧字段，仅用于兼容读取，不作为新功能入口。

## API

| 路径 | 用途 |
|---|---|
| `GET /api/v1/tts/status` | 查询 TTS 状态 |
| `POST /api/v1/tts/synthesize` | 合成语音 |
| `/api/v1/tts-providers` | TTS 供应商 CRUD |
| `/api/v1/voice-assets` | 音色资产 CRUD |

## 支持的供应商

当前供应商类型由 `core/tts/registry.py` 维护。新增供应商时需要：

1. 实现 `core/tts/base.py` 中定义的接口。
2. 在 registry 中注册供应商类型。
3. 补充配置模板。
4. 确认 `TTSFactory` 能正确创建实例。
5. 必要时补充前端表单字段。

## 合成链路

普通前端播放：

```text
useTTS
 -> POST /api/v1/tts/synthesize
 -> TTSFactory
 -> provider.synthesize()
 -> 前端播放音频
```

VRM `say` 命令：

```text
perform_actions
 -> synthesize_character_speech_file()
 -> custom event 携带 audioUrl
 -> useVRM 播放语音并同步字幕
```

## 维护规则

- 供应商级密钥只保存在 `tts_providers.config`。
- 音色参数只保存在 `assets_voices_v2.config`。
- 角色只引用音色，不直接保存供应商密钥。
- 新增 TTS 类型时优先扩展 registry，不在路由里写供应商分支。
- 修改 TTS 数据结构时检查角色编辑页、音色管理页和 VRM `say` 命令。
