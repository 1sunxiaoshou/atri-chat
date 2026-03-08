# VRM 渲染系统升级计划

## 📋 项目概述

### 目标
将现有的原生 Three.js VRM 渲染系统升级为基于 React Three Fiber (R3F) 的高表现力渲染系统，提升视觉质量和沉浸感。

### 核心价值
- 🎨 **视觉表现力提升** - 专业级光影、阴影、后处理特效
- 🌍 **环境沉浸感** - HDRI 环境贴图、动态场景切换
- 📹 **智能摄像机** - 情感驱动的运镜效果
- 🔧 **开发效率** - 声明式组件、丰富的生态系统
- 🎭 **保持现有功能** - 实时口型同步、表情控制、动作播放

---

## 🗓️ 实施计划

### 阶段一：搭建渲染基础设施（第1周）

**目标：** 引入 R3F 生态，创建高质量渲染基础

#### 任务清单
- [ ] 安装依赖包
  - `@react-three/fiber` - R3F 核心
  - `@react-three/drei` - 辅助组件库
  - `@react-three/postprocessing` - 后处理特效
  - `three-stdlib` - Three.js 扩展
  - `leva` (可选) - 调试面板

- [ ] 创建 `AIStage` 基础组件
  - 预置专业级光照系统
  - 集成环境贴图 (HDRI)
  - 配置接触阴影
  - 集成后处理特效（辉光、景深、暗角）
  - 相机控制器

- [ ] 创建简单的 VRM 测试组件
  - 基础的 VRM 模型加载
  - 场景集成测试

- [ ] 在角色库中测试 R3F 版本
  - 创建 `VRMPreviewR3F` 组件
  - 与旧版本对比测试

**交付物：**
- `frontend/components/vrm/r3f/AIStage.tsx`
- `frontend/components/vrm/r3f/VRMModel.tsx`
- `frontend/components/vrm/r3f/VRMPreviewR3F.tsx`

**验收标准：**
- ✅ R3F 场景可以正常渲染
- ✅ VRM 模型可以加载并显示
- ✅ 光影效果明显优于旧版本
- ✅ 后处理特效正常工作

---

### 阶段二：迁移核心功能（第2-3周）

**目标：** 将现有的 VRM 管理逻辑转换为 R3F Hooks

#### 任务清单

##### 2.1 创建 `useVRMLoader` Hook
- [ ] 实现 VRM 模型加载逻辑
- [ ] 处理骨骼重定向
- [ ] 自动调整模型位置和缩放
- [ ] 错误处理和加载状态管理

##### 2.2 创建 `useEmoteController` Hook
- [ ] 集成现有的 `EmoteController`
- [ ] 实现表情切换
- [ ] 实现动作播放
- [ ] 使用 `useFrame` 进行每帧更新

##### 2.3 创建 `useAudioLipSync` Hook
- [ ] 音频分析器集成
- [ ] 实时音量检测
- [ ] Viseme 映射和应用
- [ ] 静音检测

##### 2.4 创建 `useAutoBlink` Hook
- [ ] 集成现有的 `AutoBlink`
- [ ] 随机眨眼逻辑
- [ ] 平滑过渡

##### 2.5 创建 `useAutoLookAt` Hook
- [ ] 集成现有的 `AutoLookAt`
- [ ] 视线追踪相机
- [ ] 眼球扫视效果

##### 2.6 组合成完整的 `Character` 组件
- [ ] 整合所有 Hooks
- [ ] 统一的 Props 接口
- [ ] 生命周期管理

**交付物：**
- `frontend/hooks/r3f/useVRMLoader.ts`
- `frontend/hooks/r3f/useEmoteController.ts`
- `frontend/hooks/r3f/useAudioLipSync.ts`
- `frontend/hooks/r3f/useAutoBlink.ts`
- `frontend/hooks/r3f/useAutoLookAt.ts`
- `frontend/components/vrm/r3f/Character.tsx`

