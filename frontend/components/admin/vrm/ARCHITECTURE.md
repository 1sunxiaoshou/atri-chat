# VRM系统架构文档

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    AdminAvatars                         │
│                   (主管理界面)                           │
│  - 模型列表展示                                          │
│  - 操作协调                                              │
│  - 状态管理                                              │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             ↓                            ↓
┌────────────────────────┐   ┌────────────────────────┐
│  VRMUploadPreview      │   │  VRMEditPreview        │
│  (上传+预览)            │   │  (编辑+预览)            │
│  - 文件选择             │   │  - 名称编辑             │
│  - 3D预览               │   │  - 3D预览               │
│  - 自动生成缩略图       │   │  - 变更检测             │
└────────┬───────────────┘   └────────┬───────────────┘
         │                            │
         ↓                            ↓
    ┌────────────────────────────────────┐
    │         VRMPreview                 │
    │       (核心3D渲染)                  │
    │  - Three.js场景管理                │
    │  - 相机控制                         │
    │  - 交互处理                         │
    │  - 自动旋转                         │
    └────────────────────────────────────┘
         │
         ↓
    ┌────────────────────────────────────┐
    │   VRMThumbnailGenerator            │
    │     (缩略图生成)                    │
    │  - 后台渲染                         │
    │  - Blob输出                         │
    └────────────────────────────────────┘
```

## 组件职责

### 1. AdminAvatars (容器组件)
**职责：**
- 管理模型列表数据
- 协调子组件交互
- 处理API调用
- 管理全局状态

**不负责：**
- 3D渲染逻辑
- 文件上传UI
- 缩略图生成

**状态：**
```typescript
{
    avatars: Avatar[],           // 模型列表
    isLoading: boolean,          // 加载状态
    showUploadPreview: boolean,  // 显示上传界面
    editingAvatar: Avatar | null,// 正在编辑的模型
    confirmDialog: {...}         // 确认对话框状态
}
```

### 2. VRMUploadPreview (功能组件)
**职责：**
- 文件选择UI
- 上传后显示3D预览
- 触发缩略图生成
- 收集上传数据

**不负责：**
- API调用（通过回调传递）
- 列表管理

**Props：**
```typescript
{
    onSave: (data) => Promise<void>,  // 保存回调
    onCancel: () => void               // 取消回调
}
```

**内部状态：**
```typescript
{
    file: File | null,
    name: string,
    previewUrl: string | null,
    thumbnail: Blob | null,
    isGeneratingThumbnail: boolean,
    isSaving: boolean
}
```

### 3. VRMEditPreview (功能组件)
**职责：**
- 显示3D预览
- 名称编辑
- 变更检测
- 数据验证

**不负责：**
- API调用（通过回调传递）
- 列表管理

**Props：**
```typescript
{
    avatar: Avatar,                    // 模型数据
    onSave: (id, name) => Promise<void>, // 保存回调
    onClose: () => void                 // 关闭回调
}
```

**内部状态：**
```typescript
{
    name: string,
    isSaving: boolean,
    hasChanges: boolean  // 计算属性
}
```

### 4. VRMPreview (纯展示组件)
**职责：**
- Three.js场景管理
- VRM模型加载
- 相机控制
- 用户交互（拖拽、缩放）
- 自动旋转

**不负责：**
- 业务逻辑
- 数据持久化

**Props：**
```typescript
{
    modelUrl: string,
    className?: string,
    onClose?: () => void,
    fullscreen?: boolean,
    autoRotate?: boolean
}
```

**内部状态：**
```typescript
{
    isLoading: boolean,
    error: string | null,
    zoom: number,
    isAutoRotating: boolean
}
```

**Refs：**
```typescript
{
    sceneRef: THREE.Scene,
    cameraRef: THREE.PerspectiveCamera,
    rendererRef: THREE.WebGLRenderer,
    vrmRef: VRM,
    animationFrameRef: number,
    initialCameraDistanceRef: number,
    isDraggingRef: boolean,
    previousMouseRef: {x, y},
    rotationRef: {x, y},
    zoomRef: number
}
```

### 5. VRMThumbnailGenerator (工具组件)
**职责：**
- 后台渲染VRM模型
- 生成缩略图Blob
- 错误处理

**不负责：**
- UI显示
- 文件上传

**Props：**
```typescript
{
    file: File,
    onThumbnailGenerated: (blob: Blob) => void,
    onError?: (error: string) => void
}
```

## 数据流

### 上传流程
```
用户操作
    ↓
AdminAvatars.setShowUploadPreview(true)
    ↓
VRMUploadPreview 显示
    ↓
用户选择文件
    ↓
VRMUploadPreview.handleFileChange()
    ├─→ 创建previewUrl
    ├─→ VRMPreview 显示3D预览
    └─→ VRMThumbnailGenerator 开始生成
    ↓
缩略图生成完成
    ↓
VRMUploadPreview.handleThumbnailGenerated()
    ↓
用户点击保存
    ↓
VRMUploadPreview.handleSave()
    ↓
