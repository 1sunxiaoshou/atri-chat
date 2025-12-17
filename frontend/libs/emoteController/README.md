# VRM 情感控制系统

参考 lobe-vidol 的设计，实现了统一的 VRM 情感表达管理系统。

## 架构设计

```
EmoteController (情感控制器)
├── ExpressionController (表情控制器)
│   ├── 表情切换
│   ├── 表情过渡
│   └── 口型同步
└── MotionController (动作控制器)
    ├── 动作加载
    ├── 动作播放
    ├── 动作过渡
    └── 闲置动画管理
```

## 核心功能

### 1. 闲置动画管理

模型加载后会自动播放闲置动画（Idle），保持自然的待机状态。

```typescript
// 自动加载闲置动画
await vrmLoader.loadIdleAnimation();

// 手动重置到闲置状态
await vrmLoader.resetToIdle();
```

### 2. 动作预设系统

支持预定义的动作集合：

```typescript
export enum MotionPresetName {
    Idle = 'idle',          // 闲置站立
    Wave = 'wave',          // 挥手
    Dance = 'dance',        // 跳舞
    Bow = 'bow',            // 鞠躬
    Clap = 'clap',          // 鼓掌
    Happy = 'happy',        // 开心
    Sad = 'sad',            // 难过
    Thinking = 'thinking'   // 思考
}
```

### 3. 表情控制

支持 VRM 标准表情：

```typescript
import { VRMExpressionPresetName } from '@pixiv/three-vrm';

// 播放表情
vrmLoader.setExpression('happy');
vrmLoader.setExpression(VRMExpressionPresetName.Happy);

// 支持的表情
// - neutral (中性)
// - happy (开心)
// - sad (难过)
// - angry (生气)
// - surprised (惊讶)
// - relaxed (放松)
```

### 4. 口型同步

自动根据音量调整口型：

```typescript
// 音量范围 0-1
vrmLoader.updateLipSync(volume);
```

## 使用示例

### 基础使用

```typescript
import { VRMLoader } from '@/utils/vrmLoader';

// 1. 创建加载器
const vrmLoader = new VRMLoader(canvas);

// 2. 加载模型（会自动加载闲置动画）
await vrmLoader.loadModel('/models/character.vrm');

// 3. 播放动作
await vrmLoader.emoteController?.playMotion(MotionPresetName.Wave);

// 4. 设置表情
vrmLoader.setExpression('happy');

// 5. 口型同步（在音频播放时调用）
vrmLoader.updateLipSync(audioVolume);
```

### 预加载动作

```typescript
// 预加载单个动作
await vrmLoader.emoteController?.preloadMotion(MotionPresetName.Dance);

// 预加载所有动作（带进度回调）
await vrmLoader.preloadAllMotions((loaded, total) => {
    console.log(`加载进度: ${loaded}/${total}`);
});
```

### 自定义动作

```typescript
// 播放自定义动作文件
await vrmLoader.emoteController?.playMotionUrl('/animations/custom.vrma', true);

// 预加载自定义动作
await vrmLoader.emoteController?.preloadMotionUrl('/animations/custom.vrma');
```

### 状态查询

```typescript
// 获取当前动作信息
const motionInfo = vrmLoader.getCurrentMotionInfo();
console.log(motionInfo);
// { name: 'idle', time: 1.5, duration: 3.0, isPlaying: true }

// 获取当前表情
const expression = vrmLoader.getCurrentExpression();
console.log(expression); // 'happy'

// 检查是否正在播放动作
const isPlaying = vrmLoader.isMotionPlaying();
```

## 配置动作预设

在 `motionController.ts` 中配置动作预设：

```typescript
private motionPresets: Map<MotionPresetName, MotionPresetConfig> = new Map([
    [MotionPresetName.Idle, { 
        url: '/animations/idle.vrma', 
        name: 'Idle/Stand',
        loop: true  // 是否循环
    }],
    // 添加更多预设...
]);
```

## 注意事项

1. **动画文件格式**：目前支持 `.vrma` 格式（VRM Animation）
2. **闲置动画**：模型加载后会自动播放 Idle 动画
3. **动作过渡**：动作切换时会有平滑过渡效果（默认 0.5 秒）
4. **表情过渡**：表情切换时会有平滑过渡效果（默认 0.3 秒）
5. **口型同步**：需要模型支持 `aa` 表情

## 与 lobe-vidol 的差异

1. **动画格式**：lobe-vidol 支持 VMD、FBX、VRMA 三种格式，我们目前只支持 VRMA
2. **预设数量**：可以根据需要扩展更多动作预设
3. **相机控制**：lobe-vidol 有相机动画系统，我们暂未实现

## 后续优化方向

1. 支持 VMD 和 FBX 动画格式
2. 添加更多动作预设
3. 实现动作队列系统
4. 添加动作混合功能
5. 优化表情过渡算法
