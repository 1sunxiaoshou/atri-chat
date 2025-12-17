# 前端架构文档

## 📋 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [核心模块](#核心模块)
- [数据流](#数据流)
- [关键功能](#关键功能)

## 项目概述

NexusAI Chat 是一个基于 React 的现代化 AI 聊天应用前端，支持多角色对话、VRM 3D 模型展示、语音交互等功能。

### 主要特性

- 🤖 多 AI 角色管理
- 💬 实时流式对话
- 🎭 VRM 3D 模型展示与动画
- 🎤 语音识别（ASR）
- 🔊 语音合成（TTS）
- 🌐 中英文双语支持
- 🎨 亮色/暗色主题切换
- ⚙️ 完整的管理后台

## 技术栈

### 核心框架
- **React 19.2.0** - UI 框架
- **TypeScript 5.8.2** - 类型系统
- **Vite 6.2.0** - 构建工具

### UI 相关
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **React Markdown** - Markdown 渲染
- **Rehype Highlight** - 代码高亮

### 3D 渲染
- **Three.js 0.182.0** - 3D 引擎
- **@pixiv/three-vrm 3.4.4** - VRM 模型支持
- **@pixiv/three-vrm-animation 3.4.4** - VRM 动画

### 开发工具
- **ESLint** - 代码检查
- **TypeScript ESLint** - TS 规则

## 目录结构

```
frontend/
├── components/          # 组件目录
│   ├── admin/          # 管理后台组件
│   ├── chat/           # 聊天相关组件
│   ├── settings/       # 设置相关组件
│   └── ui/             # 基础 UI 组件
├── contexts/           # React Context
├── hooks/              # 自定义 Hooks
├── services/           # 服务层
│   └── api/           # API 模块
├── utils/              # 工具函数
├── types.ts            # 类型定义
├── App.tsx             # 主应用组件
├── index.tsx           # 应用入口
└── vite.config.ts      # Vite 配置
```


## 核心模块

### 1. 入口与配置

#### index.tsx
应用入口文件，负责：
- 创建 React 根节点
- 包裹全局 Context Providers
- 初始化应用

```typescript
<ThemeProvider>
  <LanguageProvider>
    <ASRProvider>
      <App />
    </ASRProvider>
  </LanguageProvider>
</ThemeProvider>
```

#### App.tsx
主应用组件，核心职责：
- 管理全局状态（会话、角色、模型）
- 控制视图模式（聊天/管理后台）
- 处理会话的增删改查
- 角色筛选逻辑

**关键状态：**
- `conversations` - 会话列表
- `characters` - 角色列表
- `models` - 模型列表
- `viewMode` - 当前视图模式
- `selectedCharacterId` - 选中的角色 ID

#### vite.config.ts
Vite 构建配置：
- 开发服务器端口：3000
- API 代理配置（转发到后端 8000 端口）
- React 插件配置
- 路径别名设置


### 2. 类型系统（types.ts）

定义了整个应用的 TypeScript 类型，包括：

#### 核心业务类型
- `Provider` - AI 供应商配置
- `Model` - AI 模型信息
- `Character` - 角色配置
- `Conversation` - 会话信息
- `Message` - 消息数据

#### VRM 相关
- `VRMModel` - VRM 3D 模型
- `VRMAnimation` - VRM 动画数据

#### 语音相关
- `ASRProvider` - 语音识别供应商
- `ASRConfigField` - ASR 配置字段
- `TTSProvider` - 语音合成供应商
- `TTSConfigField` - TTS 配置字段

#### UI 状态
- `ViewMode` - 视图模式（'chat' | 'admin'）
- `AdminTab` - 管理后台标签页
- `ModelParameters` - 模型参数配置

#### 通用类型
- `ApiResponse<T>` - API 响应格式
- `ErrorType` - 错误类型枚举
- `AppError` - 应用错误信息

### 3. 组件层

#### 3.1 主要组件

##### Sidebar.tsx
左侧边栏组件，功能包括：

**角色选择器**
- 横向滚动的角色头像列表
- 支持拖拽排序（保持用户自定义顺序）
- 自动滚动到选中角色
- "All Characters" 选项显示所有会话

**会话列表**
- 显示当前角色的历史会话
- 支持删除会话（悬停显示删除按钮）
- 点击切换到对应会话

**底部功能区**
- 管理后台入口
- 设置入口
- 用户信息展示

##### ChatInterface.tsx
聊天界面主组件，整合了：

**子组件：**
- `ChatHeader` - 显示角色信息、模型选择
- `MessageList` - 消息列表容器
- `MessageItem` - 单条消息渲染
- `ChatInput` - 输入框（支持文本/语音）
- `VRMViewer` - VRM 3D 模型展示

**使用的 Hooks：**
- `useChat` - 消息管理
- `useVRM` - VRM 模型控制
- `useTTS` - 语音合成

**核心功能：**
- 加载和显示历史消息
- 发送消息（支持流式响应）
- VRM 动画播放
- TTS 语音播放
- 错误提示（Toast）


##### AdminDashboard.tsx
管理后台主界面，包含四个标签页：

1. **Providers（供应商管理）**
   - 添加/编辑/删除 AI 供应商
   - 配置 API Key、Base URL 等
   - 上传供应商 Logo

2. **Models（模型管理）**
   - 查看所有可用模型
   - 启用/禁用模型
   - 同步供应商模型列表

3. **Characters（角色管理）**
   - 创建/编辑/删除角色
   - 配置角色头像、系统提示词
   - 绑定默认模型和 VRM 模型

4. **VRM Models（VRM 管理）**
   - 上传 VRM 模型文件
   - 管理动画库
   - 绑定模型与动画

##### SettingsModal.tsx
设置弹窗，包含三个标签页：

1. **General（通用设置）**
   - 语言切换（中文/英文）
   - 主题切换（亮色/暗色/跟随系统）

2. **ASR（语音识别）**
   - 选择 ASR 供应商
   - 配置 API 密钥
   - 测试连接

3. **TTS（语音合成）**
   - 选择 TTS 供应商
   - 配置语音参数
   - 测试语音合成

#### 3.2 聊天子组件（chat/）

##### ChatHeader.tsx
聊天界面头部，显示：
- 角色头像和名称
- 在线状态指示
- 模型选择下拉框
- VRM 显示模式切换
- 模型参数配置按钮

##### MessageList.tsx
消息列表容器：
- 自动滚动到最新消息
- 显示加载状态
- 渲染子消息组件

##### MessageItem.tsx
单条消息渲染：
- 支持 Markdown 格式
- 代码块语法高亮
- 思维链（reasoning）展示
- 复制消息按钮
- TTS 播放按钮

##### ChatInput.tsx
消息输入框：
- 文本输入
- 语音录制（集成 ASR）
- 发送按钮
- 录音状态提示

##### VRMViewer.tsx
VRM 3D 模型展示：
- Three.js Canvas 渲染
- 字幕显示
- 全屏模式支持

##### ModelConfigPopover.tsx
模型参数配置弹窗：
- Temperature 调节
- Max Tokens 设置
- Top P 参数
- 其他高级参数


#### 3.3 管理后台子组件（admin/）

##### AdminProviders.tsx
供应商管理组件：
- 供应商列表展示
- 添加/编辑供应商表单
- 动态配置字段（基于模板）
- Logo 上传功能
- 删除确认对话框

##### AdminModels.tsx
模型管理组件：
- 模型列表（支持筛选）
- 按供应商、类型、状态筛选
- 启用/禁用开关
- 同步模型功能
- 删除模型

##### AdminCharacters.tsx
角色管理组件：
- 角色列表（卡片式展示）
- 创建/编辑角色表单
- 头像上传和位置调整
- 系统提示词编辑器
- 模型和 VRM 绑定
- 启用/禁用开关

##### AdminVRM.tsx
VRM 模型和动画管理：
- VRM 模型列表
- 动画库管理
- 上传 VRM 文件（.vrm）
- 上传动画文件（.vrma）
- 模型与动画绑定
- 缩略图预览

#### 3.4 设置子组件（settings/）

##### GeneralSettings.tsx
通用设置：
- 语言选择器
- 主题选择器
- 其他偏好设置

##### ASRSettings.tsx
ASR 配置：
- 供应商选择
- 动态配置表单
- 连接测试
- 保存配置

##### TTSSettings.tsx
TTS 配置：
- 供应商选择
- 语音参数配置
- 试听功能
- 保存配置

##### ProviderSettingsTemplate.tsx
通用供应商配置模板：
- 动态渲染配置字段
- 支持多种字段类型（文本、密码、数字、选择、文件）
- 表单验证
- 敏感信息处理

#### 3.5 UI 基础组件（ui/）

##### Button.tsx
按钮组件：
- 多种样式变体（primary、secondary、danger）
- 尺寸选项（sm、md、lg）
- 加载状态
- 禁用状态

##### Input.tsx
输入框组件：
- 文本输入
- 密码输入
- 数字输入
- 错误提示
- 前缀/后缀图标

##### Select.tsx
下拉选择组件：
- 单选模式
- 搜索功能
- 自定义选项渲染
- 分组支持

##### Modal.tsx
弹窗组件：
- 多种尺寸（sm、md、lg、xl、2xl、4xl）
- 标题和关闭按钮
- 遮罩层
- 键盘 ESC 关闭
- 动画效果


### 4. 自定义 Hooks

#### useChat.ts
聊天消息管理 Hook：

**状态管理：**
- `messages` - 消息列表
- `isTyping` - 是否正在输入
- `currentResponse` - 当前流式响应内容
- `currentReasoning` - 当前思维链内容
- `error` - 错误信息

**核心方法：**
- `loadMessages(conversationId)` - 加载历史消息
- `sendMessage(...)` - 发送消息（支持流式响应）
- `clearError()` - 清除错误

**特性：**
- 支持 SSE 流式响应
- 自动处理 VRM 数据回调
- 错误处理和重试机制

#### useVRM.ts
VRM 模型管理 Hook：

**状态管理：**
- `canvasRef` - Three.js Canvas 引用
- `playerRef` - VRM 播放器引用
- `subtitle` - 当前字幕
- `error` - 错误信息

**核心方法：**
- `playSegments(segments)` - 播放动画片段
- `clearError()` - 清除错误

**功能：**
- 加载 VRM 模型
- 初始化 Three.js 场景
- 播放动画序列
- 同步字幕显示
- 相机控制

#### useTTS.ts
语音合成管理 Hook：

**状态管理：**
- `playingMessageId` - 正在播放的消息 ID
- `error` - 错误信息

**核心方法：**
- `playTTS(messageId, text)` - 播放 TTS 语音
- `clearError()` - 清除错误

**功能：**
- 调用 TTS API
- 流式音频播放
- 播放状态管理
- 音频缓存

#### useAudioRecorder.ts
语音录制 Hook：

**状态管理：**
- `isRecording` - 是否正在录音
- `audioBlob` - 录制的音频数据
- `error` - 错误信息

**核心方法：**
- `startRecording()` - 开始录音
- `stopRecording()` - 停止录音
- `clearAudio()` - 清除音频

**功能：**
- 获取麦克风权限
- 录制音频流
- 转换为 Blob 格式
- 错误处理

#### useSettings.ts
设置管理 Hook：

**功能：**
- 读取/保存用户设置
- 主题切换
- 语言切换
- 本地存储同步


### 5. 服务层（services/）

#### 5.1 API 基础（api/base.ts）

**HttpClient 类**
封装了所有 HTTP 请求方法：

```typescript
class HttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>
  post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>
  put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>
  delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>
}
```

**功能特性：**
- 统一的错误处理
- 请求/响应拦截
- 超时控制
- 自动重试机制
- 错误类型分类

**工具函数：**
- `getBaseURL()` - 获取 API 基础 URL
- `getUploadBaseURL()` - 获取上传文件基础 URL
- `buildURL(path)` - 构建完整 API URL
- `buildUploadURL(path)` - 构建上传文件 URL

#### 5.2 业务 API 模块

##### providers.ts - 供应商 API
```typescript
providersApi.getProviders()              // 获取供应商列表
providersApi.createProvider(data)        // 创建供应商
providersApi.updateProvider(id, data)    // 更新供应商
providersApi.deleteProvider(id)          // 删除供应商
providersApi.getProviderTemplates()      // 获取供应商模板
providersApi.uploadProviderLogo(file)    // 上传 Logo
```

##### models.ts - 模型 API
```typescript
modelsApi.getModels()                    // 获取模型列表
modelsApi.createModel(data)              // 创建模型
modelsApi.toggleModel(id, enabled)       // 启用/禁用模型
modelsApi.deleteModel(id)                // 删除模型
```

##### characters.ts - 角色 API
```typescript
charactersApi.getCharacters()            // 获取角色列表
charactersApi.createCharacter(data)      // 创建角色
charactersApi.updateCharacter(id, data)  // 更新角色
charactersApi.deleteCharacter(id)        // 删除角色
charactersApi.uploadAvatar(file)         // 上传头像
```

##### conversations.ts - 会话 API
```typescript
conversationsApi.getConversations(characterId?)  // 获取会话列表
conversationsApi.createConversation(characterId) // 创建会话
conversationsApi.deleteConversation(id)          // 删除会话
```

##### messages.ts - 消息 API
```typescript
messagesApi.getMessages(conversationId)  // 获取消息列表
messagesApi.sendMessage(params)          // 发送消息（SSE 流式）
messagesApi.sendAudioMessage(params)     // 发送语音消息
```

**SendMessageParams 接口：**
```typescript
interface SendMessageParams {
  conversationId: number
  content: string
  characterId: number
  modelId: string
  providerId: string
  modelParams?: ModelParameters
  onMessage?: (text: string) => void      // 文本回调
  onReasoning?: (text: string) => void    // 思维链回调
  onVrmData?: (data: any) => void         // VRM 数据回调
  onComplete?: () => void                 // 完成回调
  onError?: (error: string) => void       // 错误回调
}
```


##### vrm.ts - VRM API
```typescript
// VRM 模型管理
vrmApi.getVRMModels()                    // 获取 VRM 模型列表
vrmApi.getVRMModel(id)                   // 获取单个 VRM 模型
vrmApi.uploadVRMModel(formData)          // 上传 VRM 模型
vrmApi.updateVRMModel(id, data)          // 更新 VRM 模型
vrmApi.deleteVRMModel(id)                // 删除 VRM 模型

// 动画管理
vrmApi.getVRMAnimations()                // 获取动画列表
vrmApi.getVRMAnimation(id)               // 获取单个动画
vrmApi.uploadVRMAnimation(formData)      // 上传动画
vrmApi.updateVRMAnimation(id, data)      // 更新动画
vrmApi.deleteVRMAnimation(id)            // 删除动画

// 模型与动画绑定
vrmApi.getVRMAnimationModels()           // 获取绑定关系
vrmApi.getModelAnimations(modelId)       // 获取模型的动画
vrmApi.addModelAnimation(modelId, animId)           // 绑定动画
vrmApi.uploadAndBindModelAnimation(modelId, formData) // 上传并绑定
vrmApi.batchAddModelAnimations(modelId, animIds)    // 批量绑定
vrmApi.removeModelAnimation(modelId, animId)        // 解绑动画
vrmApi.batchRemoveModelAnimations(modelId, animIds) // 批量解绑
```

##### asr.ts - 语音识别 API
```typescript
asrApi.getASRProviders()                 // 获取 ASR 供应商配置
asrApi.testASRConnection(providerId)     // 测试连接
asrApi.saveASRConfig(providerId, config) // 保存配置
asrApi.transcribeAudio(audioBlob)        // 转录音频
```

##### tts.ts - 语音合成 API
```typescript
ttsApi.getTTSProviders()                 // 获取 TTS 供应商配置
ttsApi.testTTSConnection(providerId)     // 测试连接
ttsApi.saveTTSConfig(providerId, config) // 保存配置
ttsApi.synthesizeSpeechStream(text)      // 合成语音（流式）
```

#### 5.3 存储服务（storage.ts）

封装 localStorage 操作：

```typescript
storage.set(key, value)      // 保存数据
storage.get(key)             // 获取数据
storage.remove(key)          // 删除数据
storage.clear()              // 清空所有数据
```

**存储的数据：**
- 用户主题偏好
- 语言设置
- 最近使用的角色
- 音频缓存

### 6. 上下文管理（contexts/）

#### LanguageContext.tsx
多语言支持：

**提供的功能：**
- `language` - 当前语言（'en' | 'zh'）
- `setLanguage(lang)` - 切换语言
- `t(key, params?)` - 翻译函数

**使用示例：**
```typescript
const { t, language, setLanguage } = useLanguage()
const text = t('sidebar.newChat')  // "新建会话" 或 "New Chat"
```

**翻译键命名规范：**
- `sidebar.*` - 侧边栏相关
- `chat.*` - 聊天界面相关
- `admin.*` - 管理后台相关
- `settings.*` - 设置相关
- `app.*` - 应用通用

#### ThemeContext.tsx
主题管理：

**提供的功能：**
- `theme` - 当前主题（'light' | 'dark' | 'system'）
- `setTheme(theme)` - 切换主题
- `isDark` - 是否为暗色模式

**特性：**
- 自动应用 `dark` class 到 `<html>` 元素
- 监听系统主题变化（system 模式）
- 持久化到 localStorage


#### ASRContext.tsx
ASR 状态管理：

**提供的功能：**
- `asrEnabled` - ASR 是否已配置
- `refreshASRStatus()` - 刷新 ASR 状态

**用途：**
- 控制语音输入按钮的显示/隐藏
- 在设置页面更新配置后刷新状态

### 7. 工具函数（utils/）

#### 音频相关

##### audioCache.ts
音频缓存管理：
- 缓存 TTS 生成的音频
- LRU 缓存策略
- 自动清理过期缓存

##### pcmStreamPlayer.ts
PCM 音频流播放器：
- 处理 PCM 格式音频流
- Web Audio API 封装
- 实时播放支持

##### streamTTSPlayer.ts
流式 TTS 播放器：
- 边接收边播放
- 缓冲区管理
- 播放状态控制

#### VRM 相关

##### vrmLoader.ts
VRM 模型加载器：
- 加载 .vrm 文件
- 解析 VRM 数据
- 初始化模型
- 错误处理

##### vrmMarkupParser.ts
VRM 标记语言解析器：
- 解析 AI 返回的 VRM 标记
- 提取动画指令
- 提取字幕文本
- 时间轴计算

**标记格式示例：**
```xml
<vrm>
  <segment duration="2.0" animation="wave">你好！</segment>
  <segment duration="1.5" animation="smile">很高兴见到你</segment>
</vrm>
```

##### vrmTimedPlayer.ts
VRM 定时动画播放器：
- 按时间轴播放动画序列
- 同步字幕显示
- 动画过渡处理
- 播放控制（播放/暂停/停止）

##### animationTransition.ts
动画过渡工具：
- 平滑过渡算法
- 缓动函数
- 混合权重计算

#### 其他工具

##### markdownConfig.tsx
Markdown 渲染配置：
- 自定义渲染组件
- 代码块高亮配置
- GFM 支持（表格、删除线等）
- 链接处理

##### constants.ts
常量定义：
- API 端点
- 默认配置值
- 错误消息
- 动画名称映射

##### helpers.ts
通用辅助函数：
- 日期格式化
- 文件大小格式化
- 防抖/节流
- 深拷贝/浅拷贝

##### logger.ts
日志工具：
- 分级日志（debug、info、warn、error）
- 开发/生产环境区分
- 日志持久化
- 性能监控


## 数据流

### 整体架构

```
┌─────────────┐
│  用户交互   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  组件层     │ ◄─── Context (Theme, Language, ASR)
│ Components  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Hooks 层   │ ◄─── 业务逻辑封装
│  useChat    │
│  useVRM     │
│  useTTS     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  服务层     │ ◄─── API 调用
│  api/*      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  后端 API   │
└─────────────┘
```

### 关键数据流

#### 1. 发送消息流程

```
用户输入
  ↓
ChatInput.onSend()
  ↓
useChat.sendMessage()
  ↓
messagesApi.sendMessage() [SSE 连接]
  ↓
后端流式响应
  ├─→ onMessage(text)      → 更新 currentResponse
  ├─→ onReasoning(text)    → 更新 currentReasoning
  ├─→ onVrmData(data)      → 触发 VRM 动画
  └─→ onComplete()         → 保存消息到列表
  ↓
UI 实时更新
```

#### 2. VRM 动画播放流程

```
后端返回 VRM 数据
  ↓
vrmMarkupParser.parse()
  ↓
提取动画片段 segments[]
  ↓
useVRM.playSegments(segments)
  ↓
vrmTimedPlayer.play()
  ├─→ 加载动画文件
  ├─→ 应用到 VRM 模型
  ├─→ 更新字幕
  └─→ 按时间轴播放
  ↓
Three.js 渲染循环
```

#### 3. 语音输入流程

```
用户点击麦克风
  ↓
useAudioRecorder.startRecording()
  ↓
获取麦克风权限
  ↓
录制音频流
  ↓
用户停止录音
  ↓
useAudioRecorder.stopRecording()
  ↓
转换为 Blob
  ↓
asrApi.transcribeAudio(blob)
  ↓
后端 ASR 处理
  ↓
返回文本
  ↓
填充到输入框
  ↓
自动发送消息
```

#### 4. TTS 播放流程

```
用户点击播放按钮
  ↓
useTTS.playTTS(messageId, text)
  ↓
ttsApi.synthesizeSpeechStream(text)
  ↓
后端 TTS 处理（流式）
  ↓
streamTTSPlayer.play()
  ├─→ 接收音频流
  ├─→ 解码 PCM 数据
  ├─→ 填充缓冲区
  └─→ Web Audio API 播放
  ↓
更新播放状态
```


#### 5. 角色切换流程

```
用户点击角色头像
  ↓
Sidebar.onSelectCharacter(characterId)
  ↓
App.setSelectedCharacterId(characterId)
  ↓
useEffect 触发
  ↓
conversationsApi.getConversations(characterId)
  ↓
更新会话列表
  ↓
自动选择第一个会话
  ↓
加载会话消息
```

#### 6. 管理后台数据流

```
进入管理后台
  ↓
AdminDashboard.fetchData()
  ├─→ providersApi.getProviders()
  ├─→ modelsApi.getModels()
  ├─→ charactersApi.getCharacters()
  └─→ vrmApi.getVRMModels()
  ↓
更新本地状态
  ↓
用户编辑数据
  ↓
提交表单
  ├─→ 创建：xxxApi.create(data)
  ├─→ 更新：xxxApi.update(id, data)
  └─→ 删除：xxxApi.delete(id)
  ↓
刷新数据
  ↓
返回聊天界面时重新加载
```

## 关键功能

### 1. 流式对话

**技术实现：**
- 使用 Server-Sent Events (SSE)
- EventSource API 接收服务器推送
- 实时更新 UI 显示

**代码示例：**
```typescript
const eventSource = new EventSource(url)

eventSource.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  onMessage?.(data.content)
})

eventSource.addEventListener('reasoning', (e) => {
  const data = JSON.parse(e.data)
  onReasoning?.(data.content)
})

eventSource.addEventListener('vrm_data', (e) => {
  const data = JSON.parse(e.data)
  onVrmData?.(data)
})
```

**优势：**
- 用户体验好，实时反馈
- 减少等待时间
- 支持长文本生成

### 2. VRM 3D 模型展示

**技术栈：**
- Three.js - 3D 渲染引擎
- @pixiv/three-vrm - VRM 模型加载
- @pixiv/three-vrm-animation - 动画支持

**核心流程：**
1. 加载 VRM 模型文件
2. 初始化 Three.js 场景
3. 设置相机和光照
4. 加载动画文件（.vrma）
5. 按时间轴播放动画
6. 同步字幕显示

**动画系统：**
- 支持多个动画片段串联
- 平滑过渡
- 循环播放
- 表情控制


### 3. 语音交互

#### ASR（语音识别）

**支持的供应商：**
- OpenAI Whisper
- Azure Speech
- 阿里云语音识别
- 其他自定义供应商

**工作流程：**
1. 获取麦克风权限
2. 录制音频（MediaRecorder API）
3. 转换为 Blob
4. 上传到后端
5. 调用 ASR 服务
6. 返回文本结果

**优化：**
- 实时音量显示
- 静音检测
- 自动停止录音
- 错误重试

#### TTS（语音合成）

**支持的供应商：**
- OpenAI TTS
- Azure TTS
- 阿里云 TTS
- Edge TTS（免费）

**工作流程：**
1. 发送文本到后端
2. 调用 TTS 服务
3. 流式返回音频数据
4. 实时播放

**特性：**
- 流式播放（边接收边播放）
- 音频缓存
- 播放控制（播放/暂停/停止）
- 多语言支持

### 4. 多角色管理

**角色配置：**
- 名称和描述
- 头像（支持上传）
- 系统提示词
- 默认模型
- VRM 模型绑定
- TTS 配置

**角色切换：**
- 快速切换角色
- 自动加载对应会话
- 保持会话隔离
- 拖拽排序

**会话管理：**
- 按角色筛选会话
- 查看所有会话
- 删除会话
- 自动生成标题

### 5. 模型配置

**支持的模型类型：**
- 文本生成（text）
- 嵌入（embedding）
- 重排序（rerank）

**模型参数：**
- Temperature（创造性）
- Max Tokens（最大长度）
- Top P（采样概率）
- 其他高级参数

**动态切换：**
- 会话中临时切换模型
- 不影响角色默认配置
- 实时生效

### 6. 主题和多语言

#### 主题系统

**支持的主题：**
- Light（亮色）
- Dark（暗色）
- System（跟随系统）

**实现方式：**
- Tailwind CSS dark mode
- CSS 变量
- 动态 class 切换

**特性：**
- 平滑过渡动画
- 持久化保存
- 系统主题监听

#### 多语言

**支持的语言：**
- 中文（zh）
- 英文（en）

**翻译管理：**
- 集中式翻译文件
- 命名空间隔离
- 参数插值支持

**使用示例：**
```typescript
// 简单翻译
t('sidebar.newChat')  // "新建会话"

// 带参数
t('admin.confirmDeleteVRM', { name: 'Model1' })
// "确定删除 VRM 模型 Model1 吗？"
```


### 7. 错误处理

**错误类型分类：**
```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',      // 网络错误
  AUTH_ERROR = 'AUTH_ERROR',            // 认证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR', // 验证错误
  SERVER_ERROR = 'SERVER_ERROR',        // 服务器错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'       // 未知错误
}
```

**错误处理策略：**
1. **API 层**：统一捕获和分类错误
2. **Hook 层**：提供错误状态和清除方法
3. **组件层**：显示用户友好的错误提示

**Toast 提示：**
- 自动显示错误消息
- 3 秒后自动消失
- 支持成功/失败样式

**重试机制：**
- 网络错误自动重试
- 指数退避策略
- 最大重试次数限制

### 8. 性能优化

#### 代码分割
- 路由级别懒加载
- 组件按需加载
- 动态 import

#### 渲染优化
- React.memo 避免不必要的重渲染
- useMemo 缓存计算结果
- useCallback 缓存函数引用
- 虚拟滚动（长列表）

#### 资源优化
- 图片懒加载
- 音频缓存
- VRM 模型缓存
- API 响应缓存

#### 网络优化
- API 请求合并
- 防抖/节流
- 流式响应
- WebSocket 连接复用

## 开发指南

### 环境要求

- Node.js >= 18
- npm >= 9 或 pnpm >= 8

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录

### 代码检查

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix

# 类型检查
npm run type-check
```

### 项目规范

#### 命名规范

**文件命名：**
- 组件：PascalCase（如 `ChatInterface.tsx`）
- Hooks：camelCase，use 前缀（如 `useChat.ts`）
- 工具函数：camelCase（如 `helpers.ts`）
- 类型定义：PascalCase（如 `types.ts`）

**变量命名：**
- 组件：PascalCase
- 函数/变量：camelCase
- 常量：UPPER_SNAKE_CASE
- 类型/接口：PascalCase

#### 目录组织

```
components/
  ├── feature/          # 按功能分组
  │   ├── Component.tsx
  │   └── index.ts      # 导出
  └── ui/               # 通用 UI 组件
```

#### 组件编写规范

```typescript
import React from 'react'

interface ComponentProps {
  // Props 定义
}

/**
 * 组件说明
 * @component
 */
const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState()
  
  // 事件处理
  const handleClick = () => {
    // ...
  }
  
  // 渲染
  return (
    <div>
      {/* JSX */}
    </div>
  )
}

export default Component
```

#### Hook 编写规范

```typescript
import { useState, useEffect } from 'react'

/**
 * Hook 说明
 * @returns Hook 返回值
 */
export const useCustomHook = () => {
  const [state, setState] = useState()
  
  useEffect(() => {
    // 副作用
  }, [])
  
  return {
    state,
    setState
  }
}
```


#### API 调用规范

```typescript
// 使用模块化 API
import { messagesApi } from '@/services/api'

const sendMessage = async () => {
  try {
    const response = await messagesApi.sendMessage({
      conversationId: 1,
      content: 'Hello',
      // ...
    })
    
    if (response.code === 200) {
      // 处理成功
    }
  } catch (error) {
    // 处理错误
    console.error('发送消息失败:', error)
  }
}
```

#### 样式规范

**使用 Tailwind CSS：**
```tsx
<div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900">
  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
    按钮
  </button>
</div>
```

**响应式设计：**
```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* 移动端全宽，平板半宽，桌面三分之一宽 */}
</div>
```

**暗色模式：**
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  {/* 自动适配主题 */}
</div>
```

