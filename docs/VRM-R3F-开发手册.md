# VRM R3F 开发手册 (v2.0)

> 本手册汇集了 ATRI Chat 项目中关于 VRM 的所有核心组件使用、 Hooks 规范及最佳实践。

## 📚 目录
- [整体组件架构](#整体组件架构)
- [核心渲染组件](#核心渲染组件)
- [状态管理 (useVRMStore)](#状态管理-usevrmstore)
- [核心 Hooks](#核心-hooks)
- [如何适配受重构影响的组件](#如何适配受重构影响的组件)

---

## 整体组件架构
VRM 模块采用高度内聚的层级结构，所有代码位于 `frontend/components/vrm/` 目录下：

- **Core**: 基础渲染组件 (`VRMCanvas`, `Character`)。
- **Hooks**: VRM 特有逻辑钩子 (`useVRMLoader`, `useMotionController`)。
- **Scenes**: 预设环境场景 (`AIStage`, `StudioScene`)。
- **Logic**: 高级业务编排钩子 (`useVRM`)。
- **UI**: 全局控制面板 (`VRMRenderSettings`)。

---

## 核心渲染组件

### AIStage (沉浸式场景)
用于聊天界面，支持环境、景深、辉光等电影级后处理。
- **用法**: 直接包裹 `Character`。配置由 `useVRMStore` 自动同步。
- **位置**: `frontend/components/vrm/r3f/scenes/AIStage.tsx`

### Character (角色核心)
管理 VRM 模型的加载、动作更新、眨眼及口型同步。
- **位置**: `frontend/components/vrm/r3f/core/Character.tsx`

---

## 状态管理 (useVRMStore)
使用 Zustand 管理 VRM 的全局生命周期：
- **config**: 持久化的渲染设置。
- **runtime**: 实时同步的动作、表情及字幕。

---

## 如何适配受重构影响的组件

本次重构对文件目录和状态存取逻辑进行了大幅调整。如果你需要维护以下组件，请注意：

### 1. 引用路径变更
所有 R3F Hooks 已从 `@/hooks/r3f/xxx` 迁移至 `../../hooks/xxx` (在 VRM 目录内相对引用) 或 `@/components/vrm/hooks/xxx`。

### 2. 受影响文件清单及适配说明
| 文件位置 | 影响分值 | 适配动作 |
| :--- | :--- | :--- |
| `frontend/components/chat/ChatVRMViewerR3F.tsx` | ⭐️⭐️⭐️⭐️ | 移除本地 `renderConfig` 状态，改为从 Store 获取。 |
| `frontend/components/admin/vrm/AdminMotions.tsx` | ⭐️⭐️ | 更新 `VRMViewer` 和 `Hooks` 的导入路径。 |
| `frontend/components/characters/AssetsTab.tsx` | ⭐️⭐️ | 表情切换需通过 Store 的 `setExpression` 触发。 |
| `frontend/components/vrm/ui/VRMRenderSettings.tsx` | ⭐️⭐️⭐️ | 移除 `Props` 和回调，改为直接双向绑定 Store。 |

---

## 最佳实践
1. **单一 useFrame**: 所有 3D 更新必须在 `Character.tsx` 的单一渲染循环中执行。
2. **拒绝 Prop Drilling**: 复杂的渲染配置请直接使用 `useVRMStore` 订阅。
3. **URL 规范**: 使用 `buildAvatarUrl` 或 `buildMotionUrl` 包装资源路径。
