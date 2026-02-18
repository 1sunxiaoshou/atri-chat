# Components 组织结构说明

本目录包含所有前端 React 组件，按照功能和职责进行分层组织。

## 目录结构

```
components/
├── ui/                          # 基础 UI 组件库
├── layout/                      # 布局组件
├── shared/                      # 共享业务组件
├── admin/                       # 管理功能模块
├── chat/                        # 聊天功能模块
└── settings/                    # 设置功能模块
```

## 各目录说明

### 📦 ui/ - 基础 UI 组件库
**职责**: 提供可复用的纯 UI 组件，不包含业务逻辑

**组件列表**:
- `Button.tsx` - 按钮组件
- `Card.tsx` - 卡片容器组件
- `ConfirmDialog.tsx` - 确认对话框
- `Input.tsx` - 输入框组件
- `Modal.tsx` - 模态框组件
- `Select.tsx` - 下拉选择组件
- `Toast.tsx` - 消息提示组件
- `index.ts` - 统一导出

**使用方式**:
```tsx
import { Button, Modal, Toast } from '@/components/ui';
```

---

### 🏗️ layout/ - 布局组件
**职责**: 提供应用级别的布局结构组件

**组件列表**:
- `Sidebar.tsx` - 侧边栏导航组件
  - 角色列表展示
  - 会话历史管理
  - 导航菜单

**使用方式**:
```tsx
import Sidebar from '@/components/layout/Sidebar';
```

---

### 🔄 shared/ - 共享业务组件
**职责**: 跨模块使用的业务组件

**组件列表**:
- `AvatarEditor.tsx` - 头像编辑器
  - 支持 URL 输入
  - 支持本地文件上传
  - 实时预览

**使用方式**:
```tsx
import { AvatarEditor } from '@/components/shared/AvatarEditor';
```

---

### ⚙️ admin/ - 管理功能模块
**职责**: 系统管理相关的所有功能

**子模块结构**:
```
admin/
├── AdminDashboard.tsx           # 管理面板主入口
├── models/                      # 模型管理子模块
│   └── AdminModels.tsx         # 模型和供应商管理
├── characters/                  # 角色管理子模块
│   ├── AdminCharacters.tsx     # 角色管理主组件
│   ├── CharacterEditor.tsx     # 角色编辑器
│   └── CharacterLibrary.tsx    # 角色库展示
└── vrm/                        # VRM 管理子模块
    └── AdminVRM.tsx            # VRM 模型和动画管理
```