### 常见问题

#### 1. API 代理不工作

**问题：** 开发环境下 API 请求 404

**解决：**
- 检查 `vite.config.ts` 中的 proxy 配置
- 确保后端服务运行在 8000 端口
- 重启 Vite 开发服务器

#### 2. VRM 模型加载失败

**问题：** VRM 模型无法显示

**解决：**
- 检查模型文件路径是否正确
- 确认模型文件格式为 .vrm
- 查看浏览器控制台错误信息
- 检查 Three.js 版本兼容性

#### 3. 语音功能不可用

**问题：** 麦克风无法录音或 TTS 无声音

**解决：**
- 检查浏览器麦克风权限
- 确认 ASR/TTS 供应商已配置
- 测试 API 连接
- 检查音频设备

#### 4. 流式响应中断

**问题：** SSE 连接断开或消息不完整

**解决：**
- 检查网络连接
- 增加超时时间
- 查看后端日志
- 检查 EventSource 错误处理

#### 5. 主题切换不生效

**问题：** 切换主题后样式未更新

**解决：**
- 检查 Tailwind dark mode 配置
- 确认 `<html>` 元素有 `dark` class
- 清除浏览器缓存
- 重新构建项目

### 调试技巧

#### 1. React DevTools
- 安装 React DevTools 浏览器扩展
- 查看组件树和 Props
- 分析渲染性能

