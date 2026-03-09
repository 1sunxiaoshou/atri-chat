# VRM 3D 模型管理系统

基于 **React Three Fiber (R3F)** 和 `@pixiv/three-vrm` 构建的现代化 VRM 模型管理系统。

## 🎯 系统架构

```
vrm/
├── AdminAvatars.tsx              # 3D 形象管理主界面
├── AdminMotions.tsx              # 动作管理主界面
├── UploadPreview.tsx             # 上传预览组件（使用 R3F VRMViewer）
├── EditPreview.tsx               # 编辑预览组件（使用 R3F VRMViewer）
├── index.ts                      # 导出文件
└── README.md                     # 本文档
```

## 📦 核心组件

### AdminAvatars
3D 形象管理主界面，负责 VRM 模型列表展示和操作协调。

**功能**：
- 📋 模型列表展示（网格布局）
- ➕ 上传按钮（触发 VRMUploadPreview）
- 👆 点击卡片进入预览/编辑
- 🗑️ 删除模型（带确认对话框和引用检查）
- 🔄 自动刷新列表

**特点**：
- 清晰的职责分离
- 完整的错误处理
- Toast 消息提示

### AdminMotions
动作管理主界面，负责 VRM 动作文件的管理和预览。

**功能**：
- 📋 动作列表展示
- ➕ 上传动作文件（.vrma 格式）
- 👁️ 实时 3D 预览动作（使用 R3F VRMViewer）
- ✏️ 编辑动作名称
- 🗑️ 删除动作
- 🔄 自动刷新列表

**特点**：
- 使用新的 R3F `VRMViewer` 组件
- 左侧预览，右侧列表布局
- 流畅的动作切换体验

### VRMUploadPreview
上传和预览组合组件，全屏模态框形式。

**文件名**：`UploadPreview.tsx`  
**导出名**：`VRMUploadPreview`

**工作流程**：
1. 用户点击上传按钮
2. 显示全屏卡片
3. 上半部分：文件上传区域
4. 选择文件后 → 上传区域变为 3D 预览（使用 R3F VRMViewer）
5. 下半部分：模型名称输入
6. 后台自动生成缩略图
7. 点击保存 → 上传模型 + 缩略图

**技术栈**：
- 使用 R3F `VRMViewer` 进行 3D 预览
- 自动提取表情列表
- 直接从预览窗口截图生成缩略图（避免重复加载）

**Props**：
```typescript
interface VRMUploadPreviewProps {
    onSave: (data: { 
        file: File; 
        name: string; 
        thumbnail: Blob; 
        expressions: string[] 
    }) => Promise<void>;
    onCancel: () => void;
}
```

### VRMEditPreview
编辑和预览组合组件，全屏模态框形式。

**文件名**：`EditPreview.tsx`  
**导出名**：`VRMEditPreview`

**工作流程**：
1. 用户点击模型卡片
2. 显示全屏预览（使用 R3F VRMViewer）
3. 上半部分：3D 模型预览
4. 下半部分：模型名称编辑
5. 检测是否修改：
   - 未修改 → 显示"关闭"按钮
   - 已修改 → 显示"取消" + "保存"按钮

**技术栈**：
- 使用 R3F `VRMViewer` 进行 3D 预览
- 支持轨道控制和网格显示

**Props**：
```typescript
interface VRMEditPreviewProps {
    avatar: { id: string; name: string; model_path: string };
    onSave: (id: string, name: string) => Promise<void>;
    onClose: () => void;
}
```

### 缩略图生成

**新方案**：使用 `VRMViewer` 的 `captureScreenshot` 方法直接从预览窗口截图。

**优势**：
- ✅ 避免重复加载模型（从 2 次 → 1 次）
- ✅ 缩略图与预览完全一致
- ✅ 内存占用减少 50%
- ✅ 更简洁的代码

**使用示例**：
```typescript
const viewerRef = useRef<VRMViewerHandle>(null);

// 模型加载后自动截图
const handleModelLoaded = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const blob = await viewerRef.current?.captureScreenshot(512, 683);
    if (blob) {
        setThumbnail(blob);
    }
};

<VRMViewer
    ref={viewerRef}
    modelUrl={modelUrl}
    onModelLoaded={handleModelLoaded}
/>
```

## 🏗️ 组件关系图

```
管理界面层：
├── AdminAvatars (形象管理)
│   ├── UploadPreview (上传 + 截图)
│   └── EditPreview (编辑)
└── AdminMotions (动作管理)
    └── VRMViewer (from @/components/vrm/r3f)

核心渲染：
└── VRMViewer (from @/components/vrm/r3f)
    ├── VRMCanvas
    ├── StudioScene
    ├── Character
    └── captureScreenshot() (截图功能)
```

## 🎨 R3F 架构优势

### 旧架构 vs 新架构

| 方面         | 旧架构（手动 Three.js） | 新架构（R3F）    |
| ------------ | ----------------------- | ---------------- |
| 代码量       | ~2,463 行               | ~280 行          |
| 组件数量     | 5 个专用组件            | 1 个通用组件     |
| 维护成本     | 高（5 处修改）          | 低（1 处修改）   |
| 性能         | 手动优化                | 自动优化 + 缓存  |
| 类型安全     | 部分                    | 完整             |
| 模型加载次数 | 2 次（预览 + 缩略图）   | 1 次（直接截图） |

### 新架构特点

