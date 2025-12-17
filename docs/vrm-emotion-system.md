# VRM 情感控制系统使用指南

## 概述

参考 [lobe-vidol](https://github.com/lobehub/lobe-vidol) 的设计，实现了完整的 VRM 情感表达管理系统，包括：

- ✅ 闲置动画自动管理
- ✅ 初始姿态设置
- ✅ 表情平滑过渡
- ✅ 动作平滑切换
- ✅ 口型同步
- ✅ 动作预加载
- ✅ 状态查询

## 快速开始

### 1. 基础使用

```typescript
import { VRMLoader } from '@/utils/vrmLoader';

// 创建 VRM 加载器
const canvas = document.getElementById('vrm-canvas') as HTMLCanvasElement;
const vrmLoader = new VRMLoader(canvas);

// 加载模型（自动播放闲置动画）
await vrmLoader.loadModel('/models/character.vrm');

// 现在模型已经在播放闲置动画了！
```

### 2. 播放动作

```typescript
import { MotionPresetName } from '@/libs/emoteController';

// 播放预设动作
await vrmLoader.emoteController?.playMotion(MotionPresetName.Wave);

// 播放自定义动作
await vrmLoader.emoteController?.playMotionUrl('/animations/custom.vrma', true);
```

### 3. 设置表情

```typescript
// 设置表情
vrmLoader.setExpression('happy');

// 支持的表情
vrmLoader.setExpression('neutral');  // 中性
vrmLoader.setExpression('happy');    // 开心
vrmLoader.setExpression('sad');      // 难过
vrmLoader.setExpression('angry');    // 生气
vrmLoader.setExpression('surprised'); // 惊讶
```

### 4. 口型同步

```typescript
// 在音频播放时更新口型
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();

function updateLipSync() {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // 计算音量
    const volume = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
    
    // 更新口型
    vrmLoader.updateLipSync(volume);
    
    requestAnimationFrame(updateLipSync);
}
```

## 高级功能

### 预加载动作

提前加载动作可以避免播放时的延迟：

```typescript
// 预加载单个动作
await vrmLoader.emoteController?.preloadMotion(MotionPresetName.Dance);

// 预加载所有动作（带进度）
await vrmLoader.preloadAllMotions((loaded, total) => {
    console.log(`预加载进度: ${loaded}/${total}`);
    // 可以在这里更新 UI 进度条
});
```

### 状态管理

```typescript
// 重置到闲置状态
await vrmLoader.resetToIdle();

// 获取当前动作信息
const motionInfo = vrmLoader.getCurrentMotionInfo();
if (motionInfo) {
    console.log(`当前动作: ${motionInfo.name}`);
    console.log(`播放时间: ${motionInfo.time}/${motionInfo.duration}`);
    console.log(`是否播放中: ${motionInfo.isPlaying}`);
}

// 获取当前表情
const expression = vrmLoader.getCurrentExpression();
console.log(`当前表情: ${expression}`);

// 检查是否正在播放动作
if (vrmLoader.isMotionPlaying()) {
    console.log('正在播放动作');
}
```

### 动作配置

在 `frontend/libs/emoteController/motionController.ts` 中配置动作预设：

```typescript
private motionPresets: Map<MotionPresetName, MotionPresetConfig> = new Map([
    [MotionPresetName.Idle, { 
        url: '/animations/idle.vrma',
        name: 'Idle/Stand',
        loop: true  // 循环播放
    }],
    [MotionPresetName.Wave, { 
        url: '/animations/wave.vrma',
        name: 'Gesture/Wave',
        loop: false  // 播放一次
    }],
    // 添加更多动作...
]);
```

## 完整示例

```typescript
import { VRMLoader } from '@/utils/vrmLoader';
import { MotionPresetName } from '@/libs/emoteController';

class VRMCharacter {
    private vrmLoader: VRMLoader;
    
    constructor(canvas: HTMLCanvasElement) {
        this.vrmLoader = new VRMLoader(canvas);
    }
    
    async init(modelUrl: string) {
        // 1. 加载模型
        await this.vrmLoader.loadModel(modelUrl);
        console.log('模型加载完成，正在播放闲置动画');
        
        // 2. 预加载常用动作
        await this.vrmLoader.preloadAllMotions((loaded, total) => {
            console.log(`预加载: ${loaded}/${total}`);
        });
        
        // 3. 设置初始表情
        this.vrmLoader.setExpression('neutral');
    }
    
    async greet() {
        // 播放挥手动作 + 开心表情
        this.vrmLoader.setExpression('happy');
        await this.vrmLoader.emoteController?.playMotion(MotionPresetName.Wave);
        
        // 动作结束后回到闲置状态
        setTimeout(async () => {
            await this.vrmLoader.resetToIdle();
        }, 2000);
    }
    
    async speak(audioBuffer: ArrayBuffer) {
        // 1. 设置说话表情
        this.vrmLoader.setExpression('happy');
        
        // 2. 播放音频并同步口型
        const audioContext = new AudioContext();
        const source = audioContext.createBufferSource();
        const analyser = audioContext.createAnalyser();
        
        const buffer = await audioContext.decodeAudioData(audioBuffer);
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // 口型同步循环
        const updateLipSync = () => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
            
            this.vrmLoader.updateLipSync(volume);
            
            if (source.context.state === 'running') {
                requestAnimationFrame(updateLipSync);
            }
        };
        
        source.start();
        updateLipSync();
        
        // 3. 音频结束后重置
        source.onended = async () => {
            await this.vrmLoader.resetToIdle();
        };
    }
    
    dispose() {
        this.vrmLoader.dispose();
    }
}

// 使用
const canvas = document.getElementById('vrm-canvas') as HTMLCanvasElement;
const character = new VRMCharacter(canvas);

await character.init('/models/character.vrm');
await character.greet();
```

## 架构说明

### 三层控制器设计

```
EmoteController (情感控制器)
├── ExpressionController (表情控制器)
│   ├── 表情切换和过渡
│   └── 口型同步
└── MotionController (动作控制器)
    ├── 动作加载和播放
    ├── 动作过渡
    └── 闲置动画管理
```

### 关键特性

1. **自动闲置动画**：模型加载后自动播放 Idle 动画
2. **平滑过渡**：表情和动作切换都有平滑过渡效果
3. **预加载机制**：支持预加载动作，避免播放延迟
4. **状态管理**：可以查询当前播放状态
5. **统一接口**：通过 EmoteController 统一管理表情和动作

## 注意事项

1. **动画文件**：确保 `/public/animations/` 目录下有对应的 `.vrma` 文件
2. **闲置动画**：至少需要一个 `idle.vrma` 文件作为默认闲置动画
3. **表情支持**：不同的 VRM 模型支持的表情可能不同
4. **口型同步**：需要模型支持 `aa` 表情

## 与 lobe-vidol 的对比

| 特性 | lobe-vidol | 本项目 |
|------|-----------|--------|
| 动画格式 | VMD, FBX, VRMA | VRMA |
| 闲置动画 | ✅ | ✅ |
| 表情过渡 | ✅ | ✅ |
| 动作过渡 | ✅ | ✅ |
| 口型同步 | ✅ | ✅ |
| 预加载 | ✅ | ✅ |
| 相机动画 | ✅ | ❌ |
| 舞台系统 | ✅ | ❌ |

## 后续优化

- [ ] 支持 VMD 和 FBX 动画格式
- [ ] 添加动作队列系统
- [ ] 实现动作混合功能
- [ ] 添加相机动画系统
- [ ] 优化表情过渡算法
- [ ] 添加更多预设动作

## 参考资料

- [lobe-vidol GitHub](https://github.com/lobehub/lobe-vidol)
- [VRM 规范](https://vrm.dev/)
- [three-vrm 文档](https://github.com/pixiv/three-vrm)