#### 2. 网络请求调试
```typescript
// 在 api/base.ts 中添加日志
console.log('Request:', url, data)
console.log('Response:', response)
```

#### 3. VRM 调试
```typescript
// 在 useVRM.ts 中添加日志
console.log('VRM Model loaded:', vrm)
console.log('Playing animation:', animationName)
```

#### 4. 状态调试
```typescript
// 使用 useEffect 监听状态变化
useEffect(() => {
  console.log('State changed:', state)
}, [state])
```

## 扩展开发

### 添加新的 AI 供应商

1. **后端配置**
   - 在 `core/models/providers/` 添加供应商实现
   - 注册到供应商工厂

2. **前端配置**
   - 在管理后台添加供应商
   - 配置 API Key 等参数

3. **测试**
   - 测试连接
   - 创建模型
   - 发送测试消息

### 添加新的 VRM 动画

1. **准备动画文件**
   - 格式：.vrma
   - 确保与模型兼容

2. **上传动画**
   - 进入管理后台 VRM 标签页
   - 点击"上传动画"
   - 填写动画信息

3. **绑定到模型**
   - 选择 VRM 模型
   - 添加动画绑定
   - 测试播放

### 添加新的语言

1. **添加翻译**
```typescript
// contexts/LanguageContext.tsx
const translations = {
  // ...
  ja: {  // 日语
    'sidebar.newChat': '新しいチャット',
    // ...
  }
}
```

