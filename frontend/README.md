# Atri Chat 前端项目

基于 React + TypeScript + Tailwind CSS 构建的现代化聊天应用前端。

## 🎨 设计系统

本项目采用**语义化 Token** 设计系统，支持深色模式，确保视觉一致性和可维护性。

### 核心特性

- ✅ **语义化颜色系统**：使用 `bg-primary` 而非硬编码颜色值
- ✅ **标准化 UI 组件库**：Button, Input, Select, Card, Modal 等
- ✅ **深色模式支持**：基于 HSL 变量的主题切换
- ✅ **响应式设计**：移动优先，适配各种屏幕尺寸
- ✅ **Glassmorphism 效果**：用于 VRM 3D 模式的现代视觉效果
- ✅ **完整的文档**：设计规范、组件文档、开发指南

## 📁 项目结构

```
frontend/
├── components/
│   ├── ui/                    # 🎯 标准 UI 组件库
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── README.md          # 组件快速参考
│   ├── chat/                  # 聊天界面组件
│   ├── admin/                 # 管理界面组件
│   ├── settings/              # 设置界面组件
│   └── [其他功能组件]
├── pages/
│   └── StyleGuide.tsx         # 🎨 设计系统文档（访问 /style-guide）
├── contexts/                  # React Context 状态管理
├── services/                  # API 服务层
├── utils/
│   └── cn.ts                  # 类名合并工具
├── types/                     # TypeScript 类型定义
├── src/
│   └── index.css              # 全局样式和 Token 定义
├── DEVELOPMENT_GUIDE.md       # 📖 完整开发规范
└── README.md                  # 本文件
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 📚 文档导航

### 新手入门

1. **阅读设计系统文档**
   - 在浏览器访问 `/style-guide` 查看实时组件示例
   - 了解颜色系统、组件变体、交互模式

2. **查看组件快速参考**
   - 阅读 `components/ui/README.md`
   - 学习如何使用标准 UI 组件

3. **学习开发规范**
   - 阅读 `DEVELOPMENT_GUIDE.md`
   - 了解代码风格、最佳实践、反模式

### 开发者指南

#### 创建新功能

```tsx
// 1. 导入标准组件
import { Button, Input, Card } from '../components/ui';

// 2. 使用语义化颜色
<div className="bg-card border border-border rounded-lg p-4">
  <h3 className="text-foreground font-bold">标题</h3>
  <p className="text-muted-foreground">描述</p>
</div>

// 3. 使用标准组件
<Button variant="primary" size="lg" onClick={handleClick}>
  提交
</Button>
```

#### 样式编写规范

```tsx
// ✅ 正确：使用语义化 Token
<div className="bg-primary text-primary-foreground">

// ❌ 错误：硬编码颜色
<div className="bg-blue-600 text-white">

// ✅ 正确：使用标准组件
<Button>点击</Button>

// ❌ 错误：自定义按钮样式
<button className="px-4 py-2 bg-blue-500 rounded">点击</button>
```

## 🎯 核心概念

### 1. 语义化颜色系统

所有颜色都通过语义化 Token 定义，支持主题切换：

| Token | 用途 | 示例 |
|-------|------|------|
| `primary` | 品牌色/主要操作 | `bg-primary` |
| `secondary` | 次要操作 | `bg-secondary` |
| `muted` | 组件背景 | `bg-muted` |
| `destructive` | 危险操作 | `bg-destructive` |
| `border` | 边框 | `border-border` |
| `card` | 卡片容器 | `bg-card` |

### 2. 标准 UI 组件

所有新功能必须使用 `components/ui` 中的标准组件：

- **Button**：5 种变体（default, secondary, outline, ghost, destructive）
- **Input**：支持图标、密码切换、错误提示
- **Select**：支持分组、图标
- **Card**：标准化卡片容器
- **Modal**：模态框
- **ConfirmDialog**：确认对话框

### 3. 响应式设计

使用 Tailwind 的响应式前缀：

```tsx
<div className="
  flex flex-col          // 移动端：垂直布局
  lg:flex-row            // 大屏：水平布局
  gap-4 lg:gap-6         // 响应式间距
