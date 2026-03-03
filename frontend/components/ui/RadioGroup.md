# RadioGroup 组件

通用的单选按钮组组件，支持两种样式变体。

## 功能特性

- 两种样式变体：`default`（卡片式）和 `segmented`（分段式）
- 支持水平和垂直布局
- 带滑动动画的分段式选择器
- 完全可定制的样式
- TypeScript 类型支持
- **自动优化**：在表单中，选项少于 5 个的 select 字段会自动使用 RadioGroup

## 使用示例

### 1. 默认样式（卡片式单选框）

```tsx
import { RadioGroup } from '../ui';

<RadioGroup
  label="参考语言"
  required
  value={language}
  onChange={setLanguage}
  options={[
    { label: 'ZH', value: 'zh' },
    { label: 'EN', value: 'en' },
    { label: 'JP', value: 'jp' }
  ]}
  orientation="horizontal"
/>
```

### 2. 分段式样式（带滑动动画）

```tsx
import { RadioGroup } from '../ui';

<RadioGroup
  value={displayMode}
  onChange={setDisplayMode}
  options={[
    { label: '正常', value: 'normal' },
    { label: 'VRM', value: 'vrm' },
    { label: 'Live2D', value: 'live2d' }
  ]}
  variant="segmented"
  className="w-[220px]"
/>
```

### 3. 动态表单中的自动使用

在 VoiceModal 和 ProviderModal 中，所有选项少于 5 个的 select 字段会自动渲染为 RadioGroup：

```tsx
// 自动判断逻辑
const shouldUseRadioGroup = type === 'select' && options && options.length < 5;

{shouldUseRadioGroup ? (
  <RadioGroup
    label={label}
    required={required}
    value={currentValue}
    onChange={(val) => handleInputChange(key, val)}
    options={options.map(opt => ({ label: opt, value: opt }))}
    orientation="horizontal"
  />
) : (
  <Select ... />
)}
```

## Props

| 属性          | 类型                         | 默认值         | 说明                     |
| ------------- | ---------------------------- | -------------- | ------------------------ |
| `value`       | `string`                     | -              | 当前选中的值（必填）     |
| `onChange`    | `(value: string) => void`    | -              | 值变化回调（必填）       |
| `options`     | `RadioOption[]`              | -              | 选项数组（必填）         |
| `label`       | `string`                     | -              | 标签文本                 |
| `required`    | `boolean`                    | `false`        | 是否必填（显示红色星号） |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | 布局方向                 |
| `variant`     | `'default' \| 'segmented'`   | `'default'`    | 样式变体                 |
| `className`   | `string`                     | -              | 自定义类名               |

## 设计原则

### 何时使用 RadioGroup vs Select

| 选项数量 | 推荐组件   | 原因                           |
| -------- | ---------- | ------------------------------ |
| 2-4 个   | RadioGroup | 所有选项一目了然，无需点击展开 |
| 5+ 个    | Select     | 节省空间，避免界面过于拥挤     |

### 自动切换规则

项目中的动态表单已实现自动切换：
- ✅ 选项 < 5：自动使用 RadioGroup（default 变体）
- ✅ 选项 ≥ 5：使用 Select 下拉框
- ✅ 语言字段：自动大写显示（ZH、EN、JP）

## 实际应用

1. **语言选择**（自动应用）
   - 选项：zh, en, jp（3个）
   - 自动使用 RadioGroup
   - 水平排列，大写显示

2. **显示模式切换**（ChatHeader）
   - 使用 `segmented` 变体
   - 带滑动动画

3. **布尔选择**（自动应用）
   - 选项：true, false（2个）
   - 自动使用 RadioGroup
