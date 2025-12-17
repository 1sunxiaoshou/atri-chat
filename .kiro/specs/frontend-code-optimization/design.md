# 设计文档 - 前端代码优化

## 概述

本设计文档描述了对 React + TypeScript 前端应用的全面优化方案。优化目标是提升代码质量、可维护性和可扩展性，通过统一类型定义、重构大型组件、优化 API 层、消除重复代码等手段，使代码结构更加清晰、规范。

## 架构

### 当前架构

```
frontend/
├── components/     # UI 组件
│   ├── admin/     # 管理后台组件
│   ├── chat/      # 聊天相关组件
│   ├── settings/  # 设置相关组件
│   └── ui/        # 通用 UI 组件
├── contexts/      # React Context
├── hooks/         # 自定义 Hooks
├── services/      # API 服务层
├── utils/         # 工具函数
└── types.ts       # 类型定义
```

### 优化后架构

```
frontend/
├── components/
│   ├── admin/
│   ├── chat/
│   │   ├── ChatInterface.tsx      # 主聊天界面（简化）
│   │   ├── MessageList.tsx        # 消息列表组件（新增）
│   │   ├── MessageItem.tsx        # 单条消息组件（新增）
│   │   ├── ChatInput.tsx          # 输入框组件（新增）
│   │   ├── VRMViewer.tsx          # VRM 查看器（新增）
│   │   └── ModelConfigPopover.tsx
│   ├── settings/
│   └── ui/
├── contexts/
├── hooks/
│   ├── useChat.ts                 # 聊天逻辑（优化）
│   ├── useVRM.ts                  # VRM 逻辑（新增）
│   ├── useTTS.ts                  # TTS 逻辑（新增）
│   ├── useAudioRecorder.ts        # 录音逻辑（新增）
│   └── useSettings.ts
├── services/
│   ├── api/
│   │   ├── base.ts                # 基础 HTTP 客户端（新增）
│   │   ├── providers.ts           # Provider API（新增）
│   │   ├── models.ts              # Model API（新增）
│   │   ├── characters.ts          # Character API（新增）
│   │   ├── conversations.ts       # Conversation API（新增）
│   │   ├── messages.ts            # Message API（新增）
│   │   ├── vrm.ts                 # VRM API（新增）
│   │   └── index.ts               # 统一导出
│   └── storage.ts
├── utils/
│   ├── constants.ts               # 常量定义（优化）
│   ├── helpers.ts                 # 辅助函数（优化）
│   ├── logger.ts                  # 日志工具（新增）
│   └── ...
└── types.ts                       # 类型定义（优化）
```

## 组件和接口

### 1. 类型系统优化

#### 统一实体字段命名

所有实体类型将统一使用后端返回的字段名称，移除兼容性字段：

```typescript
// 优化前
export interface Message {
  message_id: string | number;
  conversation_id: string | number;
  message_type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  created_at: string;
  isStreaming?: boolean;  // UI only
}

// 优化后 - 移除 role、id 等兼容字段
export interface Message {
  message_id: number;
  conversation_id: number;
  message_type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  created_at: string;
}

export interface Model {
  provider_id: string;
  model_id: string;
  model_type: 'text' | 'embedding' | 'rerank';
  capabilities: string[];
  enabled: boolean;
}

export interface Character {
  character_id: number;
  name: string;
  description?: string;
  avatar?: string;
  avatar_position?: 'left' | 'center' | 'right';
  system_prompt: string;
  primary_model_id: string;
  primary_provider_id: string;
  tts_id?: string;
  vrm_model_id?: string;
  enabled: boolean;
}
```

### 2. API 服务层重构

#### 基础 HTTP 客户端

创建统一的 HTTP 请求封装：

```typescript
// services/api/base.ts
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class HttpClient {
  private baseURL: string;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }
  
  async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    // 统一的请求处理逻辑
  }
  
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {}
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {}
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {}
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {}
}
```

#### API 模块化

按业务领域拆分 API：

