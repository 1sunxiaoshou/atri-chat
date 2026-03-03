# VRM 3D模型管理系统

基于 Three.js 和 @pixiv/three-vrm 构建的完整VRM模型管理系统，包含上传、预览、编辑、动作播放和自动缩略图生成功能。

## 系统架构

```
vrm/
├── AdminAvatars.tsx                # 主管理界面（形象管理）
├── AdminMotions.tsx                # 动作管理界面
├── VRMUploadPreview.tsx            # 上传+预览组件
├── VRMEditPreview.tsx              # 编辑+预览组件
├── VRMPreview.tsx                  # 核心3D渲染组件
├── VRMMotionPreviewOptimized.tsx   # 动作预览组件（优化版）
├── VRMThumbnailGenerator.tsx       # 缩略图生成器
└── index.ts                        # 导出文件
```

## 核心组件

### AdminAvatars
主管理界面，负责VRM模型列表展示和操作协调。

**功能：**
- 📋 模型列表展示（网格布局）
- ➕ 上传按钮（触发VRMUploadPreview）
- 👆 点击卡片进入预览/编辑
- 🗑️ 删除模型（带确认对话框）
- 🔄 自动刷新列表

**特点：**
- 移除了"新建模型卡片"（已有按钮）
- 简化状态管理
- 清晰的职责分离

### AdminMotions
动作管理界面，负责VRM动作文件的管理和预览。

**功能：**
- 📋 动作列表展示
- ➕ 上传动作文件（.vrma格式）
- 👁️ 实时3D预览动作
- ✏️ 编辑动作名称
- 🗑️ 删除动作
- 🔄 自动刷新列表

**特点：**
- 使用 `VRMMotionPreviewOptimized` 组件
- 切换动作时不重新加载模型
- 流畅的动作切换体验

### VRMUploadPreview
上传和预览组合组件，全屏模态框形式。

**工作流程：**
1. 用户点击上传按钮
2. 显示全屏卡片
3. 上半部分：文件上传区域（自适应高度）
4. 选择文件后 → 上传区域变为3D预览
5. 下半部分：模型名称输入（固定显示，无需滚动）
6. 后台自动生成缩略图
7. 点击保存 → 上传模型+缩略图

**UI优化：**
- 使用flex布局，3D预览区域自适应
- 模型名称输入框固定在底部，始终可见
- 状态提示（生成缩略图）固定显示

**Props：**
```typescript
interface VRMUploadPreviewProps {
    onSave: (data: { file: File; name: string; thumbnail: Blob }) => Promise<void>;
    onCancel: () => void;
}
```

### VRMEditPreview
编辑和预览组合组件，全屏模态框形式。

**工作流程：**
1. 用户点击模型卡片
2. 显示全屏预览
3. 上半部分：3D模型预览（自动旋转，自适应高度）
4. 下半部分：模型名称编辑（固定显示，无需滚动）
5. 检测是否修改：
   - 未修改 → 显示"关闭"按钮
   - 已修改 → 显示"取消"+"保存"按钮
6. 关闭时：如果有未保存修改，恢复原名称

**UI优化：**
- 使用flex布局，3D预览区域自适应
- 模型名称输入框固定在底部，始终可见
- 无需滚动即可看到所有内容

**Props：**
```typescript
interface VRMEditPreviewProps {
    avatar: Avatar;
    onSave: (id: string, name: string) => Promise<void>;
    onClose: () => void;
}
```

### VRMPreview
核心3D渲染组件，可复用的VRM模型预览引擎。

**功能：**
- 🔄 自动旋转（可通过props控制，默认关闭）
- 🎮 旋转按钮（点击切换自动旋转）
- 🔍 缩放控制
- 🔄 重置视角
- 📐 智能相机定位

**Props：**
```typescript
interface VRMPreviewProps {
    modelUrl: string;
    className?: string;
    onClose?: () => void;
    fullscreen?: boolean;
    autoRotate?: boolean;  // 是否自动旋转
}
```

**控制按钮：**
- 缩小 / 放大
- 自动旋转（播放▶️/暂停⏸️图标切换）
- 重置视角

**交互说明：**
- 播放图标（▶️）= 旋转已停止，点击开始旋转
- 暂停图标（⏸️）= 正在旋转，点击暂停旋转
- 旋转中按钮显示蓝色高亮

**用途：**
- 被 `VRMUploadPreview` 和 `VRMEditPreview` 复用
- 纯模型预览，不包含动作播放

### VRMMotionPreviewOptimized
优化的动作预览组件，支持VRM模型+动作播放。

