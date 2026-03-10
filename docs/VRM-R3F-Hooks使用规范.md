# VRM R3F Hooks 使用规范

> 本文档详细说明 VRM R3F 系统中各个 Hook 的使用方法、限制和最佳实践

## 📚 目录

- [核心 Hooks](#核心-hooks)
- [使用限制](#使用限制)
- [最佳实践](#最佳实践)
- [常见错误](#常见错误)
- [性能优化](#性能优化)

---

## 核心 Hooks

### useVRMLoader

加载 VRM 模型，基于 `useGLTF` 实现自动缓存。

**位置:** `frontend/hooks/r3f/useVRMLoader.ts`

**签名:**
```tsx
function useVRMLoader(url: string): VRM | null
```

**功能:**
- 加载 VRM 模型
- 注册 `VRMLoaderPlugin`
- 处理 VRM0.x 兼容性
- 禁用视锥剔除（`frustumCulled = false`）
- 自动缓存模型

**使用示例:**
```tsx
import { useVRMLoader } from '@/hooks/r3f';

function MyComponent({ modelUrl }: { modelUrl: string }) {
  const vrm = useVRMLoader(modelUrl);

  if (!vrm) return null;

  return <primitive object={vrm.scene} />;
}
```

**注意事项:**
- ✅ URL 变化时自动重新加载
- ✅ 相同 URL 会复用缓存
- ❌ 不要在循环中调用
- ❌ 不要在条件语句中调用

**预加载:**
```tsx
// 预加载模型（提升性能）
useVRMLoader.preload('/model.vrm');
```

---

### useLipSync

处理口型同步，基于 Web Audio API 分析音频。

**位置:** `frontend/hooks/r3f/useLipSync.ts`

**签名:**
```tsx
function useLipSync(
  vrm: VRM | null,
  audioElement: HTMLAudioElement | null,
  enabled: boolean = true
): void
```

**功能:**
- 分析音频频率
- 驱动 `vrm.expressionManager.setValue()`
- 实时更新口型（aa, ih, ou, ee, oh）

**使用示例:**
```tsx
import { useLipSync } from '@/hooks/r3f';
import { useFrame } from '@react-three/fiber';

function Character({ vrm, audioElement }: Props) {
  const lipSyncRef = useLipSync(vrm, audioElement, true);

  useFrame((state, delta) => {
    if (lipSyncRef.current) {
      lipSyncRef.current.update(delta);
    }
  });

  return <primitive object={vrm.scene} />;
}
```

**注意事项:**
- ✅ 返回 `ref.current.update(delta)` 供 `useFrame` 调用
- ✅ 自动处理音频上下文创建
- ❌ 不要在 `useFrame` 外部调用 `update`
- ❌ 音频元素必须已加载（`readyState >= 2`）

**性能优化:**
```tsx
// 仅在需要时启用
const enableLipSync = audioElement && audioElement.readyState >= 2;
useLipSync(vrm, audioElement, enableLipSync);
```

---

### useMotion

播放 VRM 动作（VRMA 格式）。

**位置:** `frontend/hooks/r3f/useMotion.ts`

**签名:**
```tsx
function useMotion(
  vrm: VRM | null,
  motionUrl: string | null,
  autoPlay: boolean = true
): {
  play: () => void;
  stop: () => void;
  isPlaying: boolean;
}
```

**功能:**
- 加载 VRMA 动作文件
- 使用 `AnimationMixer` 播放动作
- 使用 `createVRMAnimationClip` 转换动作
- 支持动作平滑过渡（CrossFade）

**使用示例:**
```tsx
import { useMotion } from '@/hooks/r3f';
import { useFrame } from '@react-three/fiber';

function Character({ vrm, motionUrl }: Props) {
  const motionRef = useMotion(vrm, motionUrl, true);

  useFrame((state, delta) => {
    if (motionRef.current) {
      motionRef.current.update(delta);
    }
  });

  return <primitive object={vrm.scene} />;
}
```

**手动控制:**
```tsx
const { play, stop, isPlaying } = useMotion(vrm, motionUrl, false);

<button onClick={play}>播放</button>
<button onClick={stop}>停止</button>
```

**注意事项:**
- ✅ 动作切换时自动淡入淡出
- ✅ 支持循环播放
- ❌ 不要频繁切换动作（性能影响）
- ❌ 确保 VRMA 文件格式正确

---

### useAutoBlink

实现自动眨眼效果。

**位置:** `frontend/hooks/r3f/useAutoBlink.ts`

**签名:**
```tsx
function useAutoBlink(
  vrm: VRM | null,
  enabled: boolean = true
): void
```

**功能:**
- 随机间隔眨眼（2-6 秒）
- 驱动 `vrm.expressionManager.setValue('blink', value)`
- 平滑的眨眼动画

**使用示例:**
```tsx
import { useAutoBlink } from '@/hooks/r3f';
import { useFrame } from '@react-three/fiber';

function Character({ vrm, enableBlink }: Props) {
  const blinkRef = useAutoBlink(vrm, enableBlink);

  useFrame((state, delta) => {
    if (blinkRef.current) {
      blinkRef.current.update(delta);
    }
  });

  return <primitive object={vrm.scene} />;
}
```

**注意事项:**
- ✅ 自动计算眨眼时机
- ✅ 不会与手动表情冲突
- ❌ 不要同时使用多个眨眼系统
- ❌ 确保模型支持 `blink` 表情

---

### useAutoLookAt

实现视线跟随效果。

**位置:** `frontend/hooks/r3f/useAutoLookAt.ts`

**签名:**
```tsx
function useAutoLookAt(
  vrm: VRM | null,
  mode: 'mouse' | 'camera' | 'none' = 'mouse'
): void
```

**功能:**
- `mouse` 模式：跟随鼠标位置
- `camera` 模式：看向相机
- `none` 模式：禁用视线跟随
- 驱动 `vrm.lookAt.target`

**使用示例:**
```tsx
import { useAutoLookAt } from '@/hooks/r3f';
import { useFrame } from '@react-three/fiber';

function Character({ vrm, lookAtMode }: Props) {
  const lookAtRef = useAutoLookAt(vrm, lookAtMode);

  useFrame((state, delta) => {
    if (lookAtRef.current) {
      lookAtRef.current.update(state, delta);
    }
  });

  return <primitive object={vrm.scene} />;
}
```

**模式说明:**
```tsx
// 鼠标跟随（默认）
useAutoLookAt(vrm, 'mouse');

// 看向相机
useAutoLookAt(vrm, 'camera');

// 禁用
useAutoLookAt(vrm, 'none');
```

**注意事项:**
- ✅ 平滑的视线过渡
- ✅ 自动处理坐标转换
- ❌ 不要在 `useFrame` 外部更新
- ❌ 确保模型支持 `lookAt` 功能

---

## 使用限制

### 🚫 严禁在 useFrame 中调用 setState

**错误示例:**
```tsx
// ❌ 错误：每帧都触发重渲染，导致性能崩溃
useFrame(() => {
  setExpression('happy');
  setMotionUrl('/motion.vrma');
});
```

**正确示例:**
```tsx
// ✅ 正确：使用 ref 存储状态
const expressionRef = useRef('happy');

useFrame(() => {
  vrm.expressionManager.setValue(expressionRef.current, 1.0);
});

// 外部更新
const handleClick = () => {
  expressionRef.current = 'sad';
};
```

### 🚫 不要在条件语句中调用 Hooks

**错误示例:**
```tsx
// ❌ 错误：违反 React Hooks 规则
if (vrm) {
  useLipSync(vrm, audioElement);
}
```

**正确示例:**
```tsx
// ✅ 正确：始终调用 Hook，内部处理 null
useLipSync(vrm, audioElement);
```

### 🚫 不要重复调用相同的 Hook

**错误示例:**
```tsx
// ❌ 错误：重复创建资源
const vrm1 = useVRMLoader(url);
const vrm2 = useVRMLoader(url);
```

**正确示例:**
```tsx
// ✅ 正确：只调用一次
const vrm = useVRMLoader(url);
```

### 🚫 不要忘记在 useFrame 中更新

**错误示例:**
```tsx
// ❌ 错误：创建了 Hook 但没有更新
const lipSyncRef = useLipSync(vrm, audioElement);
// 缺少 useFrame 调用
```

**正确示例:**
```tsx
// ✅ 正确：在 useFrame 中更新
const lipSyncRef = useLipSync(vrm, audioElement);

useFrame((state, delta) => {
  lipSyncRef.current?.update(delta);
});
```

---

## 最佳实践

### ✅ 统一在 useFrame 中更新

```tsx
function Character({ vrm, audioElement, motionUrl, enableBlink, lookAtMode }: Props) {
  // 创建所有 Hooks
  const lipSyncRef = useLipSync(vrm, audioElement);
  const motionRef = useMotion(vrm, motionUrl);
  const blinkRef = useAutoBlink(vrm, enableBlink);
  const lookAtRef = useAutoLookAt(vrm, lookAtMode);

  // 统一更新
  useFrame((state, delta) => {
    if (!vrm) return;

    // 更新 VRM 系统
    vrm.update(delta);

    // 更新各个子系统
    lipSyncRef.current?.update(delta);
    motionRef.current?.update(delta);
    blinkRef.current?.update(delta);
    lookAtRef.current?.update(state, delta);
  });

  return <primitive object={vrm.scene} />;
}
```

### ✅ 使用 useMemo 优化性能

```tsx
const config = useMemo(() => ({
  enableLipSync: !!audioElement,
  enableBlink: true,
  lookAtMode: 'mouse' as const,
}), [audioElement]);
```

### ✅ 清理资源

```tsx
useEffect(() => {
  return () => {
    // 清理音频
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
  };
}, [audioElement]);
```

### ✅ 错误处理

```tsx
try {
  const vrm = useVRMLoader(url);
} catch (error) {
  console.error('VRM 加载失败:', error);
  return <ErrorFallback />;
}
```

---

## 常见错误

### 错误 1: 在 useFrame 中调用 setState

**症状:** 页面卡顿、浏览器崩溃

**原因:** 每帧都触发重渲染

**解决方案:**
```tsx
// ❌ 错误
useFrame(() => {
  setExpression('happy');
});

// ✅ 正确
const expressionRef = useRef('happy');
useFrame(() => {
  vrm.expressionManager.setValue(expressionRef.current, 1.0);
});
```

### 错误 2: 忘记调用 update

**症状:** 口型同步不工作、动作不播放

**原因:** Hook 创建了但没有在 useFrame 中更新

**解决方案:**
```tsx
// ❌ 错误
const lipSyncRef = useLipSync(vrm, audioElement);
// 缺少 useFrame

// ✅ 正确
const lipSyncRef = useLipSync(vrm, audioElement);
useFrame((state, delta) => {
  lipSyncRef.current?.update(delta);
});
```

### 错误 3: 频繁切换动作

**症状:** 动作播放不流畅、内存泄漏

**原因:** 每次切换都创建新的 AnimationMixer

**解决方案:**
```tsx
// ❌ 错误
useEffect(() => {
  setMotionUrl(newMotion); // 频繁切换
}, [someState]);

// ✅ 正确
const debouncedMotion = useMemo(() => 
  debounce(setMotionUrl, 500),
  []
);
```

### 错误 4: 音频元素未就绪

**症状:** 口型同步延迟或不工作

**原因:** 音频元素还在加载中

**解决方案:**
```tsx
// ❌ 错误
useLipSync(vrm, audioElement);

// ✅ 正确
const isAudioReady = audioElement?.readyState >= 2;
useLipSync(vrm, isAudioReady ? audioElement : null);
```

---

## 性能优化

### 1. 条件启用 Hooks

```tsx
// 仅在需要时启用
const enableLipSync = !!audioElement && audioElement.readyState >= 2;
useLipSync(vrm, audioElement, enableLipSync);
```

### 2. 预加载模型

```tsx
useEffect(() => {
  // 预加载常用模型
  useVRMLoader.preload('/default-model.vrm');
}, []);
```

### 3. 使用 React.memo

```tsx
export const Character = React.memo(({ vrm, ...props }: Props) => {
  // ...
}, (prev, next) => {
  return prev.url === next.url && prev.expression === next.expression;
});
```

### 4. 避免不必要的重渲染

```tsx
// 使用 useCallback
const handleExpressionChange = useCallback((expr: string) => {
  expressionRef.current = expr;
}, []);

// 使用 useMemo
const config = useMemo(() => ({
  enableBlink: true,
  lookAtMode: 'mouse',
}), []);
```

### 5. 限制更新频率

```tsx
useFrame((state, delta) => {
  // 限制更新频率（每 2 帧更新一次）
  if (state.clock.elapsedTime % 2 < delta) {
    lipSyncRef.current?.update(delta);
  }
});
```

---

## 调试技巧

### 1. 启用日志

```tsx
useFrame((state, delta) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('VRM Update:', {
      delta,
      expression: expressionRef.current,
      isPlaying: motionRef.current?.isPlaying,
    });
  }
});
```

### 2. 性能监控

```tsx
import { Perf } from 'r3f-perf';

<Canvas>
  <Perf position="top-left" />
  <Character {...props} />
</Canvas>
```

### 3. 检查 VRM 状态

```tsx
useEffect(() => {
  if (vrm) {
    console.log('VRM Loaded:', {
      expressions: vrm.expressionManager?.expressionMap,
      lookAt: vrm.lookAt,
      humanoid: vrm.humanoid,
    });
  }
}, [vrm]);
```

---

## 相关文档

- [VRM R3F 组件使用规范](./VRM-R3F-组件使用规范.md)
- [VRM R3F 快速开始](./VRM-R3F-快速开始.md)
- [VRM R3F 大一统原则](./VRM-R3F-大一统原则.md)
- [VRM R3F 性能优化指南](./VRM-R3F-性能优化指南.md)