```typescript
// services/api/messages.ts
export const messagesApi = {
  getMessages(conversationId: number): Promise<ApiResponse<Message[]>>,
  sendMessage(params: SendMessageParams): Promise<ApiResponse<SendMessageData>>,
  // 流式消息处理
  sendStreamMessage(params: SendMessageParams, callbacks: StreamCallbacks)
}

// services/api/characters.ts
export const charactersApi = {
  getCharacters(): Promise<ApiResponse<Character[]>>,
  createCharacter(data: CreateCharacterData): Promise<ApiResponse<Character>>,
  updateCharacter(id: number, data: Partial<Character>): Promise<ApiResponse<Character>>,
  deleteCharacter(id: number): Promise<ApiResponse<void>>
}
```

### 3. 组件拆分设计

#### ChatInterface 组件拆分

将 823 行的 ChatInterface 拆分为多个职责单一的组件：

```typescript
// components/chat/ChatInterface.tsx (主组件，约 150 行)
export const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  const { messages, sendMessage, isTyping } = useChat(props.activeConversationId);
  const { vrmMode, vrmCanvas } = useVRM(props.activeCharacter);
  
  return (
    <div className="chat-interface">
      <ChatHeader {...headerProps} />
      {vrmMode === 'vrm' ? (
        <VRMViewer canvas={vrmCanvas} />
      ) : (
        <MessageList messages={messages} isTyping={isTyping} />
      )}
      <ChatInput onSend={sendMessage} />
    </div>
  );
};

// components/chat/MessageList.tsx (约 100 行)
export const MessageList: React.FC<MessageListProps> = ({ messages, isTyping }) => {
  return (
    <div className="message-list">
      {messages.map(msg => (
        <MessageItem key={msg.message_id} message={msg} />
      ))}
      {isTyping && <TypingIndicator />}
    </div>
  );
};

// components/chat/MessageItem.tsx (约 150 行)
export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { copyMessage, playTTS } = useMessageActions();
  
  return (
    <div className="message-item">
      <MessageContent content={message.content} />
      {message.reasoning && <ReasoningPanel reasoning={message.reasoning} />}
      <MessageActions onCopy={copyMessage} onPlay={playTTS} />
    </div>
  );
};

// components/chat/ChatInput.tsx (约 120 行)
export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  
  return (
    <div className="chat-input">
      <textarea value={input} onChange={handleChange} />
      <AudioRecordButton 
        isRecording={isRecording}
        onStart={startRecording}
        onStop={stopRecording}
      />
      <SendButton onClick={onSend} />
    </div>
  );
};

// components/chat/VRMViewer.tsx (约 100 行)
export const VRMViewer: React.FC<VRMViewerProps> = ({ canvas }) => {
  return (
    <div className="vrm-viewer">
      <canvas ref={canvas} />
      <SubtitleOverlay />
    </div>
  );
};
```

### 4. 自定义 Hooks 设计

#### useChat Hook 优化

```typescript
// hooks/useChat.ts
export const useChat = (conversationId: number) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const loadMessages = useCallback(async () => {
    const response = await messagesApi.getMessages(conversationId);
    if (response.code === 200) {
      setMessages(response.data);
    }
  }, [conversationId]);
  
  const sendMessage = useCallback(async (
    content: string,
    options: SendMessageOptions
  ) => {
    // 发送消息逻辑
  }, [conversationId]);
  
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);
  
  return {
    messages,
    isTyping,
    sendMessage,
    loadMessages
  };
};
```

#### 新增专用 Hooks

```typescript
// hooks/useVRM.ts
export const useVRM = (character: Character | null) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<VRMLoader | null>(null);
  const playerRef = useRef<VRMTimedPlayer | null>(null);
  
  const loadModel = useCallback(async (modelId: string) => {
    // VRM 模型加载逻辑
  }, []);
  
  useEffect(() => {
    if (character?.vrm_model_id) {
      loadModel(character.vrm_model_id);
    }
    return () => {
      // 清理资源
    };
  }, [character?.vrm_model_id, loadModel]);
  
  return {
    canvasRef,
    loaderRef,
    playerRef,
    loadModel
  };
};

// hooks/useTTS.ts
export const useTTS = () => {
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
  const playerRef = useRef<StreamTTSPlayer | null>(null);
  
  const playTTS = useCallback(async (messageId: number, text: string) => {
    // TTS 播放逻辑
  }, []);
  
  const stopTTS = useCallback(() => {
    // 停止播放逻辑
  }, []);
  
  return {
    playingMessageId,
    playTTS,
    stopTTS
  };
};

// hooks/useAudioRecorder.ts
export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const startRecording = useCallback(async () => {
    // 开始录音逻辑
  }, []);
  
  const stopRecording = useCallback(() => {
    // 停止录音逻辑
  }, []);
  
  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording
  };
};
```