**验收标准：**
- ✅ VRM 模型可以正常加载
- ✅ 表情切换流畅
- ✅ 动作播放正常
- ✅ 实时口型同步延迟 < 50ms
- ✅ 自动眨眼和视线追踪正常

---

### 阶段三：替换现有组件（第4-5周）

**目标：** 渐进式替换旧组件，保持系统稳定

#### 任务清单

##### 3.1 替换管理后台预览组件
- [ ] 创建 `VRMPreviewR3F` (管理后台版)
- [ ] 创建 `VRMEditPreviewR3F`
- [ ] 创建 `VRMUploadPreviewR3F`
- [ ] 创建 `VRMMotionPreviewR3F`
- [ ] 添加 Feature Flag 控制

##### 3.2 替换角色编辑器组件
- [ ] 创建 `VRMPreviewWithExpressionR3F`
- [ ] 集成表情选择器
- [ ] 实时表情预览

##### 3.3 替换角色库组件
- [ ] 更新 `CharacterLibrary` 使用 R3F 版本
- [ ] 优化缩略图生成

##### 3.4 保持旧版本共存
- [ ] 创建版本选择器
- [ ] 环境变量配置 (`VITE_USE_R3F`)
- [ ] 性能对比测试

**交付物：**
- `frontend/components/admin/vrm/VRMPreviewR3F.tsx`
- `frontend/components/admin/vrm/VRMEditPreviewR3F.tsx`
- `frontend/components/characters/editor/VRMPreviewWithExpressionR3F.tsx`
- Feature Flag 配置

**验收标准：**
- ✅ 所有预览组件功能正常
- ✅ 可以通过 Feature Flag 切换版本
- ✅ 性能不低于旧版本
- ✅ UI/UX 保持一致

---

### 阶段四：迁移聊天界面（第6周）

**目标：** 迁移最复杂的实时交互场景

#### 任务清单
- [ ] 创建 `ChatVRMViewerR3F` 组件
- [ ] 集成实时音频流
- [ ] 集成 TTS 播放
- [ ] 集成字幕显示
- [ ] 性能优化（目标：60fps）
- [ ] 压力测试

**交付物：**
- `frontend/components/chat/VRMViewerR3F.tsx`
- 性能测试报告

**验收标准：**
- ✅ 实时口型同步延迟 < 50ms
- ✅ 帧率稳定在 60fps
- ✅ 表情和动作切换流畅
- ✅ 字幕显示正常

---

### 阶段五：环境与沉浸感增强（第7-8周）

**目标：** 添加高级视觉特效，提升沉浸感

#### 任务清单

##### 5.1 HDRI 环境系统
- [ ] 收集/购买高质量 HDRI 贴图
  - 白天（晴天、阴天）
  - 夜晚（城市、星空）
  - 室内（客厅、卧室、办公室）
  - 室外（公园、海滩、森林）
- [ ] 创建 `EnvironmentSelector` 组件
- [ ] 实现环境切换动画
- [ ] 环境预设管理

##### 5.2 动态摄像机系统
- [ ] 创建 `useCameraAnimation` Hook
- [ ] 实现情感驱动的运镜
  - 亲密模式：镜头推进 + 景深增强
  - 正常模式：标准距离
  - 思考模式：轻微摇晃
- [ ] 平滑过渡动画
- [ ] 手动控制与自动运镜切换

##### 5.3 高级后处理特效
- [ ] 景深效果（Depth of Field）
  - 焦点跟随角色
  - 背景虚化
- [ ] 辉光效果（Bloom）
  - 高光增强
  - 柔和光晕
- [ ] 色调映射（Tone Mapping）
  - 电影级色彩
- [ ] 暗角效果（Vignette）
  - 聚焦中心

##### 5.4 粒子特效系统（可选）
- [ ] 环境粒子（灰尘、光斑）
- [ ] 情感粒子（心形、星星）
- [ ] 天气效果（雨、雪）

**交付物：**
- `frontend/components/vrm/r3f/EnvironmentSelector.tsx`
- `frontend/hooks/r3f/useCameraAnimation.ts`
- `frontend/components/vrm/r3f/effects/` 目录
- HDRI 资源库