**功能说明**:
- **models/**: 管理 AI 模型供应商和模型配置
- **characters/**: 创建、编辑、删除角色，配置角色属性
- **vrm/**: 上传和管理 VRM 3D 模型及动画

**使用方式**:
```tsx
import AdminDashboard from '@/components/admin/AdminDashboard';
```

---

### 💬 chat/ - 聊天功能模块
**职责**: 聊天界面和消息处理相关功能

**组件列表**:
- `ChatInterface.tsx` - 聊天界面主组件（入口）
- `ChatHeader.tsx` - 聊天头部（角色信息、模型选择）
- `ChatInput.tsx` - 消息输入框（支持语音输入）
- `MessageList.tsx` - 消息列表容器
- `MessageItem.tsx` - 单条消息展示
- `RightSidebar.tsx` - 右侧参数设置面板
- `VRMViewer.tsx` - VRM 3D 模型查看器

**功能说明**:
- 支持文本和语音输入
- 实时流式响应
- Markdown 渲染
- TTS 语音播放
- VRM 模型展示
- 模型参数调整

**使用方式**:
```tsx
import ChatInterface from '@/components/chat/ChatInterface';
```

---

### ⚙️ settings/ - 设置功能模块
**职责**: 应用设置和配置管理

**组件列表**:
- `SettingsModal.tsx` - 设置模态框主组件（入口）
- `GeneralSettings.tsx` - 通用设置（主题、语言、音量）
- `ASRSettings.tsx` - 语音识别配置
- `TTSSettings.tsx` - 语音合成配置
- `ProviderSettingsTemplate.tsx` - 服务商配置模板

**功能说明**:
- 主题切换（亮色/暗色/系统）
- 主题配色选择
- 语言切换
- ASR/TTS 服务商配置
- 音频设置

**使用方式**:
```tsx
import SettingsModal from '@/components/settings/SettingsModal';
```

---

## 组件分类原则

### 何时放入 ui/?
- ✅ 纯 UI 组件，无业务逻辑
- ✅ 高度可复用
- ✅ 不依赖特定业务上下文
- ❌ 包含业务逻辑或状态管理

### 何时放入 layout/?
- ✅ 应用级别的布局结构
- ✅ 导航、侧边栏、顶栏等
- ❌ 页面内部的布局

### 何时放入 shared/?
- ✅ 跨多个功能模块使用
- ✅ 包含一定业务逻辑
- ✅ 不属于特定功能模块
- ❌ 只在单一模块使用

### 何时创建新的功能模块?
- ✅ 功能独立且完整
- ✅ 包含多个相关组件
- ✅ 有明确的业务边界
- ❌ 只有 1-2 个组件

---

## 导入路径规范

### 推荐使用别名导入
```tsx
// ✅ 推荐
import { Button } from '@/components/ui';
import Sidebar from '@/components/layout/Sidebar';

// ❌ 不推荐
import { Button } from '../../../components/ui';
```

### 模块内部相对导入
```tsx
// 在 admin/characters/AdminCharacters.tsx 中
import { CharacterEditor } from './CharacterEditor';  // ✅ 同目录
import { AdminModels } from '../models/AdminModels';  // ✅ 兄弟目录
```

---

## 文件命名规范

- **组件文件**: PascalCase，如 `ChatInterface.tsx`
- **工具文件**: camelCase，如 `helpers.ts`
- **类型文件**: PascalCase，如 `types.ts`
- **样式文件**: kebab-case，如 `chat-interface.css`

---

## 组件开发指南

### 1. 组件结构模板
```tsx
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

interface MyComponentProps {
  // Props 定义
}

const MyComponent: React.FC<MyComponentProps> = ({ ...props }) => {
  const { t } = useLanguage();
  
  return (
    <div className={cn("base-classes", props.className)}>
      {/* 组件内容 */}
    </div>
  );
};

export default MyComponent;
```

### 2. 导出规范
- **默认导出**: 用于主组件
- **命名导出**: 用于类型、工具函数、子组件

```tsx
// ✅ 推荐
export default ChatInterface;
export type { ChatInterfaceProps };

// ui/index.ts 中统一导出
export { default as Button } from './Button';
export * from './Button';
```

### 3. Props 类型定义
```tsx
// ✅ 使用 interface
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children: React.ReactNode;
}

// ✅ 使用泛型
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}
```

---

## 维护指南

### 添加新组件
1. 确定组件类型（ui/layout/shared/功能模块）
2. 在对应目录创建文件
3. 如果是 ui 组件，更新 `ui/index.ts`
4. 更新本文档

### 重构现有组件
1. 评估组件职责是否单一
2. 考虑是否需要拆分
3. 更新所有引用
4. 运行测试确保无破坏性变更

### 删除组件
1. 搜索所有引用
2. 确认无依赖后删除
3. 更新导出文件
4. 更新文档

---

## 常见问题

### Q: Toast 为什么放在 ui/ 而不是 shared/?
A: Toast 是纯 UI 组件，不包含业务逻辑，只负责展示消息。它的使用方式和 Button、Modal 一样通用。

### Q: Sidebar 为什么单独放在 layout/?
A: Sidebar 是应用级别的布局组件，包含导航逻辑。虽然目前只有一个组件，但为未来扩展（如 Header、Footer）预留了空间。

### Q: 如何决定组件放在哪个模块?
A: 遵循"就近原则"：
- 只在一个模块使用 → 放在该模块内
- 在多个模块使用 → 放在 shared/
- 纯 UI 无业务逻辑 → 放在 ui/

### Q: admin 为什么要细分子目录?
A: admin 模块包含多个独立的管理功能（模型、角色、VRM），每个功能有多个组件。细分后：
- 职责更清晰
- 更易维护
- 避免单目录文件过多

---

## 更新日志

### 2024-02-18
- 📦 重组组件目录结构
- 🏗️ 创建 layout/ 目录
- 🔄 创建 shared/ 目录
- ⚙️ 细分 admin/ 子模块
- 📝 创建本文档

---

## 相关文档

- [开发指南](../DEVELOPMENT_GUIDE.md)
- [UI 组件文档](./ui/README.md)
- [类型定义](../../types/index.ts)
