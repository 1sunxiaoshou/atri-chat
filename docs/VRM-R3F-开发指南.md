# VRM R3F 开发指南

> 完整的 VRM R3F 渲染系统开发指南，包含快速开始、组件使用规范和架构设计原则

## 📚 目录

- [快速开始](#快速开始)
- [组件架构](#组件架构)
- [核心组件](#核心组件)
- [业务组件](#业务组件)
- [使用场景](#使用场景)
- [大一统原则](#大一统原则)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 快速开始

### 已完成的功能

- ✅ `VRMCanvas` - R3F 渲染容器
- ✅ `StudioScene` - 工作室场景（后台管理用）
- ✅ `AIStage` - AI 沉浸式场景（聊天用）
- ✅ `useVRMLoader` - VRM 模型加载
- ✅ `useLipSync` - 口型同步
- ✅ `useMotion` - 动作播放
- ✅ `useAutoBlink` - 自动眨眼
- ✅ `useAutoLookAt` - 视线跟随
- ✅ `Character` - 核心模型组件
- ✅ `VRMViewer` - 通用业务组件
- ✅ `ChatVRMViewerR3F` - 聊天专用组件

### 基础使用

#### 1. 最简单的渲染

```tsx
import { VRMViewer } from '@/components/vrm/r3f';

function MyComponent() {
  return (
    <div className="w-full h-[600px]">
      <VRMViewer modelUrl="/path/to/model.vrm" />
    </div>
  );
}
```

#### 2. 聊天界面（沉浸式 AI 对话）

```tsx
import { ChatVRMViewerR3F } from '@/components/chat/ChatVRMViewerR3F';
import { useVRM } from '@/hooks/useVRM';

function ChatInterface() {
  const {
    modelUrl,
    expression,
    motionUrl,
    audioElement,
    subtitle,
  } = useVRM(character, true);

  return (
    <div className="w-full h-screen">
      {modelUrl && (
        <ChatVRMViewerR3F
          modelUrl={modelUrl}
          audioElement={audioElement}
          expression={expression}
          motionUrl={motionUrl}
          subtitle={subtitle}
        />
      )}
    </div>
  );
}
```

#### 3. 表情控制

```tsx
const [expression, setExpression] = useState('happy');

<VRMViewer
  modelUrl="/model.vrm"
  expression={expression}
  enableBlink={true}
  lookAtMode="mouse"
/>
```

#### 4. 动作预览

```tsx
const DEFAULT_MODEL = '/static/defaults/mox.vrm';

<VRMViewer
  modelUrl={DEFAULT_MODEL}
  motionUrl="/path/to/motion.vrma"
  autoPlayMotion={true}
  title="Wave 动作"
/>
```

#### 5. 截图功能

```tsx
import { useRef } from 'react';
import { VRMViewer, VRMViewerHandle } from '@/components/vrm/r3f';

function MyComponent() {
  const viewerRef = useRef<VRMViewerHandle>(null);

  const handleCapture = async () => {
    const blob = await viewerRef.current?.captureScreenshot(512, 683);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'screenshot.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <VRMViewer ref={viewerRef} modelUrl="/model.vrm" />
      <button onClick={handleCapture}>截图</button>
    </>
  );
}
```

---

## 组件架构

VRM R3F 系统采用三层架构：

```
业务层 (Business)
  └─ VRMViewer - 通用业务组件
  └─ ChatVRMViewerR3F - 聊天专用组件

场景层 (Scenes)
  ├─ StudioScene - 工作室场景（后台管理）
  └─ AIStage - AI 沉浸式场景（聊天）

核心层 (Core)
  ├─ VRMCanvas - R3F 渲染容器
  └─ Character - 角色渲染组件
```

### 设计原则

1. **大一统原则** - 一个 `VRMViewer` 组件打天下，避免重复封装
2. **无状态核心** - 核心组件只负责渲染，状态由外部管理
3. **直接操作底层 API** - 不重复封装 Three.js 和 VRM API
4. **组合优于继承** - 通过组合场景和角色实现不同效果

---

## 核心组件

### VRMCanvas

R3F 渲染容器，所有 VRM 组件的根容器。

```tsx
import { VRMCanvas } from '@/components/vrm/r3f';

<VRMCanvas
  shadows={true}
  camera={{ position: [0, 1.5, 3], fov: 50 }}
  className="w-full h-full"
>
  {/* 场景和角色 */}
</VRMCanvas>
```

**Props:**
- `shadows?: boolean` - 启用阴影（默认 true）
- `camera?: { position, fov }` - 相机配置
- `className?: string` - CSS 类名

**注意事项:**
- 必须作为最外层容器
- 内部必须包含 `<Suspense>` 处理异步加载
- 一个页面只能有一个 VRMCanvas

### Character

核心角色渲染组件，整合所有 VRM 功能。

```tsx
import { Character } from '@/components/vrm/r3f';

<Character
  url="/path/to/model.vrm"
  expression="happy"
  motionUrl="/path/to/motion.vrma"
  audioElement={audioRef.current}
  enableLipSync={true}
  enableBlink={true}
  lookAtMode="mouse"
/>
```

**Props:**
- `url: string` - VRM 模型 URL（必需）
- `expression?: string` - 表情名称
- `motionUrl?: string | null` - 动作文件 URL
- `audioElement?: HTMLAudioElement | null` - 音频元素（用于口型同步）
- `enableLipSync?: boolean` - 启用口型同步（默认 false）
- `enableBlink?: boolean` - 启用自动眨眼（默认 true）
- `lookAtMode?: 'mouse' | 'camera' | 'none'` - 视线跟随模式（默认 'mouse'）
- `autoPlayMotion?: boolean` - 自动播放动作（默认 true）

**内部机制:**
- 使用 `useVRMLoader` 加载模型
- 使用 `useLipSync` 处理口型同步
- 使用 `useMotion` 播放动作
- 使用 `useAutoBlink` 实现眨眼
- 使用 `useAutoLookAt` 实现视线跟随
- 在 `useFrame` 中统一更新所有系统

### 场景组件

#### StudioScene - 工作室场景

适用于：后台管理、模型预览、编辑器

```tsx
<StudioScene
  showGrid={true}
  enableControls={true}
  intensity={1}
  enableCameraFit={true}
  autoRotate={false}
>
  <Character url="/model.vrm" />
</StudioScene>
```

**Props:**
- `showGrid?: boolean` - 显示网格（默认 true）
- `enableControls?: boolean` - 启用轨道控制（默认 true）
- `intensity?: number` - 光照强度（默认 1）
- `enableCameraFit?: boolean` - 启用相机自适应（默认 true）
- `autoRotate?: boolean` - 启用自动旋转（默认 false）
- `autoRotateSpeed?: number` - 自动旋转速度（默认 2.0）

#### AIStage - AI 沉浸式场景

适用于：聊天界面、展示页面

```tsx
<AIStage
  environment="apartment"
  enablePostProcessing={true}
  bloomIntensity={0.5}
  depthOfFieldEnabled={true}
>
  <Character url="/model.vrm" />
</AIStage>
```

**Props:**
- `environment?: string` - 环境预设（默认 'apartment'）
- `enablePostProcessing?: boolean` - 启用后处理（默认 true）
- `bloomIntensity?: number` - 辉光强度（默认 0.5）
- `depthOfFieldEnabled?: boolean` - 启用景深（默认 true）

**可用环境:**
- `apartment` - 公寓
- `sunset` - 日落
- `dawn` - 黎明
- `night` - 夜晚
- `warehouse` - 仓库
- `forest` - 森林
- `studio` - 工作室
- `city` - 城市
- `park` - 公园
- `lobby` - 大厅

---

## 业务组件

### VRMViewer

通用业务组件，适用于大部分场景。

```tsx
import { VRMViewer } from '@/components/vrm/r3f';

<VRMViewer
  modelUrl="/model.vrm"
  expression="happy"
  motionUrl="/motion.vrma"
  showGrid={true}
  enableOrbitControls={true}
  autoRotate={false}
/>
```

**完整 Props:**

```tsx
interface VRMViewerProps {
  // 基础 Props
  modelUrl: string;                     // VRM 模型 URL（必需）
  motionUrl?: string | null;            // 动作文件 URL
  expression?: string;                  // 表情名称
  audioElement?: HTMLAudioElement | null; // 音频元素
  
  // 功能开关
  enableLipSync?: boolean;              // 启用口型同步（默认 false）
  enableBlink?: boolean;                // 启用自动眨眼（默认 true）
  lookAtMode?: 'mouse' | 'camera' | 'none'; // 视线跟随模式（默认 'mouse'）
  autoPlayMotion?: boolean;             // 自动播放动作（默认 true）
  
  // 场景控制
  showGrid?: boolean;                   // 显示网格（默认 true）
  enableOrbitControls?: boolean;        // 启用轨道控制（默认 true）
  enableCameraFit?: boolean;            // 启用相机自适应（默认 true）
  autoRotate?: boolean;                 // 启用自动旋转（默认 false）
  autoRotateSpeed?: number;             // 自动旋转速度（默认 2.0）
  
  // UI 定制
  className?: string;                   // 自定义类名
  title?: string;                       // 标题（显示在左上角）
  
  // 回调
  onModelLoaded?: () => void;           // 模型加载完成回调
}

// Ref 方法
interface VRMViewerHandle {
  captureScreenshot: (width?: number, height?: number) => Promise<Blob>;
}
```

**适用场景:**
- 后台管理（模型预览、动作预览）
- 角色编辑器（表情预览）
- 资源管理（3D 形象展示）

**特点:**
- 使用 `StudioScene`（工作室场景）
- 支持轨道控制（OrbitControls）
- 支持网格底盘
- 支持截图功能

### ChatVRMViewerR3F

聊天专用组件，提供沉浸式体验。

```tsx
import { ChatVRMViewerR3F } from '@/components/chat/ChatVRMViewerR3F';

<ChatVRMViewerR3F
  modelUrl="/model.vrm"
  audioElement={audioElement}
  expression="happy"
  motionUrl="/motion.vrma"
  subtitle="你好，我是 AI 助手"
/>
```

**适用场景:**
- 聊天界面
- AI 对话展示

**特点:**
- 使用 `AIStage`（AI 沉浸式场景）
- HDRI 环境贴图
- 后处理特效（Bloom、DOF、Vignette）
- 字幕叠加层
- 电影级视觉效果

---

## 使用场景

### 场景 1: 后台管理 - 模型预览

```tsx
import { VRMViewer } from '@/components/vrm/r3f';

function AdminAvatars() {
  return (
    <div className="h-[600px]">
      <VRMViewer
        modelUrl={buildAvatarUrl(avatar.file_url)}
        showGrid={true}
        enableOrbitControls={true}
        enableCameraFit={true}
      />
    </div>
  );
}
```

### 场景 2: 角色编辑器 - 表情预览

```tsx
import { VRMViewer } from '@/components/vrm/r3f';

function AssetsTab() {
  const [expression, setExpression] = useState('neutral');

  return (
    <div className="h-[600px]">
      <VRMViewer
        modelUrl={buildAvatarUrl(selectedAvatar.file_url)}
        expression={expression}
        enableBlink={true}
        lookAtMode="mouse"
        showGrid={true}
      />
      
      {/* 表情选择器 */}
      <ExpressionSelector
        value={expression}
        onChange={setExpression}
      />
    </div>
  );
}
```

### 场景 3: 动作管理 - 动作预览

```tsx
import { VRMViewer } from '@/components/vrm/r3f';

function AdminMotions() {
  const DEFAULT_MODEL = '/static/defaults/mox.vrm';

  return (
    <div className="h-[600px]">
      <VRMViewer
        modelUrl={DEFAULT_MODEL}
        motionUrl={buildMotionUrl(motion.file_url)}
        autoPlayMotion={true}
        showGrid={true}
        enableOrbitControls={true}
      />
    </div>
  );
}
```

### 场景 4: 聊天界面 - AI 对话

```tsx
import { ChatVRMViewerR3F } from '@/components/chat/ChatVRMViewerR3F';
import { useVRM } from '@/hooks/useVRM';

function ChatInterface() {
  const {
    modelUrl,
    expression,
    motionUrl,
    audioElement,
    subtitle,
  } = useVRM(character, true);

  return (
    <div className="h-screen">
      {modelUrl && (
        <ChatVRMViewerR3F
          modelUrl={modelUrl}
          audioElement={audioElement}
          expression={expression}
          motionUrl={motionUrl}
          subtitle={subtitle}
        />
      )}
    </div>
  );
}
```

---

## 大一统原则

### 核心理念

**一个组件打天下** - 不要为每个场景创建专用组件

### ❌ 错误做法：为每个场景创建专用组件

```tsx
// ❌ 不要这样做
<VRMPreview modelUrl={url} />
<VRMMotionPreview motionUrl={url} />
<VRMExpressionPreview modelUrl={url} expression="happy" />
<VRMUploadPreview file={file} />
<VRMEditPreview modelUrl={url} />
```

**问题**：
- 代码重复
- 维护困难
- 功能分散
- 不易扩展

### ✅ 正确做法：一个万能组件 + Props 控制

```tsx
// ✅ 正确做法 - 使用同一个组件
import { VRMViewer } from '@/components/vrm/r3f';

// 场景 1：模型预览
<VRMViewer modelUrl={url} />

// 场景 2：动作预览
<VRMViewer 
  modelUrl={defaultModel} 
  motionUrl={motionUrl} 
  title="Wave"
/>

// 场景 3：表情预览
<VRMViewer 
  modelUrl={url} 
  expression="happy" 
/>

// 场景 4：上传预览
<VRMViewer 
  modelUrl={uploadedUrl} 
  showControls={true}
/>

// 场景 5：编辑预览
<VRMViewer 
  modelUrl={url}
  expression={selectedExpression}
  enableBlink={true}
/>
```

**优势**：
- 代码统一
- 易于维护
- 功能集中
- 高度可扩展

### 架构对比

#### 错误的多组件架构

```
❌ 多个专用组件（重复代码）
├── VRMPreview
├── VRMMotionPreview
├── VRMExpressionPreview
├── VRMUploadPreview
└── VRMEditPreview
```

#### 正确的大一统架构

```
✅ 一个万能组件
└── VRMViewer
    ├── Props 控制功能
    ├── 场景自动适配
    └── 高度可扩展
```

---

## 最佳实践

### ✅ 推荐做法

#### 1. 使用 VRMViewer 而不是自己组合

```tsx
// ✅ 推荐
<VRMViewer modelUrl="/model.vrm" />

// ❌ 不推荐（除非有特殊需求）
<VRMCanvas>
  <Suspense>
    <StudioScene>
      <Character url="/model.vrm" />
    </StudioScene>
  </Suspense>
</VRMCanvas>
```

#### 2. 使用 buildAvatarUrl 构建 URL

```tsx
import { buildAvatarUrl } from '@/utils/url';

// ✅ 推荐
<VRMViewer modelUrl={buildAvatarUrl(avatar.file_url)} />

// ❌ 不推荐
<VRMViewer modelUrl={avatar.file_url} />
```

#### 3. 使用 Suspense 处理加载状态

```tsx
// ✅ 推荐
<Suspense fallback={<LoadingSpinner />}>
  <VRMViewer modelUrl="/model.vrm" />
</Suspense>

// ❌ 不推荐（会导致白屏）
<VRMViewer modelUrl="/model.vrm" />
```

#### 4. 动作预览使用默认模型

```tsx
const DEFAULT_MODEL = '/static/defaults/mox.vrm';

// ✅ 推荐（快速预览动作）
<VRMViewer
  modelUrl={DEFAULT_MODEL}
  motionUrl="/motion.vrma"
/>

// ❌ 不推荐（加载用户模型太慢）
<VRMViewer
  modelUrl={userAvatar.file_url}
  motionUrl="/motion.vrma"
/>
```

#### 5. 聊天界面使用 ChatVRMViewerR3F

```tsx
// ✅ 推荐（电影级效果）
<ChatVRMViewerR3F
  modelUrl="/model.vrm"
  audioElement={audioElement}
/>

// ❌ 不推荐（缺少沉浸感）
<VRMViewer
  modelUrl="/model.vrm"
  audioElement={audioElement}
/>
```

### ❌ 避免的做法

#### 1. 不要创建多个相似的预览组件

```tsx
// ❌ 错误（重复代码）
<VRMPreview />
<VRMMotionPreview />
<VRMExpressionPreview />

// ✅ 正确（一个组件打天下）
<VRMViewer expression="happy" />
<VRMViewer motionUrl="/motion.vrma" />
```

#### 2. 不要忘记清理资源

```tsx
// ❌ 错误（内存泄漏）
useEffect(() => {
  const audio = new Audio('/audio.mp3');
  audio.play();
}, []);

// ✅ 正确（清理资源）
useEffect(() => {
  const audio = new Audio('/audio.mp3');
  audio.play();
  return () => {
    audio.pause();
    audio.src = '';
  };
}, []);
```

---

## 常见问题

### Q1: 模型加载失败怎么办？

**A:** 检查以下几点：
1. URL 是否正确（使用 `buildAvatarUrl`）
2. 文件是否存在
3. 是否使用了 `<Suspense>`
4. 检查浏览器控制台错误

```tsx
<Suspense fallback={<div>加载中...</div>}>
  <VRMViewer modelUrl={buildAvatarUrl(avatar.file_url)} />
</Suspense>
```

### Q2: 表情切换不生效？

**A:** 确保：
1. 表情名称正确（区分大小写）
2. 模型支持该表情
3. 使用受控组件模式

```tsx
const [expression, setExpression] = useState('neutral');

<VRMViewer
  modelUrl="/model.vrm"
  expression={expression}
/>
```

### Q3: 动作播放不流畅？

**A:** 检查：
1. 动作文件格式是否正确（.vrma）
2. 是否启用了 `autoPlayMotion`
3. 动作文件是否损坏

```tsx
<VRMViewer
  modelUrl="/model.vrm"
  motionUrl="/motion.vrma"
  autoPlayMotion={true}
/>
```

### Q4: 如何实现截图功能？

**A:** 使用 ref 调用 `captureScreenshot` 方法：

```tsx
const viewerRef = useRef<VRMViewerHandle>(null);

const handleCapture = async () => {
  const blob = await viewerRef.current?.captureScreenshot(512, 683);
  // 处理截图
};

<VRMViewer ref={viewerRef} modelUrl="/model.vrm" />
```

### Q5: 性能优化建议？

**A:** 
1. 使用默认模型预览动作（避免加载大模型）
2. 合理使用 `enableCameraFit`（初次加载时启用，后续禁用）
3. 避免频繁切换表情和动作
4. 使用 `React.memo` 包裹组件
5. 预加载常用模型

```tsx
// 预加载
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = '/model.vrm';
  document.head.appendChild(link);
}, []);
```

---

## 相关文档

- [VRM R3F Hooks 使用规范](./VRM-R3F-Hooks使用规范.md) - Hooks 详细文档
- [VRM R3F 进阶技巧](./VRM-R3F-进阶技巧.md) - 类型处理和性能优化
- [VRM 使用指南](./VRM使用指南.md) - 后端 API 使用指南
- [VRM 动作 API](./VRM动作API.md) - 动作系统 API