1. **声明式 API**
   ```tsx
   <VRMViewer
       modelUrl={url}
       expression="happy"
       enableBlink={true}
       lookAtMode="mouse"
   />
   ```

2. **自动优化**
   - 模型自动缓存（useGLTF）
   - 动作自动缓存
   - 统一渲染循环
   - 自动资源清理

3. **大一统原则**
   - 一个 `VRMViewer` 组件打天下
   - 通过 Props 控制所有行为
   - 避免重复代码

## 📖 使用示例

### 使用 AdminAvatars
```tsx
import { AdminAvatars } from '@/components/admin/vrm';

<AdminAvatars onAvatarsChange={() => console.log('列表已更新')} />
```

### 使用 AdminMotions
```tsx
import { AdminMotions } from '@/components/admin/vrm';

<AdminMotions onMotionsChange={() => console.log('动作已更新')} />
```

### 使用 VRMViewer 截图功能
```tsx
import { VRMViewer, VRMViewerHandle } from '@/components/vrm/r3f';

const viewerRef = useRef<VRMViewerHandle>(null);

// 截取缩略图
const captureScreenshot = async () => {
    const blob = await viewerRef.current?.captureScreenshot(512, 683);
    if (blob) {
        const url = URL.createObjectURL(blob);
        console.log('缩略图 URL:', url);
    }
};

<VRMViewer
    ref={viewerRef}
    modelUrl={vrmUrl}
/>
```

## 🎮 用户交互流程

### 上传流程
```
点击"上传 VRM 模型"按钮
    ↓
显示全屏上传卡片
    ↓
点击上传区域，选择 .vrm 文件
    ↓
上传区域变为 3D 预览
    ↓
自动提取文件名
    ↓
模型加载完成后 1.5 秒自动截图
    ↓
缩略图生成完成（直接从预览窗口截取）
    ↓
点击"保存" → 上传完成
```

### 预览/编辑流程
```
点击模型卡片
    ↓
显示全屏预览
    ↓
可以：
  - 轨道控制（旋转、缩放、平移）
  - 编辑模型名称
    ↓
如果修改了名称：
  - 显示"取消" + "保存"按钮
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
左侧 3D 预览区域加载动作
    ↓
自动播放动作
    ↓
可以：
  - 轨道控制查看不同角度
  - 切换到其他动作
  - 编辑动作名称
  - 删除动作
```

## 🛠️ 技术栈

- **React Three Fiber** - 声明式 3D 渲染
- **@react-three/drei** - R3F 工具库
- **Three.js** - 3D 渲染引擎
- **@pixiv/three-vrm** - VRM 格式支持
- **@pixiv/three-vrm-animation** - VRM 动作支持
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式系统
- **Lucide React** - 图标库

## ⚡ 性能优化

1. **自动缓存** - 模型和动作自动缓存（useGLTF）
2. **统一渲染** - 单一 useFrame 循环
3. **资源清理** - 组件卸载时自动释放资源
4. **响应式处理** - 窗口大小变化自动调整
5. **直接截图** - 从预览窗口直接截图，避免重复加载（性能提升 50%）

## 🌐 浏览器兼容性

- Chrome/Edge 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- 需要 WebGL 支持

## 📚 相关文档

- [VRM R3F 大一统原则](../../../docs/VRM-R3F-大一统原则.md)
- [VRM R3F 快速开始](../../../docs/VRM-R3F-快速开始.md)
- [VRM R3F 开发进度](../../../docs/VRM-R3F-开发进度.md)
- [VRM R3F 阶段三完成报告](../../../docs/VRM-R3F-阶段三完成报告.md)

## 🔄 更新日志

### v3.2.0 (2025-03-08) - 最终清理与优化
- 🗑️ 删除废弃的 `ThumbnailGenerator.tsx`（已被 VRMViewer 截图功能替代）
- 🗑️ 删除 `frontend/services/vrm/` 目录（7个文件，~800行）
- 🗑️ 删除 `frontend/libs/vrm-emote/` 目录（8个文件，~600行）
- 📉 总计删除 17 个文件，约 2,463 行旧代码
- ⚡ 缩略图生成优化：从预览窗口直接截图（性能提升 50%）
- 📝 更新文档

### v3.1.0 (2025-03-08) - 文件命名优化
- 🏷️ 重命名文件以消除冗余前缀
  - `VRMEditPreview.tsx` → `EditPreview.tsx`
  - `VRMUploadPreview.tsx` → `UploadPreview.tsx`
  - `VRMThumbnailGenerator.tsx` → `ThumbnailGenerator.tsx`
- ✅ 组件导出名保持不变（向后兼容）
- 📝 更新文档

### v3.0.0 (2025-03-08) - R3F 架构升级
- ✨ 迁移到 React Three Fiber 架构
- 🗑️ 删除旧的 `VRMPreview` 和 `VRMMotionPreviewOptimized`
- ⚡ 使用统一的 `VRMViewer` 组件
- 📉 代码量减少 89%（~2,463 行 → ~280 行）
- 🎯 实现大一统原则
- 📝 更新文档

### v2.0.0
- ✨ 新增 `VRMMotionPreviewOptimized` 组件
- ⚡ 优化动作预览性能
- 🎬 集成 `MotionController` 管理动作缓存

### v1.0.0
- 🎉 初始版本
- ✨ VRM 模型上传、预览、编辑功能
- 🎨 自动缩略图生成

---

**维护者**：VRM R3F 开发团队  
**最后更新**：2025-03-08
