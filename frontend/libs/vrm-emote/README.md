# VRM 情感控制库

纯粹的 VRM 情感控制功能库，可在其他项目中独立复用。

## 设计理念

参考 [moeru-ai/airi](https://github.com/moeru-ai/airi) 项目的最佳实践：

### 1. 独立系统设计
每个系统（表情、动作、眨眼、视线）完全独立：
- 各自管理自己的状态
- 通过 VRM 的 `expressionManager` 设置权重
- 不相互依赖，由外部协调更新顺序

### 2. 权重自动混合
所有系统通过 `expressionManager.setValue()` 设置权重：
- 表情系统设置面部表情权重
- 眨眼系统设置眨眼权重
- 口型系统设置嘴部权重
- VRM 自动混合所有权重，生成最终效果

### 3. 更新顺序由外部控制
库本身不关心更新顺序，由使用者（如 `ModelManager`）决定：
```typescript
// 推荐的更新顺序
autoBlink.update(delta);        // 先眨眼
autoLookAt.update(delta);       // 再视线
emoteController.update(delta);  // 最后表情
```

## 模块说明

### EmoteController
统一的情感控制入口，整合表情和动作：
```typescript
const emoteController = new EmoteController(vrm);

// 播放表情
emoteController.playEmotion('happy');

// 播放动画
await emoteController.playAnimation('dance');

// 口型同步
emoteController.lipSync('aa', 0.5);

// 每帧更新
emoteController.update(delta);
```

### ExpressionController
表情控制器，管理面部表情：
```typescript
const expressionController = new ExpressionController(vrm);

// 切换表情（带平滑过渡）
expressionController.playEmotion('happy');

// 口型同步
expressionController.lipSync('aa', 0.5);

// 每帧更新
expressionController.update(delta);
```

**关键特性**：
- 表情切换时自动清空其他表情（保留口型和眨眼）
- 使用缓动函数实现平滑过渡
- 直接设置完整权重，让 VRM 自动混合

### MotionController
动作控制器，管理 VRM 动画：
```typescript
const motionController = new MotionController(vrm);

// 预加载动画
await motionController.preloadAnimation('dance', '/animations/dance.vrma');

// 播放动画
await motionController.playAnimation('dance', true);

// 每帧更新
motionController.update(delta);
```

### AutoBlink
自动眨眼系统（独立）：
```typescript
const autoBlink = new AutoBlink(vrm.expressionManager);

// 启用/禁用
autoBlink.setEnable(true);

// 每帧更新
autoBlink.update(delta);

// 检查状态
const isBlinking = autoBlink.isBlinkingNow();
```

**关键特性**（参考 Airi）：
- 使用正弦曲线让眨眼更自然
- 随机间隔 1-6 秒
- 眨眼持续 0.2 秒

### AutoLookAt
视线追踪 + 眼球扫视系统（独立）：
```typescript
const autoLookAt = new AutoLookAt(vrm, camera);

// 每帧更新
autoLookAt.update(delta);
```

**关键特性**（参考 Airi）：
- 视线平滑追踪相机
- 眼球扫视（Saccade）：视线在目标附近随机移动
- 使用 lerp 实现平滑过渡

## 口型同步改进

参考 Airi 的实现：

```typescript
// 静音检测
const SILENCE_THRESHOLD = 0.04;
if (volume < SILENCE_THRESHOLD) {
  // 静音时关闭所有口型
  emoteController.lipSync('aa', 0);
  return;
}

// 使用多个音素增加变化
const lipValue = Math.min(Math.sqrt(volume) * 0.9, 0.7);
emoteController.lipSync('aa', lipValue);
emoteController.lipSync('ih', lipValue * 0.3);
emoteController.lipSync('ou', lipValue * 0.2);
```

**改进点**：
- 静音检测（音量 < 0.04）
- 使用多个音素（aa, ih, ou）增加变化
- 限制最大值为 0.7
- 口型权重不再降低，让 VRM 自动混合

## 类型定义

所有类型定义在 `frontend/types/vrm.ts`：
- `ExpressionName` - 表情名称
- `AnimationInfo` - 动画信息
- `MotionState` - 动作状态
- `EmoteControllerConfig` - 配置选项
- 等等

## 使用示例

### 完整示例
```typescript
import { VRM } from '@pixiv/three-vrm';
import { 
  EmoteController, 
  AutoBlink, 
  AutoLookAt 
} from '@/libs/vrm-emote';

// 初始化各个系统
const emoteController = new EmoteController(vrm);
const autoBlink = new AutoBlink(vrm.expressionManager);
const autoLookAt = new AutoLookAt(vrm, camera);

// 更新循环（推荐顺序）
function update(delta: number) {
  // 1. 眨眼
  autoBlink.update(delta);
  
  // 2. 视线
  autoLookAt.update(delta);
  
  // 3. 表情
  emoteController.update(delta);
}

// 播放表情
emoteController.playEmotion('happy');

// 口型同步
emoteController.lipSync('aa', 0.5);

// 控制眨眼
autoBlink.setEnable(false);
```

## 参考资料

- [moeru-ai/airi](https://github.com/moeru-ai/airi) - 参考项目
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) - VRM 核心库
- [VRM 规范](https://vrm.dev/) - VRM 格式文档
