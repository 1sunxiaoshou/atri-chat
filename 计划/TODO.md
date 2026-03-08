# 项目待办清单

## ✅ 已完成

- [x] 去除AI供应商分页（或者直接多次请求）
- [x] 修复角色编辑页面的正常编辑
- [x] 修改动作驱动引擎以支持随机动作
- [x] VRM上传预览
- [x] 动作上传预览
- [x] 国际化：迁移翻译到JSON格式
- [x] 国际化：更新项目规则
- [x] 前端国际化完善
  - [x] 排查硬编码中文文本
  - [x] 修复 `t('key') || '默认值'` 用法
  - [x] 补充缺失的翻译键
- [x] **长期记忆系统重构 V3** ✅ 已完成
  - [x] 设计简洁的工具架构（4 个核心工具）
  - [x] 实现参数化控制（file, section, mode 等）
  - [x] 支持相对路径，AI 可自主管理文件结构
  - [x] 工具描述包含完整使用说明
  - [x] 极简 System Prompt（约 200 字）
  - [x] 创建测试脚本
- [x] **中间件架构优化** ✅ 已完成
  - [x] 统一中间件导入逻辑
  - [x] 分离回调处理器到 `core/callbacks/`
  - [x] 添加 LLM 调用日志记录器（可配置）
  - [x] 添加 HTTP 请求日志中间件（可配置）
  - [x] 环境变量控制日志开关
    - `ENABLE_LLM_CALL_LOGGER` - LLM 调用详细日志
    - `ENABLE_HTTP_LOGGING` - HTTP 请求日志
- [x] **供应商Logo系统清理** ✅ 已完成 (2025-03-07)
  - [x] 移除后端所有供应商的 logo 字段定义（10个供应商）
  - [x] 移除 `ProviderMetadata` 和 API Schema 中的 logo 字段
  - [x] 数据库迁移：移除 `provider_configs.logo` 列
  - [x] 前端使用 `@lobehub/icons` 的 `ProviderIcon` 组件（基于 `template_type`）
  - [x] 更新文档 `docs/供应商图标集成-完成报告.md`
- [x] **模型供应商创建优化** ✅ 已完成 (2025-03-07)
  - [x] 修复重复ID时输入框锁死问题 → 改为提交时校验
  - [x] 添加错误提示翻译键（providerIdExists, providerCreated, providerUpdated）
  - [x] 优化默认值：`provider_id` 默认使用 `template_type`
  - [x] 智能同步：只在 `provider_id === template_type` 时自动同步更新

## 🔥 进行中
- [ ] **VRM 渲染系统升级到 React Three Fiber** 🎨
  - 详细计划：`docs/VRM渲染系统升级计划.md`
  - 目标：提升视觉表现力和沉浸感

## 📋 待办事项

### 🎬 VRM 渲染系统升级（优先级：高）

#### 阶段一：搭建渲染基础设施（第1周）
- [ ] 安装 R3F 依赖包
  - [ ] `@react-three/fiber`
  - [ ] `@react-three/drei`
  - [ ] `@react-three/postprocessing`
  - [ ] `three-stdlib`
  - [ ] `leva` (可选)
- [ ] 创建 `AIStage` 基础组件
  - [ ] 专业级光照系统
  - [ ] HDRI 环境贴图
  - [ ] 接触阴影
  - [ ] 后处理特效（辉光、景深、暗角）
  - [ ] 相机控制器
- [ ] 创建简单的 VRM 测试组件
  - [ ] 基础 VRM 模型加载
  - [ ] 场景集成测试
- [ ] 在角色库中测试 R3F 版本
  - [ ] 创建 `VRMPreviewR3F` 组件
  - [ ] 与旧版本对比测试

#### 阶段二：迁移核心功能（第2-3周）
- [ ] 创建 `useVRMLoader` Hook
  - [ ] VRM 模型加载逻辑
  - [ ] 骨骼重定向
  - [ ] 自动位置调整
  - [ ] 错误处理