">
```

### 4. 深色模式

组件自动适配深色模式，通过 `.dark` 类切换：

```tsx
// 切换深色模式
document.documentElement.classList.toggle('dark');
```

## 🛠️ 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS 3
- **状态管理**：React Context + Hooks
- **路由**：React Router
- **图标**：Lucide React
- **3D 渲染**：Three.js + @pixiv/three-vrm
- **工具库**：clsx + tailwind-merge

## 📋 开发规范

### 必须遵守

1. ✅ 使用语义化颜色 Token（`bg-primary` 而非 `bg-blue-600`）
2. ✅ 使用标准 UI 组件（`<Button>` 而非自定义按钮）
3. ✅ 使用 `cn` 工具函数合并类名
4. ✅ 保持响应式设计（移动优先）
5. ✅ 确保可访问性（键盘导航、ARIA 属性）

### 禁止事项

1. ❌ 硬编码颜色值
2. ❌ 使用内联样式
3. ❌ 直接修改 `components/ui` 中的组件
4. ❌ 使用 `!important`
5. ❌ 重复的样式代码

详细规范请查看 `DEVELOPMENT_GUIDE.md`

## 🎨 设计资源

### 在线文档

访问 `/style-guide` 查看：
- 颜色系统示例
- 所有组件的实时预览
- 交互模式演示
- 主题切换效果

### 本地文档

- `DEVELOPMENT_GUIDE.md` - 完整开发规范
- `components/ui/README.md` - 组件快速参考

## 🔧 常见任务

### 添加新页面

```tsx
// pages/NewPage.tsx
import { Card, Button } from '../components/ui';

export const NewPage = () => {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardContent>
          页面内容
        </CardContent>
      </Card>
    </div>
  );
};
```

### 创建表单

```tsx
import { Input, Select, Button } from '../components/ui';

<form onSubmit={handleSubmit} className="space-y-6">
  <Input
    label="用户名"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    required
  />
  <Select
    value={role}
    onChange={setRole}
    options={roleOptions}
  />
  <Button type="submit">提交</Button>
</form>
```

### 显示确认对话框

```tsx
import { ConfirmDialog } from '../components/ui';

<ConfirmDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleDelete}
  title="确认删除"
  description="此操作不可撤销"
  type="danger"
/>
```

## 🐛 故障排除

### 样式不生效

1. 确保使用语义化 Token（`bg-primary` 而非 `bg-blue-600`）
2. 检查 Tailwind 配置是否正确
3. 清除缓存：`rm -rf node_modules/.vite`

### 组件导入错误

```tsx
// ✅ 正确
import { Button, Input } from '../components/ui';

// ❌ 错误
import Button from '../components/ui/Button';
```

### 深色模式不工作

确保根元素有 `.dark` 类：

```tsx
document.documentElement.classList.add('dark');
```

## 📝 贡献指南

1. 阅读 `DEVELOPMENT_GUIDE.md` 了解开发规范
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 遵循代码风格和组件使用规范
4. 提交前检查：
   - 代码符合 ESLint 规则
   - 使用了标准 UI 组件
   - 没有硬编码颜色
   - 响应式设计正常工作
5. 提交 Pull Request

## 📞 获取帮助

- **设计系统问题**：查看 `/style-guide` 页面
- **组件使用问题**：阅读 `components/ui/README.md`
- **开发规范问题**：参考 `DEVELOPMENT_GUIDE.md`
- **代码示例**：查看现有组件（如 `AdminCharacters.tsx`）

## 📄 许可证

[项目许可证信息]

---

**维护者**：前端团队
**最后更新**：2026-02-17
**版本**：2.0.0（设计系统重构版本）
