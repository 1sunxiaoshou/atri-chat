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

- [x] **VRM 渲染系统升级到 React Three Fiber** ✅ 已完成 (2025-03-09)
  - 使用 R3F 重构 VRM 渲染系统，提升视觉表现力
  - 删除旧架构代码约 2,463 行，20 个文件
  - 文档：`docs/VRM-R3F-开发指南.md`、`docs/VRM-R3F-Hooks使用规范.md`、`docs/VRM-R3F-进阶技巧.md`
## 📋 待办事项

### 功能开发
- [ ] 角色编辑页面
  - [ ] 将模型和动作在一个界面管理
  - [x] 立绘上传修复
  - [ ] 实现角色编辑页面的动作预览功能
  - [x] AI模型选择和音色模型选择使用同样的组件
  - [x] 将模型选择和音色选择放在人设界面
- [ ] 资源配置界面优化
  - [x] 动作库：左边为模型预览，右边是动作列表
  - [ ] 3D形象顶部删除多余文字
  - [ ] 音色供应商显示优化：去除启用状态词条及其相关代码
- [ ] 设置页面优化
  - [ ] 更新UI设计
  - [ ] 去除保存按钮，改为实时更新
- [ ] VRM背景切换支持
- [ ] 运镜系统（待定）

### 可选优化
- [ ] 表情启用/禁用功能
  - [ ] 数据库：添加 `enabled_expressions` 字段（Avatar 或 Character 表）
  - [ ] 后端 API：添加更新启用表情列表的接口
  - [ ] 前端 UI：在 AssetsTab 表情列表中添加复选框
  - [ ] 提示词：仅将启用的表情传递给 AI
  - 说明：当前所有表情默认全部启用并传递给 AI

### 代码优化
- [ ] 清除废弃代码
- [ ] 修复TypeScript类型错误
- [ ] **API 架构迁移**：逐步迁移代码中还在使用标记废弃的api到新的模块化 API
- [ ] **引入全局状态管理（Zustand）**
  - [ ] 创建 stores（character、model、conversation、UI）
  - [ ] 重构 App.tsx，移除数据管理逻辑
  - [ ] 简化组件 props 传递
  - [ ] 优化数据同步机制
