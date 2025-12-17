# 前端开发指南

本指南帮助开发者快速上手项目开发，了解项目架构、开发流程和最佳实践。

## 目录

- [快速开始](#快速开始)
- [项目架构](#项目架构)
- [开发流程](#开发流程)
- [常见任务](#常见任务)
- [调试技巧](#调试技巧)
- [常见问题](#常见问题)

## 快速开始

### 环境要求

- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本
- **编辑器**: 推荐使用 VS Code

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 代码检查

```bash
# TypeScript 类型检查
npm run type-check

# ESLint 代码检查
npm run lint

# ESLint 自动修复
npm run lint:fix
```

## 项目架构

### 技术栈

- **React 19.2**: UI 框架
- **TypeScript 5.8**: 类型安全
- **Vite 6.2**: 构建工具
- **Tailwind CSS**: 样式框架
- **Three.js + @pixiv/three-vrm**: 3D 渲染和 VRM 模型支持
- **react-markdown**: Markdown 渲染

### 目录结构

```
frontend/
├── components/       # UI 组件
│   ├── admin/       # 管理后台组件
│   ├── chat/        # 聊天相关组件
│   ├── settings/    # 设置相关组件
│   └── ui/          # 通用 UI 组件
├── contexts/        # React Context（全局状态）
├── hooks/           # 自定义 Hooks
├── services/        # 服务层
│   └── api/        # API 服务（按业务领域拆分）
├── utils/           # 工具函数
├── types.ts         # TypeScript 类型定义
├── App.tsx          # 应用主组件
└── index.tsx        # 应用入口
```

### 架构分层

```
┌─────────────────────────────────────┐
│         Components (UI 层)          │
│  - 负责 UI 渲染和用户交互           │
│  - 不包含业务逻辑                   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Hooks (逻辑层)              │
│  - 封装可复用的状态逻辑             │
│  - 管理副作用                       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│       Services (服务层)             │
│  - API 调用                         │
│  - 数据转换                         │
│  - 错误处理                         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Backend API                 │
└─────────────────────────────────────┘
```

## 开发流程

### 1. 创建新功能

#### 步骤 1: 定义类型

在 `types.ts` 中添加必要的类型定义：

```typescript
// types.ts
export interface NewFeature {
  id: number;
  name: string;
  description?: string;
}
```

#### 步骤 2: 创建 API 服务

在 `services/api/` 中创建对应的 API 服务：

```typescript
// services/api/newFeature.ts
import { httpClient } from './base';
import type { ApiResponse, NewFeature } from '@/types';

export const newFeatureApi = {
  getList: (): Promise<ApiResponse<NewFeature[]>> => {
    return httpClient.get('/new-features');
  },
  
  create: (data: Partial<NewFeature>): Promise<ApiResponse<NewFeature>> => {
    return httpClient.post('/new-features', data);
  },
  
  update: (id: number, data: Partial<NewFeature>): Promise<ApiResponse<NewFeature>> => {
    return httpClient.put(`/new-features/${id}`, data);
  },
  
  delete: (id: number): Promise<ApiResponse<void>> => {
    return httpClient.delete(`/new-features/${id}`);
  }
};
```

在 `services/api/index.ts` 中导出：

```typescript
// services/api/index.ts
export * from './newFeature';
```

#### 步骤 3: 创建自定义 Hook

在 `hooks/` 中创建 Hook 封装业务逻辑：

```typescript
// hooks/useNewFeature.ts
import { useState, useCallback, useEffect } from 'react';
import { newFeatureApi } from '@/services/api';
import { Logger } from '@/utils/logger';
import type { NewFeature, AppError } from '@/types';

export const useNewFeature = () => {
  const [features, setFeatures] = useState<NewFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  
  const loadFeatures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await newFeatureApi.getList();
      if (response.code === 200) {
        setFeatures(response.data);
      }
    } catch (err) {
      Logger.error('加载功能列表失败', err);
      setError(err as AppError);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const createFeature = useCallback(async (data: Partial<NewFeature>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await newFeatureApi.create(data);
      if (response.code === 200) {
        setFeatures(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (err) {
      Logger.error('创建功能失败', err);
      setError(err as AppError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);
  
  return {
    features,
    isLoading,
    error,
    loadFeatures,
    createFeature
  };
};
```

在 `hooks/index.ts` 中导出：

```typescript
// hooks/index.ts
export * from './useNewFeature';
```

#### 步骤 4: 创建组件

在 `components/` 中创建 UI 组件：

```typescript
// components/NewFeatureList.tsx
import React from 'react';
import { useNewFeature } from '@/hooks';
import { Button } from '@/components/ui';

interface NewFeatureListProps {
  onSelect?: (feature: NewFeature) => void;
}

export const NewFeatureList: React.FC<NewFeatureListProps> = ({ onSelect }) => {
  const { features, isLoading, error } = useNewFeature();
  
  if (isLoading) {
    return <div>加载中...</div>;
  }
  
  if (error) {
    return <div className="text-red-500">{error.message}</div>;
  }
  
  return (
    <div className="space-y-2">
      {features.map(feature => (
        <div
          key={feature.id}
          className="p-4 border rounded hover:bg-gray-50 cursor-pointer"
          onClick={() => onSelect?.(feature)}
        >
          <h3 className="font-semibold">{feature.name}</h3>
          {feature.description && (
            <p className="text-sm text-gray-600">{feature.description}</p>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 2. 修改现有功能

1. **定位代码**：根据功能找到对应的组件、Hook 或服务
2. **理解逻辑**：阅读相关代码，理解现有实现
3. **修改代码**：按照代码规范进行修改
4. **测试验证**：在浏览器中测试修改是否正常工作
5. **代码检查**：运行 `npm run type-check` 和 `npm run lint`

### 3. 代码审查清单

提交代码前，请检查：

- [ ] TypeScript 类型检查通过（`npm run type-check`）
- [ ] ESLint 检查通过（`npm run lint`）
- [ ] 代码符合项目规范（参考 `CODE_STANDARDS.md`）
- [ ] 添加了必要的注释
- [ ] 测试了主要功能
- [ ] 没有遗留 `console.log` 或调试代码
- [ ] 没有未使用的导入或变量

## 常见任务

### 添加新的 API 端点

1. 在对应的 API 服务文件中添加方法
2. 确保返回类型正确
3. 添加错误处理

```typescript
// services/api/messages.ts
export const messagesApi = {
  // 现有方法...
  
  // 新增方法
  deleteMessage: (messageId: number): Promise<ApiResponse<void>> => {
    return httpClient.delete(`/messages/${messageId}`);
  }
};
```

### 添加新的常量

在 `utils/constants.ts` 中添加：

```typescript
// utils/constants.ts
export const NEW_CONSTANT = 'value';

export const NEW_CONFIG = {
  timeout: 5000,
  retries: 3
} as const;
```

### 添加新的工具函数

在 `utils/helpers.ts` 中添加：

```typescript
// utils/helpers.ts

/**
 * 格式化日期
 * @param date - 日期对象或时间戳
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN');
}
```

### 添加全局状态

使用 React Context：

```typescript
// contexts/NewContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface NewContextValue {
  value: string;
  setValue: (value: string) => void;
}

const NewContext = createContext<NewContextValue | undefined>(undefined);

export const NewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState('');
  
  return (
    <NewContext.Provider value={{ value, setValue }}>
      {children}
    </NewContext.Provider>
  );
};

export const useNewContext = () => {
  const context = useContext(NewContext);
  if (!context) {
    throw new Error('useNewContext must be used within NewProvider');
  }
  return context;
};
```

在 `App.tsx` 中使用：

```typescript
// App.tsx
import { NewProvider } from '@/contexts/NewContext';

function App() {
  return (
    <NewProvider>
      {/* 其他组件 */}
    </NewProvider>
  );
}
```

## 调试技巧

### 1. 使用 Logger

不要使用 `console.log`，使用统一的 Logger：

```typescript
import { Logger } from '@/utils/logger';

// 开发环境会输出，生产环境不会
Logger.debug('调试信息', { data });
Logger.info('操作成功');
Logger.warn('警告信息');
Logger.error('错误信息', error);
```

### 2. React DevTools

安装 React DevTools 浏览器扩展，可以：

- 查看组件树
- 检查 Props 和 State
- 分析性能

### 3. 网络请求调试

在浏览器开发者工具的 Network 标签中：

- 查看 API 请求和响应
- 检查请求头和响应头
- 查看请求耗时

### 4. TypeScript 错误

如果遇到类型错误：

1. 检查类型定义是否正确
2. 确保导入的类型路径正确
3. 使用 VS Code 的"转到定义"功能查看类型定义

### 5. 性能分析

使用 React DevTools Profiler：

1. 打开 React DevTools
2. 切换到 Profiler 标签
3. 点击录制按钮
4. 执行操作
5. 停止录制，查看性能报告

## 常见问题

### Q1: 如何处理 API 错误？

**A**: 在 Hook 中捕获错误，在组件中显示错误提示：

```typescript
// Hook
const [error, setError] = useState<AppError | null>(null);

try {
  // API 调用
} catch (err) {
  setError(err as AppError);
}

// 组件
useEffect(() => {
  if (error) {
    showToast(error.message, 'error');
  }
}, [error]);
```

### Q2: 如何避免不必要的重渲染？

**A**: 使用 `React.memo`、`useCallback` 和 `useMemo`：

```typescript
// 组件
export const MyComponent = React.memo<MyComponentProps>(({ data }) => {
  // ...
});

// Hook
const memoizedCallback = useCallback(() => {
  // ...
}, [dependency]);

const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);
```

### Q3: 如何处理异步操作？

**A**: 在 Hook 中使用 `async/await`，注意清理：

```typescript
useEffect(() => {
  let cancelled = false;
  
  const fetchData = async () => {
    try {
      const data = await api.getData();
      if (!cancelled) {
        setData(data);
      }
    } catch (error) {
      if (!cancelled) {
        setError(error);
      }
    }
  };
  
  fetchData();
  
  return () => {
    cancelled = true;
  };
}, []);
```

### Q4: 如何处理表单？

**A**: 使用受控组件：

```typescript
const [formData, setFormData] = useState({
  name: '',
  email: ''
});

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: value
  }));
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await api.submit(formData);
};