调用 onSave({ file, name, thumbnail })
    ↓
AdminAvatars.handleUploadSave()
    ├─→ 构建FormData
    ├─→ api.uploadVRMModel()
    ├─→ fetchAvatars()
    └─→ setShowUploadPreview(false)
```

### 编辑流程
```
用户点击模型卡片
    ↓
AdminAvatars.setEditingAvatar(avatar)
    ↓
VRMEditPreview 显示
    ├─→ VRMPreview 显示3D预览
    └─→ Input 显示名称
    ↓
用户修改名称
    ↓
VRMEditPreview 检测变更
    ├─→ hasChanges = true
    └─→ 显示"保存"按钮
    ↓
用户点击保存
    ↓
VRMEditPreview.handleSave()
    ↓
调用 onSave(id, name)
    ↓
AdminAvatars.handleEditSave()
    ├─→ api.updateVRMModel()
    ├─→ fetchAvatars()
    └─→ setEditingAvatar(null)
```

## 状态管理策略

### 1. 本地状态优先
- 每个组件管理自己的UI状态
- 避免不必要的状态提升

### 2. 回调传递数据
- 子组件通过回调向父组件传递数据
- 父组件负责API调用和列表更新

### 3. 最小化状态
- 只存储必要的状态
- 计算属性用于派生状态

### 4. 单向数据流
```
AdminAvatars (数据源)
    ↓ props
子组件 (展示)
    ↓ callbacks
AdminAvatars (更新数据)
```

## 性能优化

### 1. 组件层面
- **懒加载**: 模态框组件按需渲染
- **条件渲染**: 避免不必要的DOM
- **memo**: 对纯展示组件使用React.memo

### 2. Three.js层面
- **requestAnimationFrame**: 优化渲染循环
- **资源清理**: 组件卸载时释放资源
- **事件节流**: 鼠标移动事件使用RAF

### 3. 网络层面
- **FormData**: 高效的文件上传
- **Blob**: 直接传输二进制数据
- **URL.createObjectURL**: 本地预览不占用内存

## 错误处理

### 1. 加载错误
```typescript
try {
    const gltf = await loader.loadAsync(modelUrl);
} catch (err) {
    setError('加载3D模型失败');
}
```

### 2. 生成错误
```typescript
VRMThumbnailGenerator
    ↓ onError
VRMUploadPreview.handleThumbnailError()
    ↓ 记录日志
继续允许上传（无缩略图）
```

### 3. API错误
```typescript
try {
    await api.uploadVRMModel(formData);
} catch (error) {
    console.error('上传失败:', error);
    alert('上传失败');
}
```

## 可扩展性

### 1. 新增功能
- **批量上传**: 在VRMUploadPreview中支持多文件
- **标签系统**: 在Avatar接口中添加tags字段
- **搜索过滤**: 在AdminAvatars中添加搜索状态

### 2. 新增组件
- **VRMBatchUpload**: 批量上传组件
- **VRMTagEditor**: 标签编辑组件
- **VRMStats**: 统计信息组件

### 3. 集成其他系统
```typescript
// 导出可复用组件
export { VRMPreview } from './VRMPreview';
export { VRMThumbnailGenerator } from './VRMThumbnailGenerator';

// 在其他模块中使用
import { VRMPreview } from '@/components/admin/vrm';
```

## 测试策略

### 1. 单元测试
- VRMThumbnailGenerator: 测试生成逻辑
- 工具函数: 测试数据转换

### 2. 集成测试
- VRMUploadPreview: 测试上传流程
- VRMEditPreview: 测试编辑流程

### 3. E2E测试
- 完整上传流程
- 完整编辑流程
- 删除流程

## 维护指南

### 1. 添加新功能
1. 确定功能属于哪个组件
2. 如果是新功能，创建新组件
3. 通过props和callbacks集成
4. 更新文档

### 2. 修复Bug
1. 定位问题组件
2. 检查状态管理
3. 检查数据流
4. 添加错误处理

### 3. 性能优化
1. 使用React DevTools Profiler
2. 检查不必要的重渲染
3. 优化Three.js渲染
4. 检查内存泄漏

## 依赖关系

```
AdminAvatars
├── VRMUploadPreview
│   ├── VRMPreview
│   ├── VRMThumbnailGenerator
│   └── UI组件 (Button, Input)
├── VRMEditPreview
│   ├── VRMPreview
│   └── UI组件 (Button, Input)
└── UI组件 (Button, ConfirmDialog)

VRMPreview
├── Three.js
├── @pixiv/three-vrm
└── UI组件 (Button)

VRMThumbnailGenerator
├── Three.js
└── @pixiv/three-vrm
```

## 总结

这个架构的核心优势：

1. **清晰的职责分离** - 每个组件有明确的职责
2. **高度可复用** - VRMPreview和VRMThumbnailGenerator可独立使用
3. **易于维护** - 组件独立，修改影响范围小
4. **良好的扩展性** - 可以轻松添加新功能
5. **优秀的性能** - 优化的渲染和资源管理
