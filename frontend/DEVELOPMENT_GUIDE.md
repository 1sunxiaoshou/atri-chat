# Atri Chat 前端开发准则

## 目录

1. [设计系统概述](#设计系统概述)
2. [语义化颜色系统](#语义化颜色系统)
3. [组件开发规范](#组件开发规范)
4. [样式编写准则](#样式编写准则)
5. [文件组织结构](#文件组织结构)
6. [常见模式与最佳实践](#常见模式与最佳实践)
7. [反模式与禁止事项](#反模式与禁止事项)

---

## 设计系统概述

Atri Chat 采用基于 **语义化 Token** 的设计系统，通过 Tailwind CSS 的 HSL 变量实现主题切换和一致的视觉语言。

### 核心原则

1. **语义化优先**：使用 `bg-primary` 而非 `bg-blue-600`
2. **组件复用**：优先使用 `components/ui` 中的标准组件
3. **响应式设计**：移动优先，使用 Tailwind 的响应式前缀
4. **可访问性**：确保键盘导航、屏幕阅读器支持和适当的对比度
5. **性能优先**：避免不必要的重渲染和大型依赖

---

## 语义化颜色系统

### 可用的语义化 Token

| Token                       | 用途              | 示例                                         |
| --------------------------- | ----------------- | -------------------------------------------- |
| `background`                | 页面主背景        | `bg-background`                              |
| `foreground`                | 主要文本颜色      | `text-foreground`                            |
| `primary`                   | 品牌色/主要操作   | `bg-primary text-primary-foreground`         |
| `secondary`                 | 次要操作          | `bg-secondary text-secondary-foreground`     |
| `muted`                     | 组件背景/禁用状态 | `bg-muted text-muted-foreground`             |
| `accent`                    | 高亮/强调         | `bg-accent text-accent-foreground`           |
| `destructive`               | 危险操作/错误     | `bg-destructive text-destructive-foreground` |
| `border`                    | 边框和分隔线      | `border-border`                              |
| `input`                     | 表单元素边框      | `border-input`                               |
| `card`                      | 卡片容器背景      | `bg-card`                                    |
| `ring`                      | 焦点环            | `ring-ring`                                  |
| `code-block`                | 代码块背景        | `bg-code-block`                              |
| `code-block-header`         | 代码块头部        | `bg-code-block-header`                       |
| `code-inline`               | 行内代码背景      | `bg-code-inline`                             |
| `sidebar`                   | 侧边栏背景        | `bg-sidebar`                                 |
| `sidebar-border`            | 侧边栏边框        | `border-sidebar-border`                      |
| `sidebar-hover`             | 侧边栏悬停        | `bg-sidebar-hover`                           |
| `sidebar-active`            | 侧边栏激活状态    | `bg-sidebar-active`                          |
| `sidebar-active-foreground` | 侧边栏激活文本    | `text-sidebar-active-foreground`             |

### 使用示例

```tsx
// ✅ 正确：使用语义化 Token
<div className="bg-card border border-border rounded-lg p-4">
  <h3 className="text-foreground font-bold">标题</h3>
  <p className="text-muted-foreground">描述文本</p>
</div>

// ✅ 正确：使用侧边栏专用 Token
<div className="bg-sidebar border-r border-sidebar-border">
  <button className="bg-sidebar-hover hover:bg-sidebar-active text-sidebar-active-foreground">
    导航项
  </button>
</div>

// ✅ 正确：使用代码块专用 Token
<div className="bg-code-block">
  <div className="bg-code-block-header text-muted-foreground">
    代码头部
  </div>
  <code className="bg-code-inline">行内代码</code>
</div>

// ❌ 错误：硬编码颜色
<div className="bg-white border border-gray-200 rounded-lg p-4">
  <h3 className="text-gray-900 font-bold">标题</h3>
  <p className="text-gray-600">描述文本</p>
</div>
```

### 透明度修饰符

使用 `/` 语法添加透明度：

```tsx
<div className="bg-primary/10">  {/* 10% 透明度 */}
<div className="bg-muted/50">    {/* 50% 透明度 */}
<div className="border-border/30"> {/* 30% 透明度 */}
```

---

## 组件开发规范

### 使用标准 UI 组件

所有新功能必须优先使用 `components/ui` 中的标准组件：

```tsx
import { Button, Input, Select, Card, Modal, ConfirmDialog } from '../components/ui';

// ✅ 正确
<Button variant="primary" size="lg" onClick={handleClick}>
  提交
</Button>

// ❌ 错误：自定义按钮样式
<button className="px-4 py-2 bg-blue-500 text-white rounded">
  提交
</button>
```

### 标准组件清单

#### Button

```tsx
<Button variant="default | secondary | outline | ghost | destructive"
        size="sm | default | lg | icon"
        loading={boolean}
        disabled={boolean}>
  按钮文本
</Button>
```

#### Input

```tsx
<Input
  label="标签"
  placeholder="占位符"
  value={value}
  onChange={handleChange}
  error="错误信息"
  description="帮助文本"
  icon={<Icon />}
  type="text | password | email"
  showPasswordToggle={boolean}
  required={boolean}
/>
```

#### Select

```tsx
<Select
  value={value}
  onChange={setValue}
  options={[
    { label: '选项1', value: 'opt1', icon: <Icon /> },
    { label: '选项2', value: 'opt2', group: '分组名' }
  ]}
/>
```

#### Card

```tsx
<Card className="additional-classes">
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>
    内容区域
  </CardContent>
  <CardFooter>
    底部操作
  </CardFooter>
</Card>
```

#### Modal

```tsx
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="模态框标题">
  <div className="p-6">
    模态框内容
  </div>
</Modal>
```

#### ConfirmDialog

```tsx
<ConfirmDialog
  isOpen={isOpen}
  onClose={handleClose}
  onConfirm={handleConfirm}
  title="确认操作"
  description="详细描述"
  type="danger | warning | info | success"
  confirmText="确认"
  cancelText="取消"
/>
```

---

## 样式编写准则

### 1. 使用 `cn` 工具函数

```tsx
import { cn } from '../utils/cn';

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  variant === 'primary' && "variant-classes"
)}>
```

### 2. 响应式设计

```tsx
<div className="
  flex flex-col          // 移动端：垂直布局
  lg:flex-row            // 大屏：水平布局
  gap-4                  // 移动端间距
  lg:gap-6               // 大屏间距
">
```

### 3. 动画和过渡

使用 Tailwind 的内置动画类：

```tsx
<div className="
  transition-all duration-300
  hover:scale-105
  animate-in fade-in slide-in-from-bottom-4
">
```

### 4. Glassmorphism 效果

用于 VRM 模式的浮动面板：

```tsx
<div className="bg-card/80 backdrop-blur-xl border border-border/50">
```

### 5. 空状态设计

```tsx
<div className="flex flex-col items-center justify-center py-20 px-6">
  <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
    <Icon size={40} className="text-primary" />
  </div>
  <h3 className="text-xl font-bold text-foreground mb-2">空状态标题</h3>
  <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
    描述文本
  </p>
  <Button onClick={handleAction}>
    操作按钮
  </Button>
</div>
```

---

## 文件组织结构

```
frontend/
├── components/
│   ├── ui/                    # 基础 UI 组件（不要修改）
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── index.ts
│   ├── chat/                  # 聊天相关组件
│   ├── admin/                 # 管理界面组件
│   ├── settings/              # 设置界面组件
│   └── [Feature].tsx          # 功能组件
├── pages/                     # 页面组件
│   └── StyleGuide.tsx         # 设计系统文档
├── contexts/                  # React Context
├── services/                  # API 服务
├── utils/                     # 工具函数
│   └── cn.ts                  # 类名合并工具
├── types/                     # TypeScript 类型定义
└── src/
    └── index.css              # 全局样式和 Token 定义
```

### 命名规范

- **组件文件**：PascalCase（`ChatInterface.tsx`）
- **工具函数**：camelCase（`buildAvatarUrl.ts`）
- **常量文件**：UPPER_SNAKE_CASE（`API_ENDPOINTS.ts`）
- **CSS 类名**：kebab-case（Tailwind 标准）

---

## 常见模式与最佳实践

### 1. 列表渲染

```tsx
// ✅ 正确：使用唯一 key
{items.map(item => (
  <div key={item.id}>
    {item.name}
  </div>
))}

// ❌ 错误：使用索引作为 key
{items.map((item, index) => (
  <div key={index}>
    {item.name}
  </div>
))}
```

### 2. 条件渲染

```tsx
// ✅ 正确：使用三元运算符或 &&
{isLoading ? (
  <Spinner />
) : (
  <Content />
)}

{hasData && <DataDisplay />}

// ❌ 错误：使用 if-else 语句
{(() => {
  if (isLoading) {
    return <Spinner />;
  } else {
    return <Content />;
  }
})()}
```

### 3. 事件处理

```tsx
// ✅ 正确：使用箭头函数或 useCallback
const handleClick = useCallback(() => {
  // 处理逻辑
}, [dependencies]);

<Button onClick={handleClick}>点击</Button>

// ❌ 错误：内联创建新函数
<Button onClick={() => handleClick()}>点击</Button>
```

### 4. 状态管理

```tsx
// ✅ 正确：使用 useState 和 useEffect
const [data, setData] = useState<Data[]>([]);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  fetchData();
}, []);

// ✅ 正确：使用 Context 共享全局状态
const { user, setUser } = useAuth();
```

### 5. 表单处理

```tsx
// ✅ 正确：受控组件
const [formData, setFormData] = useState({ name: '', email: '' });

<Input
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
/>
```

### 6. 加载状态

```tsx
// ✅ 正确：统一的加载指示器
{isLoading ? (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
  </div>
) : (
  <Content />
)}
```

### 7. 错误处理

```tsx
// ✅ 正确：显示友好的错误信息
{error && (
  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
    <p className="text-sm text-destructive">{error}</p>
  </div>
)}
```

---

## 反模式与禁止事项

### ❌ 禁止硬编码颜色

```tsx
// ❌ 错误
<div className="bg-blue-600 text-white">

// ✅ 正确
<div className="bg-primary text-primary-foreground">
```

### ❌ 禁止内联样式

```tsx
// ❌ 错误
<div style={{ backgroundColor: '#3b82f6', padding: '16px' }}>

// ✅ 正确
<div className="bg-primary p-4">
```

### ❌ 禁止重复的样式代码

```tsx
// ❌ 错误：重复的按钮样式
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">

// ✅ 正确：使用标准 Button 组件
<Button>按钮1</Button>
<Button>按钮2</Button>
```

### ❌ 禁止不必要的 div 嵌套

```tsx
// ❌ 错误
<div>
  <div>
    <div>
      <p>内容</p>
    </div>
  </div>
</div>

// ✅ 正确
<p>内容</p>
```

### ❌ 禁止使用 !important

```css
/* ❌ 错误 */
.custom-class {
  color: red !important;
}

/* ✅ 正确：使用更具体的选择器或调整 Tailwind 配置 */
```

### ❌ 禁止直接修改 UI 组件库

```tsx
// ❌ 错误：直接修改 components/ui/Button.tsx

// ✅ 正确：创建新的组件或使用 className 扩展
<Button className="custom-additional-styles">
```

### ❌ 禁止使用魔法数字

```tsx
// ❌ 错误
<div className="w-[247px] h-[83px]">

// ✅ 正确：使用 Tailwind 的标准尺寸
<div className="w-64 h-20">
```

---

## 性能优化建议

### 1. 使用 React.memo

```tsx
export const ExpensiveComponent = React.memo(({ data }) => {
  // 组件逻辑
});
```

### 2. 懒加载组件

```tsx
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

<Suspense fallback={<Spinner />}>
  <AdminDashboard />
</Suspense>
```

### 3. 避免不必要的重渲染

```tsx
// ✅ 使用 useCallback 和 useMemo
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
const memoizedCallback = useCallback(() => doSomething(a, b), [a, b]);
```

### 4. 优化图片加载

```tsx
<img
  src={imageUrl}
  alt="描述"
  loading="lazy"
  className="w-full h-full object-cover"
/>
```

---

## 可访问性检查清单

- [ ] 所有交互元素可通过键盘访问
- [ ] 使用语义化 HTML 标签（`<button>` 而非 `<div onClick>`）
- [ ] 图片包含 `alt` 属性
- [ ] 表单元素有关联的 `<label>`
- [ ] 颜色对比度符合 WCAG AA 标准（4.5:1）
- [ ] 焦点状态清晰可见（使用 `focus:ring-2 focus:ring-ring`）
- [ ] 使用 ARIA 属性增强语义（`aria-label`, `aria-describedby`）

---

## 测试建议

### 1. 组件测试

```tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('Button 点击事件', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>点击</Button>);

  fireEvent.click(screen.getByText('点击'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### 2. 快照测试

```tsx
test('Card 组件快照', () => {
  const { container } = render(
    <Card>
      <CardContent>内容</CardContent>
    </Card>
  );
  expect(container).toMatchSnapshot();
});
```

---

## 参考资源

- **设计系统文档**：访问 `/style-guide` 查看实时组件示例
- **Tailwind CSS 文档**：https://tailwindcss.com/docs
- **React 最佳实践**：https://react.dev/learn
- **可访问性指南**：https://www.w3.org/WAI/WCAG21/quickref/

---

## 更新日志

- **2026-02-17**：初始版本，建立设计系统和开发规范
- **2026-02-17**：新增语义化颜色 Token（code-block, sidebar 系列），修复 Sidebar.tsx 和 markdownConfig.tsx 的硬编码颜色问题

---

**维护者**：前端团队
**最后更新**：2026-02-17