return (
  <form onSubmit={handleSubmit}>
    <input
      name="name"
      value={formData.name}
      onChange={handleChange}
    />
    <input
      name="email"
      value={formData.email}
      onChange={handleChange}
    />
    <button type="submit">提交</button>
  </form>
);
```

### Q5: 如何处理文件上传？

**A**: 使用 FormData：

```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await httpClient.post('/upload', formData);
    // 处理响应
  } catch (error) {
    Logger.error('文件上传失败', error);
  }
};

// 在组件中
<input
  type="file"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }}
/>
```

### Q6: 如何优化大列表渲染？

**A**: 考虑使用虚拟滚动库（如 react-window）：

```bash
npm install react-window
```

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      {items[index].name}
    </div>
  )}
</FixedSizeList>
```

### Q7: 如何处理路由？

**A**: 项目目前是单页应用，如需添加路由，可以使用 React Router：

```bash
npm install react-router-dom
```

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## 最佳实践

### 1. 组件设计

- **单一职责**：每个组件只负责一个功能
- **可复用性**：通过 Props 配置，而不是硬编码
- **可测试性**：逻辑与 UI 分离

### 2. 状态管理

- **局部状态**：使用 `useState`
- **共享状态**：使用 Context 或状态管理库
- **服务器状态**：通过 API 获取，不要在前端维护副本

### 3. 性能优化

- **懒加载**：使用 `React.lazy` 和 `Suspense`
- **代码分割**：按路由或功能分割
- **避免过度优化**：先保证功能正确，再优化性能

### 4. 错误处理

- **预期错误**：使用 try-catch 捕获
- **意外错误**：使用 Error Boundary
- **用户友好**：显示中文错误提示

### 5. 代码组织

- **按功能分组**：相关的文件放在一起
- **避免深层嵌套**：目录层级不超过 3 层
- **命名清晰**：文件名和函数名要表达清楚意图

## 资源链接

- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vite 官方文档](https://vitejs.dev/)
- [Tailwind CSS 官方文档](https://tailwindcss.com/)
- [Three.js 官方文档](https://threejs.org/)

## 获取帮助

如果遇到问题：

1. 查看本文档和代码规范文档
2. 搜索项目中的类似实现
3. 查阅官方文档
4. 在团队中讨论
5. 提交 Issue

祝开发愉快！🎉
