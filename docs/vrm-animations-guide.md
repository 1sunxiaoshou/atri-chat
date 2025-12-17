# VRM 动画获取指南

## 需要的动画文件

根据当前配置，你需要准备以下动画文件（放在 `static/animations/` 目录下）：

### 基础动画
1. **idle.vrma** - 闲置动画（站立/呼吸）
   - 循环播放
   - 推荐时长：3-5秒
   - 用途：默认姿态

2. **wave.vrma** - 挥手动画
   - 单次播放
   - 推荐时长：2-3秒
   - 用途：打招呼

3. **bow.vrma** - 鞠躬动画
   - 单次播放
   - 推荐时长：2-3秒
   - 用途：礼貌问候

4. **clap.vrma** - 鼓掌动画
   - 单次播放
   - 推荐时长：2-3秒
   - 用途：表示赞同

### 情感动画
5. **happy.vrma** - 开心动画
   - 循环播放
   - 推荐时长：3-5秒
   - 用途：表达喜悦

6. **sad.vrma** - 悲伤动画
   - 循环播放
   - 推荐时长：3-5秒
   - 用途：表达难过

7. **thinking.vrma** - 思考动画
   - 循环播放
   - 推荐时长：3-5秒
   - 用途：表达思考

### 特殊动画
8. **dance.vrma** - 跳舞动画
   - 循环播放
   - 推荐时长：5-10秒
   - 用途：娱乐互动

## 动画资源获取

### 方法 1：VRoid Hub（推荐）
1. 访问 https://hub.vroid.com/
2. 搜索 "animation" 或"モーション"
3. 下载 `.vrma` 格式文件
4. 放到 `static/animations/` 目录

### 方法 2：Mixamo（需要转换）
1. 访问 https://www.mixamo.com/
2. 选择动画（无需登录即可预览）
3. 下载 FBX 格式
4. 使用 Blender 转换为 VRMA

### 方法 3：使用 lobe-vidol 的示例动画
lobe-vidol 项目中有一些示例动画可以参考：
- GitHub: https://github.com/lobehub/lobe-vidol
- 查看 `public/animations/` 目录

### 方法 4：自己制作
使用动作捕捉设备或软件：
- VRoid Studio（官方工具）
- Blender + Rigify
- Unity + Final IK

## 文件结构

```
static/
└── animations/
    ├── idle.vrma          # 闲置
    ├── wave.vrma          # 挥手
    ├── bow.vrma           # 鞠躬
    ├── clap.vrma          # 鼓掌
    ├── happy.vrma         # 开心
    ├── sad.vrma           # 悲伤
    ├── thinking.vrma      # 思考
    └── dance.vrma         # 跳舞
```

## 动画格式说明

### VRMA 格式
- VRM Animation 的标准格式
- 基于 glTF 2.0
- 专为 VRM 模型设计
- 包含骨骼动画和表情动画

### 文件大小建议
- 简单动画：50-200 KB
- 复杂动画：200-500 KB
- 尽量压缩以提高加载速度

## 临时解决方案

如果暂时没有动画文件，可以：

1. **禁用动画预加载**
   - 注释掉 `loadIdleAnimation()` 调用
   - VRM 模型会保持 T-Pose

2. **使用占位符**
   - 创建一个简单的站立动画
   - 或者使用 VRM 模型的默认姿态

3. **动态配置**
   - 修改 `MotionController` 的 `motionPresets`
   - 只保留你有的动画

## 修改动画配置

如果你想使用不同的动画文件，编辑 `frontend/libs/emoteController/motionController.ts`：

```typescript
private motionPresets: Map<MotionPresetName, MotionPresetConfig> = new Map([
    [MotionPresetName.Idle, { 
        url: '/animations/your-idle.vrma',  // 修改这里
        name: 'Idle/Stand',
        loop: true 
    }],
    // ... 其他动画
]);
```

## 测试动画

加载动画后，可以在浏览器控制台测试：

```javascript
// 获取 VRMLoader 实例
const vrmLoader = window.vrmLoader; // 需要先暴露到 window

// 播放动画
vrmLoader.emoteController.playMotion('wave');
vrmLoader.emoteController.playMotion('happy', true); // 循环播放
```

## 常见问题

### Q: 动画加载失败？
A: 检查文件路径和格式，确保是 `.vrma` 格式

### Q: 动画播放不流畅？
A: 检查动画帧率和文件大小，建议 30fps

### Q: 动画与模型不匹配？
A: 确保动画是为 VRM 模型设计的，骨骼结构要匹配

### Q: 没有动画文件怎么办？
A: 可以先禁用动画功能，或使用简单的表情变化代替