**核心优势：**
- ⚡ 模型只加载一次，切换动作时不重新加载
- 🎬 使用 `MotionController` 管理动作播放
- 💾 支持动作缓存（最多20个动作）
- 🔄 平滑的动作过渡效果
- 🎮 完整的播放控制

**功能：**
- 🎭 加载并播放VRM动作（.vrma格式）
- ⏯️ 播放/暂停控制
- 🔄 自动循环播放
- 🔍 缩放和旋转控制
- 📐 智能相机定位

**Props：**
```typescript
interface VRMMotionPreviewOptimizedProps {
    motionUrl: string;
    motionName?: string;
    className?: string;
    autoPlay?: boolean;  // 是否自动播放
}
```

**技术实现：**
- 使用 `libs/vrm-emote/motionController.ts` 管理动作
- 模型在组件挂载时加载一次
- 动作切换时只加载新动作文件
- 自动过滤 `specVersion` 警告

**性能优化：**
- LRU缓存策略（最近最少使用）
- 动作预加载支持
- 平滑的动作过渡（0.5秒）
- 智能资源清理

**用途：**
- `AdminMotions` - 动作管理界面
- `MotionBindingsManager` - 角色动作绑定编辑

### VRMThumbnailGenerator
后台缩略图生成器，隐藏组件。

**功能：**
- 🎨 生成512x512高质量缩略图
- 🚀 后台渲染，不影响UI
- 📐 智能定位（与VRMPreview一致）
- 💾 输出JPEG格式（90%质量）

**Props：**
```typescript
interface VRMThumbnailGeneratorProps {
    file: File;
    onThumbnailGenerated: (blob: Blob) => void;
    onError?: (error: string) => void;
}
```

## 组件关系图

```
基础组件层：
├── VRMPreview (纯模型预览)
└── VRMMotionPreviewOptimized (模型+动作预览)

业务组件层：
├── VRMUploadPreview (使用 VRMPreview)
├── VRMEditPreview (使用 VRMPreview)
└── AdminMotions (使用 VRMMotionPreviewOptimized)

管理界面层：
├── AdminAvatars (形象管理)
└── AdminMotions (动作管理)

工具组件：
└── VRMThumbnailGenerator (缩略图生成)
```

## 用户体验流程

### 上传流程
```
点击"上传VRM模型"按钮
    ↓
显示全屏上传卡片
    ↓
点击上传区域，选择.vrm文件
    ↓
上传区域变为3D预览（自动旋转）
    ↓
自动提取文件名 + 后台生成缩略图
    ↓
显示"正在生成缩略图..."
    ↓
缩略图生成完成
    ↓
点击"保存" → 上传完成
```

### 预览/编辑流程
```
点击模型卡片
    ↓
显示全屏预览（自动旋转）
    ↓
可以：
  - 拖拽旋转模型
  - 缩放查看细节
  - 切换自动旋转
  - 编辑模型名称
    ↓
如果修改了名称：
  - 显示"取消"+"保存"按钮
  - 点击"取消" → 恢复原名称
  - 点击"保存" → 更新名称
    ↓
如果未修改：
  - 显示"关闭"按钮
  - 点击"关闭" → 直接退出
```

### 动作预览流程
```
在动作管理界面选择动作
    ↓
3D预览区域加载动作（模型不重新加载）
    ↓
自动播放动作
    ↓
可以：
  - 暂停/播放动作
  - 拖拽旋转模型
  - 缩放查看细节
  - 切换到其他动作（无缝切换）
```

## 交互说明

| 操作         | 功能          |
| ------------ | ------------- |
| 鼠标拖拽     | 旋转模型      |
| 滚轮滚动     | 缩放模型      |
| 点击旋转按钮 | 切换自动旋转  |
| 点击播放按钮 | 播放/暂停动作 |
| 点击重置按钮 | 恢复初始视角  |
| 点击模型卡片 | 进入预览/编辑 |
| 点击动作项   | 预览动作      |

## 设计原则

### 1. 职责分离
- **AdminAvatars**: 形象列表管理和协调
- **AdminMotions**: 动作列表管理和协调
- **VRMUploadPreview**: 上传流程
- **VRMEditPreview**: 编辑流程
- **VRMPreview**: 纯3D模型渲染
- **VRMMotionPreviewOptimized**: 模型+动作渲染
- **VRMThumbnailGenerator**: 缩略图生成

### 2. 组件复用
- VRMPreview被VRMUploadPreview和VRMEditPreview复用
- VRMMotionPreviewOptimized专门用于动作预览场景
- VRMThumbnailGenerator独立，可在其他场景使用

