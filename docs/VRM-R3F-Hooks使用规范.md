# VRM R3F Hooks 使用规范 (v2.0)

> 本文档基于 Zustand 状态管理重构后的新架构编写。所有 VRM 相关的 Hooks 已从全局 `hooks/r3f` 迁移至 `components/vrm/hooks`。

## 📚 目录

- [核心 Hooks](#核心-hooks)
- [状态管理 (Zustand)](#状态管理-zustand)
- [最佳实践](#最佳实践)
- [目录结构优化](#目录结构优化)

---

## 核心 Hooks

### useVRMLoader
加载 VRM 模型，基于 `useGLTF` 实现自动缓存。

**位置:** `frontend/components/vrm/hooks/useVRMLoader.ts`

**功能:**
- 加载 VRM 模型并注册插件。
- 自动禁用视锥剔除（防止大幅度动作时模型消失）。
- 支持 `preload` 和 `clear` 静态方法。

### useMotionController
管理动作播放、平滑过渡及动作缓存。

**位置:** `frontend/components/vrm/hooks/useMotionController.ts`

**功能:**
- 使用 LRU 缓存（上限 20）存储 AnimationClip。
- 自动处理动作切换时的 CrossFade 平滑过渡。
- 监听动作结束事件。

---

## 状态管理 (Zustand)

### useVRMStore
VRM 模块的“中枢神经系统”，管理渲染配置与运行时状态。

**位置:** `frontend/store/vrm/useVRMStore.ts`

**主要职责:**
- **配置持久化**：管理环境、光照、后处理等渲染配置，自动同步至 `localStorage`。
- **状态共享**：无需 Prop Drilling，组件可直接通过 `useVRMStore` 获取当前模型加载状态、表情和动作。

---

## 最佳实践

### 1. 统一在 useFrame 中更新
为了保持高性能，所有底层 VRM 更新必须在单一 `useFrame` 中进行，避免 React 渲染冲突。

```tsx
useFrame((state, delta) => {
  if (!vrm) return;
  vrm.update(delta); // 基础更新
  
  // 子系统更新
  lipSyncRef.current?.update(delta);
  motionRef.current?.update(delta);
  blinkRef.current?.update(delta);
});
```

### 2. 避免在 useFrame 中调用 setState
禁止在 `useFrame` 中触发任何会导致 React 重排的状态更新。

### 3. 类型归口
所有渲染配置类型应引自 `@/types/vrm`，不再各文件自行定义。

---

## 目录结构优化 (2026.03 重构)
- `frontend/components/vrm/core`: 核心渲染组件 (Canvas, Character, Controls)。
- `frontend/components/vrm/hooks`: VRM 特有 Hooks。
- `frontend/components/vrm/logic`: 复杂业务逻辑 (useVRM 等)。
- `frontend/components/vrm/scenes`: 场景预设。
- `frontend/components/vrm/ui`: 调整面板、性能统计。
