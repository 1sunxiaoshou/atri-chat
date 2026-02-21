# VRM 3D模型管理系统

基于 Three.js 和 @pixiv/three-vrm 构建的完整VRM模型管理系统，包含上传、预览、编辑和自动缩略图生成功能。

## 系统架构

```
vrm/
├── AdminAvatars.tsx           # 主管理界面
├── VRMUploadPreview.tsx       # 上传+预览组件
├── VRMEditPreview.tsx         # 编辑+预览组件
├── VRMPreview.tsx             # 核心3D渲染组件
├── VRMThumbnailGenerator.tsx  # 缩略图生成器
└── index.ts                   # 导出文件
```

## 核心组件

### AdminAvatars
主管理界面，负责模型列表展示和操作协调。

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
核心3D渲染组件，可复用的预览引擎。

**新功能：**
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

## 交互说明

| 操作         | 功能          |
| ------------ | ------------- |
| 鼠标拖拽     | 旋转模型      |
| 滚轮滚动     | 缩放模型      |
| 点击旋转按钮 | 切换自动旋转  |
| 点击重置按钮 | 恢复初始视角  |
| 点击模型卡片 | 进入预览/编辑 |

## 设计原则

### 1. 职责分离
- **AdminAvatars**: 列表管理和协调
- **VRMUploadPreview**: 上传流程
- **VRMEditPreview**: 编辑流程
- **VRMPreview**: 纯3D渲染
- **VRMThumbnailGenerator**: 缩略图生成

### 2. 组件复用
- VRMPreview被VRMUploadPreview和VRMEditPreview复用
- VRMThumbnailGenerator独立，可在其他场景使用

### 3. 状态管理
- 最小化状态
- 清晰的数据流
- 避免prop drilling

### 4. 用户体验
- 即时反馈
- 流畅动画
- 智能默认值
- 防误操作

## 技术栈

- **Three.js** - 3D渲染引擎
- **@pixiv/three-vrm** - VRM格式支持
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

### 单独使用VRMPreview
```tsx
import { VRMPreview } from './components/admin/vrm';

<VRMPreview
    modelUrl="/uploads/vrm_models/model.vrm"
    className="w-full h-[600px]"
    autoRotate={true}
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

## 未来改进

- [ ] 支持批量上传
- [ ] 支持拖拽上传
- [ ] 添加模型标签系统
- [ ] 支持模型搜索和过滤
- [ ] 添加模型统计信息
- [ ] 支持VRM动画预览
- [ ] 添加多角度缩略图
- [ ] 支持自定义背景和光照

## 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解详细更新历史。