## 数据模型

### 实体关系

```
Provider (1) ----< (N) Model
Character (1) ----< (N) Conversation
Conversation (1) ----< (N) Message
Character (1) ----< (1) VRMModel
VRMModel (1) ----< (N) VRMAnimation
```

### 状态管理

```typescript
// 全局状态（Context）
- ThemeContext: 主题设置
- LanguageContext: 语言设置
- ASRContext: 语音识别配置

// 组件状态（useState/useReducer）
- 消息列表
- 输入框内容
- 加载状态
- 错误状态

// 服务器状态（通过 API）
- Characters
- Models
- Providers
- Conversations
- Messages
```


## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 模块结构符合职责划分

*对于任何* 前端项目文件，该文件应该位于与其职责相匹配的模块目录中（components、hooks、services、utils、contexts 或 types）

**验证: 需求 1.1**

### 属性 2: 文件大小符合单一职责原则

*对于任何* 代码文件，其行数不应超过 500 行，如果超过则应考虑拆分

**验证: 需求 1.2**

### 属性 3: 重复代码已被抽取

*对于任何* 两段相似度超过 80% 的代码块，应该被抽取为公共函数、Hook 或组件

**验证: 需求 1.3, 3.1**

### 属性 4: 组件嵌套层级合理

*对于任何* React 组件，其 JSX 嵌套层级不应超过 5 层

**验证: 需求 1.4**

### 属性 5: 类型定义集中管理

*对于任何* TypeScript 接口或类型定义，应该在 types.ts 文件中定义

**验证: 需求 2.1, 3.4**

### 属性 6: 字段命名与后端一致

*对于任何* 实体类型（Message、Model、Character 等），其字段名称应该与后端 API 返回的字段名称完全一致

**验证: 需求 2.2, 6.1, 6.2, 6.3, 6.5**

### 属性 7: TypeScript 编译无错误

*对于任何* TypeScript 代码，执行 `tsc --noEmit` 应该不产生类型错误

**验证: 需求 2.3**

### 属性 8: 避免使用 any 类型

*对于任何* 函数参数或返回值，不应使用 `any` 类型（除非有明确的理由）

**验证: 需求 2.4**

### 属性 9: 可选字段正确标记

*对于任何* 类型定义中的字段，如果该字段可能不存在则应使用 `?` 标记，否则不应标记

**验证: 需求 2.5**

### 属性 10: 无未使用的代码

*对于任何* 变量、函数、导入或参数，如果未被使用则应该被删除

**验证: 需求 3.2, 6.4**

### 属性 11: 常量集中管理

*对于任何* 在多处使用的常量值，应该在 constants.ts 文件中定义

**验证: 需求 3.3**

### 属性 12: 命名符合 camelCase 规范

*对于任何* 变量或函数名称，应该遵循 camelCase 命名规范

**验证: 需求 4.1**

### 属性 13: 无魔法数字

*对于任何* 代码中出现的数字字面量（除了 0、1、-1），应该定义为具名常量

**验证: 需求 4.4**

### 属性 14: 配置化而非硬编码

*对于任何* URL、路径、环境相关的值，应该通过配置文件或环境变量获取，而不是硬编码

**验证: 需求 5.1**

### 属性 15: 组件通过 props 配置

*对于任何* 需要定制化的组件行为，应该通过 props 传递配置，而不是修改组件内部代码

**验证: 需求 5.3**

### 属性 16: API 调用通过 service 层

*对于任何* 组件中的 API 调用，应该通过 service 层的函数进行，而不是直接使用 fetch

**验证: 需求 5.4, 10.1**

### 属性 17: Hook 副作用正确管理

*对于任何* 自定义 Hook 中的副作用，应该使用 useEffect 进行管理

**验证: 需求 7.1**

### 属性 18: Hook 返回函数使用 useCallback

