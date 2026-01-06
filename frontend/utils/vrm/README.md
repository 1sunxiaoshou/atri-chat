# VRM 模块架构说明

## 📁 目录结构

```
vrm/
├── scene/
│   └── sceneManager.ts      # 场景渲染管理器
├── model/
│   └── modelManager.ts      # 模型动画管理器
├── playback/
│   └── playbackManager.ts   # 播放控制管理器
├── vrmManager.ts            # VRM 协调管理器
├── types.ts                 # 类型定义
├── index.ts                 # 统一导出
└── README.md                # 本文档
```

## 🏗️ 架构设计

### 分层架构

```
┌─────────────────────────────────────────┐
│         React Component Layer           │
│            (useVRM Hook)                │
│  职责：生命周期、状态管理、React集成     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        Coordination Layer               │
│           (VRMManager)                  │
│  职责：协调各层、统一接口、错误处理      │
└─────────────────────────────────────────┘
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Scene   │ │  Model   │ │ Playback │
│ Manager  │ │ Manager  │ │ Manager  │
└──────────┘ └──────────┘ └──────────┘
```

### 各层职责

#### 1. SceneManager（场景渲染层）
- Three.js 场景初始化
- 相机、灯光、渲染器管理
- 渲染循环控制
- 窗口大小适配
- 提供更新回调机制

**代码量**：约 150-200 行

#### 2. ModelManager（模型动画层）
- VRM 模型加载
- 动画加载与管理
- 表情控制
- 口型同步
- 视线跟踪

**代码量**：约 200-250 行

#### 3. PlaybackManager（播放控制层）
- 音频播放控制
- 时间戳同步
- 标记触发（表情、动作）
- 口型同步
- 字幕更新

**代码量**：约 250-300 行

#### 4. VRMManager（协调层）
- 协调三个子管理器
- 提供统一的对外接口
- 处理跨层逻辑
- 错误处理和日志

**代码量**：约 100-150 行

#### 5. useVRM Hook（React 层）
- React 生命周期管理
- 状态暴露给组件
- 简单的接口封装

**代码量**：约 80-100 行

## 📝 使用示例

### 基本使用

```typescript
import { useVRM } from '../hooks/useVRM';

function MyComponent() {
  const { canvasRef, subtitle, isLoading, playSegments, stop } = useVRM(
    character,
    isVRMMode
  );

  return (
    <div>
      <canvas ref={canvasRef} />
      {subtitle && <div>{subtitle}</div>}
    </div>
  );
}
```

### 直接使用 VRMManager

```typescript
import { VRMManager } from '../utils/vrm';

const manager = new VRMManager(canvas, {
  onSubtitleChange: (text) => console.log(text),
  onError: (error) => console.error(error),
  onLoadingChange: (loading) => console.log('Loading:', loading)
});

// 加载模型
await manager.loadModel('model_id');

// 播放音频
await manager.playSegments(segments);

// 停止播放
manager.stop();

// 清理资源
manager.dispose();
```

## ✅ 重构优势

### 1. 职责清晰
- 每个管理器只负责一个领域
- 代码易于理解和维护

### 2. 低耦合
- 各层通过接口通信
- 易于测试和替换

### 3. 可扩展
- 新增功能只需修改对应层
- 不影响其他层的代码

### 4. 易于调试
- 日志分层记录
- 问题定位更快

## 🔄 迁移指南

### 旧代码
```typescript
const loaderRef = useRef<VRMLoader | null>(null);
const playerRef = useRef<VRMTimedPlayer | null>(null);

// 需要手动管理两个实例
loaderRef.current = new VRMLoader(canvas);
playerRef.current = new VRMTimedPlayer(loader, streamPlayer, callback);
```

### 新代码
```typescript
const managerRef = useRef<VRMManager | null>(null);

// 只需管理一个实例
managerRef.current = new VRMManager(canvas, callbacks);
```

## 📦 类型定义

所有类型定义都在 `types.ts` 中：

```typescript
export interface AudioSegment {
  sentence_index: number;
  text: string;
  marked_text: string;
  audio_url?: string;
  duration: number;
  start_time: number;
  end_time: number;
  markups: TimedMarkup[];
}

export interface TimedMarkup {
  type: 'state' | 'action';
  value: string;
  timestamp: number;
}

export interface VRMCallbacks {
  onSubtitleChange?: (text: string) => void;
  onError?: (error: string) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}
```

## 🗑️ 已废弃的文件

以下文件已移至 `frontend/utils/vrm_old_backup/`：
- `vrmLoader.ts`
- `vrmTimedPlayer.ts`

如果确认新架构工作正常，可以删除备份目录。