- [ ] 创建 `useEmoteController` Hook
  - [ ] 集成现有 `EmoteController`
  - [ ] 表情切换
  - [ ] 动作播放
  - [ ] 每帧更新
- [ ] 创建 `useAudioLipSync` Hook
  - [ ] 音频分析器
  - [ ] 实时音量检测
  - [ ] Viseme 映射
  - [ ] 静音检测
- [ ] 创建 `useAutoBlink` Hook
  - [ ] 集成现有 `AutoBlink`
  - [ ] 随机眨眼
- [ ] 创建 `useAutoLookAt` Hook
  - [ ] 集成现有 `AutoLookAt`
  - [ ] 视线追踪
- [ ] 组合成完整的 `Character` 组件
  - [ ] 整合所有 Hooks
  - [ ] 统一 Props 接口

#### 阶段三：替换现有组件（第4-5周）
- [ ] 替换管理后台预览组件
  - [ ] `VRMPreviewR3F`
  - [ ] `VRMEditPreviewR3F`
  - [ ] `VRMUploadPreviewR3F`
  - [ ] `VRMMotionPreviewR3F`
  - [ ] Feature Flag 控制
- [ ] 替换角色编辑器组件
  - [ ] `VRMPreviewWithExpressionR3F`
  - [ ] 表情选择器集成
- [ ] 替换角色库组件
  - [ ] 更新 `CharacterLibrary`
- [ ] 保持旧版本共存
  - [ ] 版本选择器
  - [ ] 环境变量配置
  - [ ] 性能对比测试

#### 阶段四：迁移聊天界面（第6周）
- [ ] 创建 `ChatVRMViewerR3F` 组件
- [ ] 集成实时音频流
- [ ] 集成 TTS 播放
- [ ] 集成字幕显示
- [ ] 性能优化（目标：60fps）
- [ ] 压力测试

#### 阶段五：环境与沉浸感增强（第7-8周）
- [ ] HDRI 环境系统
  - [ ] 收集/购买 HDRI 贴图（白天、夜晚、室内、室外）
  - [ ] 创建 `EnvironmentSelector` 组件
  - [ ] 环境切换动画
  - [ ] 环境预设管理
- [ ] 动态摄像机系统
  - [ ] 创建 `useCameraAnimation` Hook
  - [ ] 情感驱动运镜（亲密、正常、思考模式）
  - [ ] 平滑过渡动画
  - [ ] 手动/自动切换
- [ ] 高级后处理特效
  - [ ] 景深效果（焦点跟随）
  - [ ] 辉光效果（高光增强）
  - [ ] 色调映射（电影级色彩）
  - [ ] 暗角效果
- [ ] 粒子特效系统（可选）
  - [ ] 环境粒子
  - [ ] 情感粒子
  - [ ] 天气效果

#### 阶段六：优化与清理（第9周）
- [ ] 性能优化
  - [ ] 模型 LOD
  - [ ] 纹理压缩
  - [ ] 阴影优化
  - [ ] 后处理优化
- [ ] 删除旧版本代码
- [ ] 更新文档
  - [ ] 组件使用文档
  - [ ] API 文档
  - [ ] 最佳实践
- [ ] 创建示例和教程

### 功能开发
- [ ] 角色编辑页面重构
  - [ ] 将模型和动作在一个界面管理
  - [x] 立绘上传修复
  - [ ] 表情也加入3D模型管理中
  - [x] AI模型选择和音色模型选择使用同样的带搜索下拉框
  - [x] 将模型选择和音色选择放在人设界面
- [ ] 资源配置界面优化
  - [x] 动作库：左边为模型预览，右边是动作列表（类似AI模型管理页面）
  - [ ] 3D形象顶部删除多余文字
  - [ ] 音色供应商显示优化：去除启用状态词条及其相关代码
- [ ] 设置页面优化
  - [ ] 更新UI设计
  - [ ] 去除保存按钮，改为实时更新
- [ ] VRM模式添加背景切换支持


### 代码优化
- [ ] 清除废弃代码
- [ ] 修复TypeScript类型错误（50+个）