*对于任何* Hook 返回的函数，应该使用 useCallback 包装

**验证: 需求 7.2**

### 属性 19: Hook 依赖数组完整

*对于任何* useEffect 或 useCallback 的依赖数组，应该包含所有使用的外部变量

**验证: 需求 7.3**

### 属性 20: Hook 大小合理

*对于任何* 自定义 Hook，其行数不应超过 150 行，如果超过则应拆分

**验证: 需求 7.4**

### 属性 21: API 错误被捕获

*对于任何* API 调用，应该包含错误处理逻辑（try-catch 或 .catch()）

**验证: 需求 8.1**

### 属性 22: 错误处理集中管理

*对于任何* 错误处理逻辑，应该在 service 层或自定义 Hook 中统一处理

**验证: 需求 8.2**

### 属性 23: 使用统一日志工具

*对于任何* 日志记录，应该使用统一的日志工具，而不是直接使用 console.log

**验证: 需求 8.3**

### 属性 24: 错误信息国际化

*对于任何* 用户可见的错误信息，应该使用中文或国际化函数

**验证: 需求 8.4**

### 属性 25: 组件大小合理

*对于任何* React 组件，其行数不应超过 300 行，如果超过则应拆分

**验证: 需求 9.1**

### 属性 26: 组件职责单一

*对于任何* React 组件，应该只负责一个主要功能，多个独立功能应该拆分为子组件或 Hook

**验证: 需求 9.2**

### 属性 27: 复杂状态提取为 Hook

*对于任何* 组件中的状态管理，如果 useState 数量超过 5 个，应该考虑提取为自定义 Hook

**验证: 需求 9.3**

### 属性 28: URL 构建统一

*对于任何* API URL 构建，应该使用统一的 URL 构建工具，而不是字符串拼接

**验证: 需求 10.2**

### 属性 29: API 响应处理统一

*对于任何* API 响应，应该使用统一的响应处理函数

**验证: 需求 10.3**

## 错误处理

### 错误类型

```typescript
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: number;
}
```

### 错误处理策略

1. **API 层错误处理**
   - 在 HttpClient 中统一捕获网络错误
   - 根据 HTTP 状态码分类错误类型
   - 返回标准化的错误响应

2. **Hook 层错误处理**
   - 在自定义 Hook 中处理业务逻辑错误
   - 提供错误状态和错误信息给组件
   - 支持错误重试机制

3. **组件层错误处理**
   - 显示用户友好的错误提示
   - 提供错误恢复操作（如重试按钮）
   - 记录错误日志用于调试

### 日志工具

```typescript
// utils/logger.ts
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  static debug(message: string, data?: any): void {}
  static info(message: string, data?: any): void {}
  static warn(message: string, data?: any): void {}
  static error(message: string, error?: Error, data?: any): void {}
}
```

## 测试策略

### 单元测试

使用 Vitest 进行单元测试，覆盖以下内容：

1. **工具函数测试**
   - helpers.ts 中的辅助函数
   - constants.ts 中的常量定义
   - logger.ts 中的日志工具

2. **Hook 测试**
   - 使用 @testing-library/react-hooks 测试自定义 Hook
   - 测试状态更新逻辑
   - 测试副作用清理

3. **API 服务测试**
   - 使用 Mock Service Worker (MSW) 模拟 API
   - 测试请求参数构建
   - 测试响应处理逻辑
   - 测试错误处理

### 集成测试

使用 @testing-library/react 进行组件集成测试：

1. **组件交互测试**
   - 测试用户输入和按钮点击
   - 测试组件间通信
   - 测试状态更新后的 UI 变化

2. **端到端流程测试**
   - 测试完整的消息发送流程
   - 测试 VRM 模型加载流程
   - 测试语音录制和转录流程

### 类型检查

使用 TypeScript 编译器进行类型检查：

```bash
# 类型检查（不生成文件）
npm run type-check

# 配置 tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 代码质量检查

使用 ESLint 进行代码质量检查：

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'warn',
    'no-magic-numbers': ['warn', { ignore: [0, 1, -1] }]
  }
};
```

### 测试覆盖率目标

- 工具函数: 90%+
- 自定义 Hook: 80%+
- API 服务: 85%+
- 组件: 70%+

