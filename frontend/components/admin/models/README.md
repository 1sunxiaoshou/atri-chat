# AdminModels 组件

模型管理界面，用于管理 AI 模型供应商和模型配置。

## 组件结构

```
models/
├── AdminModels.tsx       # 主组件，负责状态管理和业务逻辑
├── ProviderList.tsx      # 左侧供应商列表
├── ModelToolbar.tsx      # 顶部工具栏（搜索、筛选、操作按钮）
├── ModelTable.tsx        # 模型表格（带图标化能力标签）
├── ProviderModal.tsx     # 供应商编辑弹窗
├── ModelModal.tsx        # 模型编辑弹窗
└── index.ts              # 导出文件
```

## 主要优化

### 1. 代码结构
- 从单一 300+ 行组件拆分为 6 个独立子组件
- 每个子组件职责单一，易于维护和测试
- 主组件专注于状态管理和业务逻辑

### 2. 视觉优化
- **选中指示条**：Provider 列表选中项左侧显示精致的指示条
- **图标化能力标签**：模型能力使用图标展示（vision/audio/tool_use 等）
- **Hover 效果**：操作按钮仅在 hover 时显示，界面更简洁
- **分组表单**：弹窗内容按"基本信息"、"API 配置"等分组

### 3. 交互体验
- **Tooltip**：能力图标 hover 显示完整名称
- **过渡动画**：所有交互都有流畅的过渡效果
- **视觉反馈**：同步按钮显示 loading 状态

## 使用示例

```tsx
import { AdminModels } from './components/admin/models';

<AdminModels
  providers={providers}
  models={models}
  providerTemplates={templates}
  onRefresh={handleRefresh}
/>
```

## 能力图标映射

| 能力       | 图标            |
| ---------- | --------------- |
| vision     | Eye (眼睛)      |
| document   | FileText (文档) |
| video      | Video (视频)    |
| audio      | Mic (麦克风)    |
| reasoning  | Brain (大脑)    |
| tool_use   | Wrench (扳手)   |
| web_search | Globe (地球)    |
