# 前端代码规范

本文档定义了项目的前端代码规范，所有开发者应遵循这些规范以保持代码质量和一致性。

## 目录

- [TypeScript 规范](#typescript-规范)
- [React 组件规范](#react-组件规范)
- [Hooks 规范](#hooks-规范)
- [API 服务规范](#api-服务规范)
- [样式规范](#样式规范)
- [命名规范](#命名规范)
- [文件组织规范](#文件组织规范)
- [注释规范](#注释规范)
- [错误处理规范](#错误处理规范)

## TypeScript 规范

### 1. 类型定义

- **集中管理**：所有类型定义应在 `types.ts` 中统一管理
- **避免 any**：禁止使用 `any` 类型，除非有明确的理由
- **字段命名一致**：实体类型字段名必须与后端 API 返回的字段名一致
- **可选字段标记**：使用 `?` 标记可选字段，必填字段不应标记

```typescript
// ✅ 正确
export interface Message {
  message_id: number;
  conversation_id: number;
  message_type: 'user' | 'assistant';
  content: string;
  reasoning?: string;  // 可选字段使用 ?
  created_at: string;
}

// ❌ 错误
export interface Message {
  id: any;  // 不要使用 any
  role: string;  // 字段名与后端不一致
  content?: string;  // 必填字段不应标记为可选
}
```

### 2. 类型注解

- **函数参数**：明确标注所有参数类型
- **函数返回值**：明确标注返回值类型
- **变量声明**：复杂类型的变量应明确标注类型

```typescript
// ✅ 正确
function sendMessage(
  content: string,
  conversationId: number
): Promise<ApiResponse<Message>> {
  // ...
}

// ❌ 错误
function sendMessage(content, conversationId) {
  // 缺少类型注解
}
```

### 3. 严格模式

项目启用 TypeScript 严格模式，必须遵守以下规则：

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

## React 组件规范

### 1. 组件大小

- 单个组件不应超过 **300 行**
- 如果超过，应考虑拆分为多个子组件或提取逻辑到 Hook

### 2. 组件职责

- 每个组件应遵循**单一职责原则**
- 一个组件只负责一个主要功能
- 多个独立功能应拆分为子组件或 Hook

### 3. Props 定义

- 使用 TypeScript 接口定义 Props
- Props 接口命名为 `{ComponentName}Props`
- 为 Props 添加注释说明

```typescript
// ✅ 正确
interface MessageItemProps {
  /** 消息对象 */
  message: Message;
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 复制消息回调 */
  onCopy?: (message: Message) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  showActions = true,
  onCopy
}) => {
  // ...
};
```

### 4. 组件导出

- 使用命名导出（Named Export）
- 组件名使用 PascalCase

```typescript
// ✅ 正确
export const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  // ...
};

// ❌ 错误
export default function chatInterface(props) {
  // ...
}
```

## Hooks 规范

### 1. Hook 命名

- 自定义 Hook 必须以 `use` 开头
- 使用 camelCase 命名

```typescript
// ✅ 正确
export const useChat = () => { /* ... */ };
export const useVRM = () => { /* ... */ };

// ❌ 错误
export const chatHook = () => { /* ... */ };
export const VRMHook = () => { /* ... */ };
```

### 2. Hook 大小

- 单个 Hook 不应超过 **150 行**
- 如果超过，应拆分为多个小的 Hook

### 3. 副作用管理

- 使用 `useEffect` 管理所有副作用
- 正确声明依赖数组
- 清理副作用（返回清理函数）

```typescript
// ✅ 正确
useEffect(() => {
  const timer = setTimeout(() => {
    // ...
  }, 1000);
  
  return () => clearTimeout(timer);  // 清理副作用
}, [dependency]);  // 正确声明依赖

// ❌ 错误
useEffect(() => {
  setTimeout(() => {
    // ...
  }, 1000);
  // 缺少清理函数
}, []);  // 依赖数组不完整
```

### 4. 回调函数优化

- Hook 返回的函数应使用 `useCallback` 包装
- 避免不必要的重渲染

```typescript
// ✅ 正确
const sendMessage = useCallback(async (content: string) => {
  // ...
}, [conversationId]);

return { sendMessage };

// ❌ 错误
const sendMessage = async (content: string) => {
  // 每次渲染都会创建新函数
};

return { sendMessage };
```

## API 服务规范

### 1. 服务层组织

- 按业务领域拆分 API 服务
- 所有 API 调用必须通过服务层
- 组件不应直接使用 `fetch`

```typescript
// ✅ 正确 - services/api/messages.ts
export const messagesApi = {
  getMessages: (conversationId: number) => {
    return httpClient.get<Message[]>(`/messages/${conversationId}`);
  },
  
  sendMessage: (params: SendMessageParams) => {
    return httpClient.post<SendMessageData>('/messages', params);
  }
};

// 在组件中使用
import { messagesApi } from '@/services/api';
const response = await messagesApi.getMessages(conversationId);

// ❌ 错误 - 在组件中直接使用 fetch
const response = await fetch(`/api/messages/${conversationId}`);
```

### 2. 统一的 HTTP 客户端

- 使用 `HttpClient` 类封装所有 HTTP 请求
- 统一处理错误和响应

```typescript
// ✅ 正确
export class HttpClient {
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    // 统一的请求处理
  }
  
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    // 统一的请求处理
  }
}
```

### 3. 错误处理

- 所有 API 调用必须包含错误处理
- 使用统一的错误类型

```typescript
// ✅ 正确
try {
  const response = await messagesApi.sendMessage(params);
  if (response.code === 200) {
    // 处理成功响应
  }
} catch (error) {
  Logger.error('发送消息失败', error);
  showToast('发送消息失败，请重试', 'error');
}
```

## 样式规范

### 1. Tailwind CSS

- 优先使用 Tailwind CSS 工具类
- 避免内联样式
- 复杂样式使用 `clsx` 或 `tailwind-merge` 组合

```typescript
// ✅ 正确
import { cn } from '@/utils/helpers';

<div className={cn(
  'flex items-center gap-2',
  isActive && 'bg-blue-500',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
  {/* ... */}
</div>

// ❌ 错误
<div style={{ display: 'flex', gap: '8px' }}>
  {/* 避免内联样式 */}
</div>
```

### 2. 响应式设计

- 使用 Tailwind 的响应式前缀
- 移动优先设计

```typescript
// ✅ 正确
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* 移动端全宽，平板半宽，桌面三分之一宽 */}
</div>
```

## 命名规范

### 1. 变量和函数

- 使用 **camelCase**
- 使用语义化的英文命名
- 布尔值使用 `is`、`has`、`should` 等前缀

```typescript
// ✅ 正确
const messageList = [];
const isLoading = false;
const hasError = false;
const shouldShowModal = true;

function sendMessage() { /* ... */ }
function handleClick() { /* ... */ }

// ❌ 错误
const MessageList = [];  // 应使用 camelCase
const loading = false;   // 布尔值应有前缀
const 消息列表 = [];      // 不要使用中文
```

### 2. 常量

- 使用 **UPPER_SNAKE_CASE**
- 在 `constants.ts` 中集中管理

```typescript
// ✅ 正确 - utils/constants.ts
export const API_BASE_URL = '/api/v1';
export const MAX_MESSAGE_LENGTH = 1000;
export const DEFAULT_TIMEOUT = 30000;

// ❌ 错误
const apiUrl = '/api/v1';  // 常量应使用大写
const maxLength = 1000;
```

### 3. 类型和接口

- 使用 **PascalCase**
- 接口名不使用 `I` 前缀

```typescript
// ✅ 正确
export interface Message { /* ... */ }
export type MessageType = 'user' | 'assistant';

// ❌ 错误
export interface IMessage { /* ... */ }  // 不要使用 I 前缀
export interface message { /* ... */ }   // 应使用 PascalCase
```

### 4. 文件命名

- 组件文件：**PascalCase** (如 `ChatInterface.tsx`)
- 工具文件：**camelCase** (如 `helpers.ts`)
- Hook 文件：**camelCase** (如 `useChat.ts`)

## 文件组织规范

### 1. 导入顺序

```typescript
// 1. React 相关
import React, { useState, useEffect } from 'react';

// 2. 第三方库
import { clsx } from 'clsx';

// 3. 内部模块（按字母顺序）
import { Button } from '@/components/ui';
import { useChat } from '@/hooks';
import { messagesApi } from '@/services/api';
import { Logger } from '@/utils/logger';

// 4. 类型定义
import type { Message, Character } from '@/types';

// 5. 样式文件（如果有）
import './styles.css';
```

### 2. 组件结构

```typescript
// 1. 导入
import React from 'react';

// 2. 类型定义
interface ComponentProps {
  // ...
}

// 3. 常量（如果有）
const DEFAULT_VALUE = 10;

// 4. 组件定义
export const Component: React.FC<ComponentProps> = (props) => {
  // 4.1 Props 解构
  const { prop1, prop2 } = props;
  
  // 4.2 Hooks
  const [state, setState] = useState();
  const value = useCustomHook();
  
  // 4.3 副作用
  useEffect(() => {
    // ...
  }, []);
  
  // 4.4 事件处理函数
  const handleClick = () => {
    // ...
  };
  
  // 4.5 渲染逻辑
  return (
    <div>
      {/* ... */}
    </div>
  );
};

// 5. 辅助函数（如果有）
function helperFunction() {
  // ...
}
```

## 注释规范

### 1. 函数注释

- 使用 JSDoc 格式
- 说明函数功能、参数、返回值

```typescript
/**
 * 发送消息到指定会话
 * @param content - 消息内容
 * @param conversationId - 会话 ID
 * @returns 发送结果
 */
async function sendMessage(
  content: string,
  conversationId: number
): Promise<ApiResponse<Message>> {
  // ...
}
```

### 2. 复杂逻辑注释

- 为复杂的业务逻辑添加注释
- 解释"为什么"而不是"是什么"

```typescript
// ✅ 正确
// 需要延迟 100ms 以确保 DOM 更新完成后再滚动
setTimeout(() => {
  scrollToBottom();
}, 100);

// ❌ 错误
// 设置定时器
setTimeout(() => {
  scrollToBottom();
}, 100);
```

### 3. TODO 注释

- 使用 `TODO:` 标记待办事项
- 包含负责人和日期

```typescript
// TODO: [张三 2024-01-15] 优化性能，考虑使用虚拟滚动
```

## 错误处理规范

### 1. 统一的错误类型

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

### 2. 错误处理位置

- **API 层**：捕获网络错误，返回标准化错误
- **Hook 层**：处理业务逻辑错误，提供错误状态
- **组件层**：显示用户友好的错误提示

```typescript
// API 层
export class HttpClient {
  async request<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(endpoint);
      // ...
    } catch (error) {
      Logger.error('网络请求失败', error);
      throw new AppError({
        type: ErrorType.NETWORK_ERROR,
        message: '网络连接失败，请检查网络设置'
      });
    }
  }
}

// Hook 层
export const useChat = () => {
  const [error, setError] = useState<AppError | null>(null);
  
  const sendMessage = async (content: string) => {
    try {
      const response = await messagesApi.sendMessage({ content });
      // ...
    } catch (err) {
      setError(err as AppError);
    }
  };
  
  return { error, sendMessage };
};

// 组件层
const { error, sendMessage } = useChat();

useEffect(() => {
  if (error) {
    showToast(error.message, 'error');
  }
}, [error]);
```

### 3. 日志记录

- 使用统一的 `Logger` 工具
- 不要使用 `console.log`

```typescript
// ✅ 正确
import { Logger } from '@/utils/logger';

Logger.debug('调试信息', { data });
Logger.info('操作成功');
Logger.warn('警告信息');
Logger.error('错误信息', error);

// ❌ 错误
console.log('调试信息');  // 不要使用 console.log
```

## 代码质量工具

### 1. ESLint

项目配置了严格的 ESLint 规则：

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix
```

主要规则：
- `@typescript-eslint/no-explicit-any`: 禁止使用 any
- `@typescript-eslint/no-unused-vars`: 禁止未使用的变量
- `react-hooks/rules-of-hooks`: Hook 使用规则
- `react-hooks/exhaustive-deps`: Hook 依赖检查
- `no-console`: 禁止使用 console
- `no-magic-numbers`: 禁止魔法数字

### 2. TypeScript

```bash
# 类型检查
npm run type-check
```

### 3. 代码格式化

建议使用 Prettier 进行代码格式化（如果配置）。

## 性能优化建议

### 1. 避免不必要的重渲染

- 使用 `React.memo` 包装纯组件
- 使用 `useCallback` 和 `useMemo` 优化

```typescript
// ✅ 正确
export const MessageItem = React.memo<MessageItemProps>(({ message }) => {
  // ...
});

const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);
```

### 2. 懒加载

- 使用 `React.lazy` 和 `Suspense` 进行代码分割

```typescript
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));

<Suspense fallback={<Loading />}>
  <AdminDashboard />
</Suspense>
```

### 3. 虚拟滚动

- 对于长列表，考虑使用虚拟滚动库（如 react-window）

## 总结

遵循这些规范可以：

- ✅ 提高代码质量和可维护性
- ✅ 减少 bug 和类型错误
- ✅ 提升团队协作效率
- ✅ 保持代码风格一致

如有疑问或建议，请在团队中讨论并更新本文档。
