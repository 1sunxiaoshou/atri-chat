# VRM 服务层

VRM 业务逻辑层，负责整合场景、模型、播放等应用功能。

## 架构说明

```
frontend/
├── types/
│   └── vrm.ts                    # 共享类型定义
├── libs/
│   └── vrm-emote/                # VRM 情感控制库（可独立复用）
│       ├── emoteController.ts    # 统一情感控制入口
│       ├── expressionController.ts  # 表情控制
│       ├── motionController.ts   # 动作控制
│       ├── autoBlink.ts          # 自动眨眼（独立系统）
│       └── autoLookAt.ts         # 视线跟踪 + 眼球扫视
└── services/
    └── vrm/                      # VRM 业务服务层
        ├── vrmManager.ts         # 顶层协调器
        ├── scene/
        │   └── sceneManager.ts   # Three.js 场景管理
        ├── model/
        │   └── modelManager.ts   # 模型加载和系统协调
        └── playback/
            └── playbackManager.ts # 音频播放控制
```

## 设计理念（参考 Airi）

### 独立更新，统一混合
每个系统（眨眼、扫视、表情、口型）都是独立的模块：
- 各自独立更新自己的状态
- 通过 `expressionManager.setValue()` 设置权重
- VRM 的 `expressionManager` 自动混合所有权重

### 更新顺序的重要性
系统按照特定顺序更新，确保正确的叠加效果：
```
1. 动画混合器      → 基础动画
2. 自定义帧钩子    → 用户扩展点
3. 人形骨骼        → 应用动画到骨骼
4. 视线追踪        → 头部朝向
5. 眨眼            → 眼部细节
6. 眼球扫视        → 微调视线
7. 表情            → 整体面部
8. 口型            → 嘴部动作
9. 弹簧骨骼        → 物理模拟
```

## 职责划分

### libs/vrm-emote（情感控制库）
- 纯粹的 VRM 情感控制功能
- 不依赖业务逻辑
- 可在其他项目中复用
- 每个系统完全独立（表情、动作、眨眼、视线）

### services/vrm（业务服务层）
- 整合场景、模型、播放等业务功能
- 依赖 `vrm-emote` 库
- 协调各个独立系统的更新顺序
- 处理应用特定的逻辑（如音频播放、字幕、标记触发）
- 提供统一的对外接口

## 使用示例

### 基础使用
```typescript
import { VRMManager } from '@/services/vrm';
import { AudioSegment } from '@/types/vrm';

// 初始化
const vrmManager = new VRMManager(canvas, {
  onSubtitleChange: (text) => console.log(text),
  onError: (error) => console.error(error),
  onLoadingChange: (loading) => console.log(loading)
});

// 加载模型
await vrmManager.loadModel('model-id');

// 播放音频片段
const segments: AudioSegment[] = [...];
await vrmManager.playSegments(segments);

// 清理
vrmManager.dispose();
```

### 高级功能

#### 自定义帧钩子
```typescript
// 在更新循环中插入自定义逻辑
const modelManager = vrmManager.getModelManager();
modelManager?.setFrameHook((vrm, delta) => {
  // 自定义逻辑，例如：
  // - 根据游戏状态调整表情
  // - 实现特殊的动画效果
  // - 调试和性能监控
  console.log('Frame update', delta);
});

// 移除钩子
modelManager?.setFrameHook(null);
```

#### 控制眨眼
```typescript
const modelManager = vrmManager.getModelManager();

// 禁用自动眨眼
modelManager?.setAutoBlinkEnabled(false);

// 启用自动眨眼
modelManager?.setAutoBlinkEnabled(true);

// 检查是否正在眨眼
const isBlinking = modelManager?.isBlinking();
```

## 类型定义

所有 VRM 相关的类型定义统一在 `frontend/types/vrm.ts` 中，包括：
- 情感控制相关类型（EmoteController）
- 业务层相关类型（VRM Service）
- 工具函数

## 依赖关系

```
VRMManager
  ├── SceneManager (场景渲染)
  ├── ModelManager (模型管理 + 系统协调)
  │   ├── EmoteController (情感控制)
  │   │   ├── ExpressionController (表情)
  │   │   └── MotionController (动作)
  │   ├── AutoBlink (眨眼 - 独立系统)
  │   └── AutoLookAt (视线 + 扫视 - 独立系统)
  └── PlaybackManager (播放控制)
```

## 系统协调机制

`ModelManager` 负责协调所有独立系统的更新顺序：

```typescript
// ModelManager.updateCallback
updateCallback = (delta: number) => {
  // 1. 动画混合器
  mixer?.update(delta);
  
  // 2. 自定义帧钩子（用户扩展）
  frameHook?.(vrm, delta);
  
  // 3. 人形骨骼
  vrm.humanoid.update();
  
  // 4. 视线追踪（VRM 内置）
  vrm.lookAt?.update(delta);
  
  // 5. 眨眼（独立系统）
  autoBlink?.update(delta);
  
  // 6. 眼球扫视（独立系统）
  autoLookAt?.update(delta);
  
  // 7. 表情（整体面部）
  emoteController?.update(delta);
  
  // 8. 口型（外部调用 updateLipSync）
  
  // 9. 弹簧骨骼（物理模拟）
  vrm.springBoneManager?.update(delta);
};
```

这个顺序确保：
- 基础姿态 → 头部朝向 → 眼部细节 → 面部表情 → 嘴部动作
- 后面的系统可以叠加在前面的基础上
- 各系统通过 VRM 的 `expressionManager` 自动混合权重

## 参考项目

本架构参考了 [moeru-ai/airi](https://github.com/moeru-ai/airi) 项目的最佳实践：
- 独立系统设计
- 更新顺序优化
- 自定义帧钩子机制
- 权重自动混合