**验收标准：**
- ✅ 至少 8 个高质量环境预设
- ✅ 环境切换流畅（< 1s）
- ✅ 摄像机运镜自然
- ✅ 后处理特效可配置
- ✅ 性能影响 < 10%

---

### 阶段六：优化与清理（第9周）

**目标：** 性能优化、代码清理、文档完善

#### 任务清单
- [ ] 性能优化
  - 模型 LOD（细节层次）
  - 纹理压缩
  - 阴影优化
  - 后处理优化
- [ ] 删除旧版本代码
- [ ] 更新文档
  - 组件使用文档
  - API 文档
  - 最佳实践
- [ ] 创建示例和教程

**交付物：**
- 性能优化报告
- 完整的组件文档
- 使用示例

**验收标准：**
- ✅ 性能达到或超过旧版本
- ✅ 代码覆盖率 > 80%
- ✅ 文档完整
- ✅ 无已知 bug

---

## 📊 技术栈

### 核心依赖
- `@react-three/fiber` ^8.15.0 - R3F 核心
- `@react-three/drei` ^9.92.0 - 辅助组件
- `@react-three/postprocessing` ^2.16.0 - 后处理
- `three` ^0.169.0 - Three.js
- `@pixiv/three-vrm` ^3.0.0 - VRM 支持

### 可选依赖
- `leva` ^0.9.35 - 调试面板
- `@react-spring/three` ^9.7.3 - 动画库
- `three-stdlib` ^2.29.0 - Three.js 扩展

---

## 🎯 关键指标

### 性能指标
- **帧率：** 稳定 60fps
- **口型同步延迟：** < 50ms
- **模型加载时间：** < 2s
- **内存占用：** < 500MB
- **包体积增加：** < 200KB

### 质量指标
- **光影质量：** 专业级
- **阴影质量：** 2048x2048
- **后处理特效：** 可配置
- **环境贴图：** 4K HDR

---

## ⚠️ 风险与应对

### 风险1：性能不达标
**应对：**
- 保持旧版本可用
- 提供性能模式切换
- 优化后处理特效

### 风险2：实时口型同步延迟
**应对：**
- 使用 Web Worker 处理音频
- 优化 useFrame 逻辑
- 降低后处理复杂度

### 风险3：学习曲线陡峭
**应对：**
- 详细的文档和示例
- 团队培训
- 代码审查

### 风险4：兼容性问题
**应对：**
- 浏览器兼容性测试
- WebGL 降级方案
- 错误边界处理

---

## 📈 预期收益

### 短期收益（1-2个月）
- ✅ 视觉质量显著提升
- ✅ 代码可维护性提高
- ✅ 开发效率提升 30%

### 中期收益（3-6个月）
- ✅ 用户满意度提升
- ✅ 差异化竞争优势
- ✅ 社区口碑提升

### 长期收益（6-12个月）
- ✅ 技术债务减少
- ✅ 扩展性增强
- ✅ 团队技术能力提升

---

## 📚 参考资料

- [React Three Fiber 官方文档](https://r3f.docs.pmnd.rs/)
- [Drei 组件库](https://github.com/pmndrs/drei)
- [Three.js 官方文档](https://threejs.org/docs/)
- [@pixiv/three-vrm 文档](https://pixiv.github.io/three-vrm/)
- [Postprocessing 文档](https://github.com/pmndrs/postprocessing)

---

## 👥 团队分工

- **前端开发：** R3F 组件开发、Hooks 实现
- **视觉设计：** HDRI 资源、后处理参数调优
- **性能优化：** 性能监控、优化方案
- **测试：** 功能测试、性能测试、兼容性测试

---

## 📝 更新日志

### 2025-01-XX
- 创建项目计划书
- 定义技术方案和实施路线

---

**项目负责人：** [待定]  
**创建日期：** 2025-01-XX  
**最后更新：** 2025-01-XX