2. **更新类型**
```typescript
type Language = 'en' | 'zh' | 'ja'
```

3. **添加语言选择器选项**

### 自定义主题

1. **修改 Tailwind 配置**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          // 自定义主色
        }
      }
    }
  }
}
```

2. **更新组件样式**
```tsx
<button className="bg-primary-600 hover:bg-primary-700">
  按钮
</button>
```


## 部署

### 构建优化

```bash
# 生产构建
npm run build

# 分析构建产物
npm run build -- --mode analyze
```

### 环境变量

创建 `.env.production` 文件：

```env
VITE_API_BASE_URL=https://api.example.com
VITE_UPLOAD_BASE_URL=https://cdn.example.com
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name example.com;
    
    root /var/www/frontend/dist;
    index index.html;
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 性能监控

### 关键指标

- **FCP (First Contentful Paint)** - 首次内容绘制
- **LCP (Largest Contentful Paint)** - 最大内容绘制
- **FID (First Input Delay)** - 首次输入延迟
- **CLS (Cumulative Layout Shift)** - 累积布局偏移

### 监控工具

- Chrome DevTools Performance
- Lighthouse
- Web Vitals
- Sentry（错误监控）

### 优化建议

1. **减少包体积**
   - 代码分割
   - Tree Shaking
   - 压缩资源

