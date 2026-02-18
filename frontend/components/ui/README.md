# UI 组件库快速参考

这是 Atri Chat 的标准 UI 组件库。所有组件都基于语义化 Token 构建，支持深色模式。

## 快速导入

```tsx
import { Button, Input, Select, Card, Modal, ConfirmDialog, Toast } from '@/components/ui';
// 或
import { Button, Input, Select, Card, Modal, ConfirmDialog, Toast } from '../components/ui';
```

---

## 组件列表

- [Button 按钮](#button-按钮)
- [Input 输入框](#input-输入框)
- [Select 下拉选择](#select-下拉选择)
- [Card 卡片](#card-卡片)
- [Modal 模态框](#modal-模态框)
- [ConfirmDialog 确认对话框](#confirmdialog-确认对话框)
- [Toast 消息提示](#toast-消息提示) ⭐ 新增

---

## Button 按钮

### 基础用法

```tsx
<Button>默认按钮</Button>
```

### 变体

```tsx
<Button variant="default">主要操作</Button>
<Button variant="secondary">次要操作</Button>
<Button variant="outline">轮廓按钮</Button>
<Button variant="ghost">幽灵按钮</Button>
<Button variant="destructive">危险操作</Button>
```

### 尺寸

```tsx
<Button size="sm">小按钮</Button>
<Button size="default">默认</Button>
<Button size="lg">大按钮</Button>
<Button size="icon"><Icon /></Button>
```

### 状态

```tsx
<Button loading>加载中...</Button>
<Button disabled>禁用</Button>
```

### Props

| 属性      | 类型                                                      | 默认值    | 说明          |
| --------- | --------------------------------------------------------- | --------- | ------------- |
| variant   | `default \| secondary \| outline \| ghost \| destructive` | `default` | 按钮变体      |
| size      | `sm \| default \| lg \| icon`                             | `default` | 按钮尺寸      |
| loading   | `boolean`                                                 | `false`   | 加载状态      |
| disabled  | `boolean`                                                 | `false`   | 禁用状态      |
| className | `string`                                                  | -         | 额外的 CSS 类 |
| onClick   | `() => void`                                              | -         | 点击事件      |

---

## Input 输入框

### 基础用法

```tsx
<Input
  label="用户名"
  placeholder="请输入用户名"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### 带图标

```tsx
<Input
  label="搜索"
  icon={<Search size={18} />}
  placeholder="搜索内容..."
/>
```

### 密码输入

```tsx
<Input
  label="密码"
  type="password"
  showPasswordToggle
  placeholder="请输入密码"
/>
```

### 错误状态

```tsx
<Input
  label="邮箱"
  error="邮箱格式不正确"
  value={email}
/>
```

### 帮助文本

```tsx
<Input
  label="API Key"
  description="从供应商控制台获取"
  placeholder="sk-..."
/>
```

### Props

| 属性               | 类型                                  | 默认值  | 说明         |
| ------------------ | ------------------------------------- | ------- | ------------ |
| label              | `string`                              | -       | 标签文本     |
| placeholder        | `string`                              | -       | 占位符       |
| value              | `string`                              | -       | 输入值       |
| onChange           | `(e) => void`                         | -       | 变化事件     |
| type               | `text \| password \| email \| number` | `text`  | 输入类型     |
| error              | `string`                              | -       | 错误信息     |
| description        | `string`                              | -       | 帮助文本     |
| icon               | `ReactNode`                           | -       | 左侧图标     |
| showPasswordToggle | `boolean`                             | `false` | 显示密码切换 |
| required           | `boolean`                             | `false` | 必填标记     |
| disabled           | `boolean`                             | `false` | 禁用状态     |

---

## Select 下拉选择

### 基础用法

```tsx
<Select
  value={value}
  onChange={setValue}
  options={[
    { label: '选项1', value: 'opt1' },
    { label: '选项2', value: 'opt2' },
  ]}
/>
```

### 带图标

```tsx
<Select
  value={model}
  onChange={setModel}
  options={[
    { label: 'GPT-4', value: 'gpt4', icon: <Sparkles size={14} /> },
    { label: 'Claude', value: 'claude', icon: <Brain size={14} /> },
  ]}
/>
```

### 分组选项

```tsx
<Select
  value={value}
  onChange={setValue}
  options={[
    { label: '基础模型', value: 'basic', group: '免费' },
    { label: '高级模型', value: 'advanced', group: '付费' },
  ]}
/>
```

### Props

| 属性        | 类型                      | 默认值  | 说明          |
| ----------- | ------------------------- | ------- | ------------- |
| value       | `string`                  | -       | 当前值        |
| onChange    | `(value: string) => void` | -       | 变化回调      |
| options     | `Option[]`                | `[]`    | 选项列表      |
| placeholder | `string`                  | -       | 占位符        |
| disabled    | `boolean`                 | `false` | 禁用状态      |
| className   | `string`                  | -       | 额外的 CSS 类 |

**Option 类型：**

```tsx
interface Option {
  label: string;
  value: string;
  icon?: ReactNode;
  group?: string;
}
```

---

## Card 卡片

### 基础用法

```tsx
<Card>
  <CardContent>
    卡片内容
  </CardContent>
</Card>
```

### 完整结构

```tsx
<Card>
  <CardHeader>
    <CardTitle>卡片标题</CardTitle>
    <CardDescription>卡片描述</CardDescription>
  </CardHeader>
  <CardContent>
    主要内容区域
  </CardContent>
  <CardFooter>
    <Button>操作</Button>
  </CardFooter>
</Card>
```

### 自定义样式

```tsx
<Card className="bg-muted/30 border-primary/20">
  <CardContent className="p-8">
    自定义内容
  </CardContent>
</Card>
```

---

## Modal 模态框

### 基础用法

```tsx
const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="模态框标题"
>
  <div className="p-6 space-y-4">
    <p>模态框内容</p>
    <div className="flex justify-end gap-3">
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        取消
      </Button>
      <Button onClick={handleSubmit}>
        确认
      </Button>
    </div>
  </div>
</Modal>
```

### Props

| 属性     | 类型         | 默认值 | 说明     |
| -------- | ------------ | ------ | -------- |
| isOpen   | `boolean`    | -      | 是否打开 |
| onClose  | `() => void` | -      | 关闭回调 |
| title    | `string`     | -      | 标题     |
| children | `ReactNode`  | -      | 内容     |

---

## ConfirmDialog 确认对话框

### 基础用法

```tsx
const [isOpen, setIsOpen] = useState(false);

<ConfirmDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleConfirm}
  title="确认删除"
  description="此操作不可撤销，确定要删除吗？"
  type="danger"
  confirmText="删除"
  cancelText="取消"
/>
```

### 类型变体

```tsx
<ConfirmDialog type="danger" />    // 危险操作（红色）
<ConfirmDialog type="warning" />   // 警告（黄色）
<ConfirmDialog type="info" />      // 信息（蓝色）
<ConfirmDialog type="success" />   // 成功（绿色）
```

### Props

| 属性        | 类型                                   | 默认值 | 说明         |
| ----------- | -------------------------------------- | ------ | ------------ |
| isOpen      | `boolean`                              | -      | 是否打开     |
| onClose     | `() => void`                           | -      | 关闭回调     |
| onConfirm   | `() => void`                           | -      | 确认回调     |
| title       | `string`                               | -      | 标题         |
| description | `ReactNode`                            | -      | 描述内容     |
| type        | `danger \| warning \| info \| success` | `info` | 对话框类型   |
| confirmText | `string`                               | `确认` | 确认按钮文本 |
| cancelText  | `string`                               | `取消` | 取消按钮文本 |

---

## Toast 消息提示

### 基础用法

```tsx
import { useState } from 'react';
import Toast, { ToastMessage } from '@/components/ui';

const MyComponent = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showSuccess = () => {
    setToast({ success: true, message: '操作成功！' });
    setTimeout(() => setToast(null), 3000);
  };

  const showError = () => {
    setToast({ success: false, message: '操作失败，请重试' });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      <Toast message={toast} />
      <Button onClick={showSuccess}>显示成功</Button>
      <Button onClick={showError}>显示错误</Button>
    </>
  );
};
```

### 自定义标题

```tsx
<Toast 
  message={toast} 
  title={{ success: '成功', error: '错误' }}
/>
```

### Props

| 属性    | 类型                                 | 默认值                                   | 说明     |
| ------- | ------------------------------------ | ---------------------------------------- | -------- |
| message | `ToastMessage \| null`               | -                                        | 消息对象 |
| title   | `{ success: string; error: string }` | `{ success: 'Success', error: 'Error' }` | 标题文本 |

**ToastMessage 类型：**

```tsx
interface ToastMessage {
  success: boolean;  // true: 成功（绿色），false: 错误（红色）
  message: string;   // 消息内容
}
```

### 特性

- ✅ 自动定位在右上角
- ✅ 淡入淡出动画
- ✅ 成功/错误两种状态
- ✅ 自动适配深色模式
- ✅ 响应式设计

### 使用建议

1. **自动消失**：建议 3 秒后自动隐藏
2. **单例模式**：同一时间只显示一个 Toast
3. **简短明了**：消息文本保持简洁

```tsx
// ✅ 推荐
setToast({ success: true, message: '保存成功' });

// ❌ 不推荐（过长）
setToast({ 
  success: true, 
  message: '您的配置已经成功保存到服务器，系统将在 3 秒后自动刷新页面...' 
});
```

---

## 常见组合模式

### 表单布局

```tsx
<Card>
  <CardHeader>
    <CardTitle>用户设置</CardTitle>
    <CardDescription>管理你的账户信息</CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    <Input
      label="用户名"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
    />
    <Input
      label="邮箱"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
    <Select
      value={role}
      onChange={setRole}
      options={roleOptions}
    />
  </CardContent>
  <CardFooter className="flex justify-end gap-3">
    <Button variant="outline">取消</Button>
    <Button>保存</Button>
  </CardFooter>
</Card>
```

### 列表操作

```tsx
<Card>
  <CardHeader>
    <div className="flex justify-between items-center">
      <CardTitle>项目列表</CardTitle>
      <Button size="sm" onClick={handleAdd}>
        <Plus size={16} className="mr-2" />
        添加
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {items.map(item => (
      <div key={item.id} className="flex justify-between items-center p-3 hover:bg-muted/50 rounded-lg">
        <span>{item.name}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
            <Edit2 size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
            <Trash size={16} />
          </Button>
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

### 空状态

```tsx
<div className="flex flex-col items-center justify-center py-20 px-6">
  <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 ring-4 ring-background shadow-2xl">
    <Icon size={40} className="text-primary" />
  </div>
  <h3 className="text-xl font-bold text-foreground mb-2">
    暂无数据
  </h3>
  <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
    点击下方按钮开始创建
  </p>
  <Button onClick={handleCreate}>
    <Plus size={18} className="mr-2" />
    创建新项目
  </Button>
</div>
```

---

## 样式扩展

所有组件都支持通过 `className` 属性扩展样式：

```tsx
<Button className="w-full">全宽按钮</Button>
<Input className="max-w-xs" />
<Card className="shadow-2xl border-primary/20" />
```

使用 `cn` 工具函数合并类名：

```tsx
import { cn } from '../../utils/cn';

<Button className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === 'special' && "special-classes"
)}>
```

---

## 主题适配

所有组件自动支持深色模式。通过在根元素添加 `.dark` 类切换主题：

```tsx
// 切换深色模式
document.documentElement.classList.toggle('dark');
```

---

## 注意事项

1. **不要直接修改这些组件**：如需定制，使用 `className` 扩展或创建新组件
2. **保持语义化**：使用 `bg-primary` 而非 `bg-blue-600`
3. **响应式优先**：使用 Tailwind 的响应式前缀（`sm:`, `md:`, `lg:`）
4. **可访问性**：确保所有交互元素可通过键盘访问

---

## 获取帮助

- 查看 `/style-guide` 页面获取实时示例
- 阅读 `DEVELOPMENT_GUIDE.md` 了解完整开发规范
- 参考现有组件的使用方式（如 `AdminCharacters.tsx`）

---

**最后更新**：2024-02-18

### 更新日志

- **2024-02-18**: 新增 Toast 组件文档
- **2024-02-17**: 初始版本
