# TTS 角色绑定功能说明

## 概述

系统现在支持为每个角色绑定专属的 TTS 音色，实现个性化的语音合成。

## 架构设计

### 数据模型

```
TTSProvider (TTS 供应商)
  ├── id
  ├── provider_type (如 qwen_tts, gpt_sovits)
  ├── name
  ├── config_payload (供应商级别配置：API Key、服务地址等)
  └── enabled

VoiceAsset (音色资产)
  ├── id
  ├── provider_id (关联到 TTSProvider)
  ├── name
  ├── voice_config (音色级别配置：音色名称、语言等)
  └── provider (关联对象)

Character (角色)
  ├── character_id
  ├── name
  ├── voice_asset_id (关联到 VoiceAsset)
  └── voice_asset (关联对象)
```

### 配置分离

- **供应商配置** (TTSProvider.config_payload)
  - API Key / 认证信息
  - 服务地址
  - 模型选择
  - 全局参数

- **音色配置** (VoiceAsset.voice_config)
  - 音色名称
  - 语言设置
  - 参考音频（如 GPT-SoVITS）
  - 音色特定参数

## 使用流程

### 1. 创建 TTS 供应商

在 TTS 管理页面：
1. 点击"添加供应商"
2. 选择供应商类型（如 Qwen3-TTS）
3. 填写供应商配置：
   - API Key
   - 服务区域
   - 模型选择
4. 测试连接
5. 保存

### 2. 创建音色资产

在 TTS 管理页面：
1. 选择已创建的供应商
2. 点击"添加音色"
3. 填写音色配置：
   - 音色名称（如 "Cherry"）
   - 音色选择（从预置列表选择）
   - 语言设置
   - 其他音色参数
4. 保存

### 3. 为角色绑定音色

在角色管理页面：
1. 编辑角色
2. 在"音色"下拉框中选择已创建的音色
3. 保存

### 4. 使用

在聊天界面：
- 点击消息的播放按钮
- 系统自动使用该角色绑定的音色进行语音合成

## API 调用流程

### 前端调用

```typescript
// 1. 用户点击播放按钮
handlePlayTTS(messageId, text);

// 2. ChatInterface 传递角色 ID
playTTS(messageId, text, activeCharacter?.character_id);

// 3. useTTS hook 调用 API
api.synthesizeSpeechStream(text, characterId);

// 4. TTS API 发送请求
fetch('/tts/synthesize?stream=true', {
  method: 'POST',
  body: JSON.stringify({
    text: "你好",
    character_id: "char-123"
  })
});
```

### 后端处理

```python
# 1. 接收请求
@router.post("/synthesize")
async def synthesize_speech(req: TTSSynthesizeRequest):
    # req.text = "你好"
    # req.character_id = "char-123"
    
    # 2. 查询角色
    character = db.query(Character).filter(
        Character.id == req.character_id
    ).first()
    
    # 3. 获取音色资产
    voice_asset = db.query(VoiceAsset).filter(
        VoiceAsset.id == character.voice_asset_id
    ).first()
    
    # 4. 获取供应商
    provider = db.query(TTSProvider).filter(
        TTSProvider.id == voice_asset.provider_id
    ).first()
    
    # 5. 合并配置
    config = {
        **provider.config_payload,  # 供应商配置
        **voice_asset.voice_config   # 音色配置
    }
    
    # 6. 创建 TTS 实例
    tts = tts_factory.create_tts(
        provider_type=provider.provider_type,
        config=config
    )
    
    # 7. 合成语音
    audio = await tts.synthesize_stream(req.text)
    return StreamingResponse(audio)
```

## 回退机制

如果没有指定 `character_id`，系统会使用默认的 TTS 供应商：

```python
if not req.character_id:
    # 使用第一个启用的供应商
    tts = tts_factory.get_default_tts(db_session=db)
```

## 优势

1. **个性化**：每个角色可以有独特的声音
2. **灵活性**：可以随时更换角色的音色
3. **可扩展**：支持多种 TTS 供应商
4. **配置分离**：供应商配置和音色配置分离，便于管理
5. **缓存优化**：相同配置的 TTS 实例会被缓存复用

## 示例配置

### Qwen3-TTS 供应商

```json
{
  "api_key": "sk-xxx",
  "region": "beijing",
  "model": "qwen3-tts-flash"
}
```

### Qwen3-TTS 音色

```json
{
  "voice": "Cherry",
  "language_type": "Chinese",
  "instructions": "",
  "optimize_instructions": "false"
}
```

### 最终合并配置

```json
{
  "api_key": "sk-xxx",
  "region": "beijing",
  "model": "qwen3-tts-flash",
  "voice": "Cherry",
  "language_type": "Chinese",
  "instructions": "",
  "optimize_instructions": "false"
}
```

## 故障排查

### 问题：点击播放按钮报错 502

**原因**：系统使用了默认供应商，但该供应商服务未运行

**解决方案**：
1. 禁用未运行的供应商
2. 或为角色绑定可用的音色

### 问题：没有传递 character_id

**原因**：前端代码未更新

**解决方案**：
1. 刷新页面
2. 清除浏览器缓存

### 问题：角色没有音色

**原因**：角色未绑定音色资产

**解决方案**：
1. 在角色管理页面编辑角色
2. 选择一个音色资产
3. 保存

## 更新日志

- **2026-02-21**：实现角色绑定 TTS 功能
  - 前端传递 character_id
  - 后端根据角色查找音色
  - 支持配置分离和缓存