2. **优化加载速度**
   - CDN 加速
   - 资源预加载
   - 懒加载

3. **优化渲染性能**
   - 虚拟滚动
   - 防抖节流
   - 避免不必要的重渲染

## 安全考虑

### XSS 防护

- 使用 React 自动转义
- 避免 `dangerouslySetInnerHTML`
- 验证用户输入

### CSRF 防护

- 使用 CSRF Token
- SameSite Cookie
- 验证 Referer

### 敏感信息保护

- 不在前端存储敏感信息
- API Key 通过后端代理
- HTTPS 传输

### 内容安全策略（CSP）

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline';">
```

## 测试

### 单元测试

```bash
npm run test
```

### E2E 测试

```bash
npm run test:e2e
```

### 测试覆盖率

```bash
npm run test:coverage
```

## 贡献指南

### 提交规范

使用 Conventional Commits：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

### Pull Request 流程

1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 运行测试
5. 提交 PR
6. 代码审查
7. 合并

## 相关资源

### 官方文档

- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Vite 文档](https://vitejs.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Three.js 文档](https://threejs.org/)

### 社区资源

- [VRM 规范](https://vrm.dev/)
- [React Patterns](https://reactpatterns.com/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持多角色对话
- VRM 3D 模型展示
- 语音交互功能
- 管理后台

---

**文档版本：** 1.0.0  
**最后更新：** 2024-01-01  
**维护者：** NexusAI Team