### 3. 性能优化
- 动作预览时模型不重新加载
- 使用MotionController管理动作缓存
- 平滑的动作过渡效果
- 智能资源清理

### 4. 状态管理
- 最小化状态
- 清晰的数据流
- 避免prop drilling

### 5. 用户体验
- 即时反馈
- 流畅动画
- 智能默认值
- 防误操作

## 技术栈

- **Three.js** - 3D渲染引擎
- **@pixiv/three-vrm** - VRM格式支持
- **@pixiv/three-vrm-animation** - VRM动作支持
- **React 19** - UI框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式系统
- **Lucide React** - 图标库

## 性能优化

1. **按需渲染** - requestAnimationFrame
2. **资源清理** - 组件卸载时释放Three.js资源
3. **响应式处理** - 窗口大小变化自动调整
4. **后台生成** - 缩略图生成不阻塞UI
5. **智能缓存** - URL.createObjectURL复用
6. **动作缓存** - LRU策略，最多缓存20个动作
7. **模型复用** - 切换动作时不重新加载模型
8. **平滑过渡** - 动作切换使用缓动函数

## 浏览器兼容性

- Chrome/Edge 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- 需要 WebGL 支持

## 代码示例

### 使用AdminAvatars
```tsx
import { AdminAvatars } from './components/admin/vrm';

<AdminAvatars onAvatarsChange={() => console.log('列表已更新')} />
```

### 使用AdminMotions
```tsx
import { AdminMotions } from './components/admin/vrm';

<AdminMotions />
```

### 单独使用VRMPreview（纯模型预览）
```tsx
import { VRMPreview } from './components/admin/vrm';

<VRMPreview
    modelUrl="/uploads/vrm_models/model.vrm"
    className="w-full h-[600px]"
    autoRotate={true}
/>
```

### 单独使用VRMMotionPreviewOptimized（动作预览）
```tsx
import { VRMMotionPreviewOptimized } from './components/admin/vrm';

<VRMMotionPreviewOptimized
    motionUrl="/uploads/vrm_animations/dance.vrma"
    motionName="跳舞动作"
    className="w-full h-[600px]"
    autoPlay={true}
/>
```

### 单独使用缩略图生成器
```tsx
import { VRMThumbnailGenerator } from './components/admin/vrm';

<VRMThumbnailGenerator
    file={vrmFile}
    onThumbnailGenerated={(blob) => {
        // 使用生成的缩略图
        const url = URL.createObjectURL(blob);
        console.log('缩略图URL:', url);
    }}
    onError={(error) => console.error(error)}
/>
```

## 关键技术细节

### MotionController集成
`VRMMotionPreviewOptimized` 使用 `libs/vrm-emote/motionController.ts` 来管理动作：

```typescript
// 初始化 MotionController
motionControllerRef.current = new MotionController(vrm, {
    maxSize: 20,              // 最多缓存20个动作
    enableAutoEvict: true     // 启用自动清理
});

// 播放动作（自动缓存）
await motionControllerRef.current.playAnimationUrl(motionUrl, true);

// 更新动画（在渲染循环中）
motionControllerRef.current.update(delta);
```

### 警告过滤
自动过滤 `@pixiv/three-vrm-animation` 的 `specVersion` 警告：

```typescript
// 在 motionController.ts 中
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string' && 
        message.includes('specVersion of the VRMA is not defined')) {
        return; // 忽略此警告
    }
    originalWarn.apply(console, args);
};
```

## 未来改进

- [ ] 支持批量上传
- [ ] 支持拖拽上传
- [ ] 添加模型标签系统
- [ ] 支持模型搜索和过滤
- [ ] 添加模型统计信息
- [ ] 添加多角度缩略图
- [ ] 支持自定义背景和光照
- [x] ~~支持VRM动画预览~~ ✅ 已完成
- [x] ~~优化动作切换性能~~ ✅ 已完成

## 更新日志

### v2.0.0 (最新)
- ✨ 新增 `VRMMotionPreviewOptimized` 组件
- ⚡ 优化动作预览性能（模型不重新加载）
- 🎬 集成 `MotionController` 管理动作缓存
- 🔇 自动过滤 `specVersion` 警告
- 🐛 修复 Three.js 导入路径（使用 `three/addons`）
- 📝 更新文档

### v1.0.0
- 🎉 初始版本
- ✨ VRM模型上传、预览、编辑功能
- 🎨 自动缩略图生成
- 🔄 自动旋转功能
