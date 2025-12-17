# 实施计划 - 前端代码优化

## 任务列表

- [x] 1. 优化类型定义系统




- [x] 1.1 统一实体类型字段命名


  - 修改 types.ts，移除 Message、Model、Character 等类型的兼容字段（id、role 等）
  - 确保所有字段名与后端 API 一致
  - _需求: 2.1, 2.2, 6.1, 6.2, 6.3, 6.5_

- [x] 1.2 修复代码中的类型引用


  - 全局搜索并替换 `message.id` 为 `message.message_id`
  - 全局搜索并替换 `message.role` 为 `message.message_type`
  - 全局搜索并替换 `model.id` 为 `model.model_id`
  - 全局搜索并替换 `character.id` 为 `character.character_id`
  - 移除 helpers.ts 中的兼容性辅助函数
  - _需求: 6.1, 6.2, 6.3, 6.5_

- [x] 1.3 验证类型正确性



  - 运行 TypeScript 编译检查，确保无类型错误
  - **属性 7: TypeScript 编译无错误**
  - **验证: 需求 2.3**

- [x] 2. 重构 API 服务层





- [x] 2.1 创建基础 HTTP 客户端


  - 创建 services/api/base.ts
  - 实现 HttpClient 类，封装 fetch 请求
  - 实现统一的错误处理和响应处理
  - _需求: 10.1, 10.3_

- [x] 2.2 按业务领域拆分 API


  - 创建 services/api/providers.ts - Provider 相关 API
  - 创建 services/api/models.ts - Model 相关 API
  - 创建 services/api/characters.ts - Character 相关 API
  - 创建 services/api/conversations.ts - Conversation 相关 API
  - 创建 services/api/messages.ts - Message 相关 API
  - 创建 services/api/vrm.ts - VRM 相关 API
  - 创建 services/api/index.ts - 统一导出
  - _需求: 10.4_


- [x] 2.3 迁移现有 API 调用

  - 将 api.ts 中的方法迁移到对应的模块文件
  - 更新所有组件和 Hook 中的 API 导入路径
  - 删除旧的 api.ts 文件
  - _需求: 3.2, 10.4_

- [x] 2.4 验证 API 层重构





  - **属性 16: API 调用通过 service 层**
  - **属性 28: URL 构建统一**
  - **属性 29: API 响应处理统一**
  - **验证: 需求 5.4, 10.1, 10.2, 10.3**

- [x] 3. 创建专用 Hooks




- [x] 3.1 创建 useVRM Hook


  - 创建 hooks/useVRM.ts
  - 封装 VRM 模型加载、动画播放逻辑
  - 管理 VRM 相关的 refs 和状态
  - _需求: 7.1, 7.2, 7.3, 9.4_

- [x] 3.2 创建 useTTS Hook


  - 创建 hooks/useTTS.ts
  - 封装 TTS 播放、停止逻辑
  - 管理播放状态和播放器实例
  - _需求: 7.1, 7.2, 7.3, 9.4_

- [x] 3.3 创建 useAudioRecorder Hook




  - 创建 hooks/useAudioRecorder.ts
  - 封装录音开始、停止、转录逻辑
  - 管理录音状态和 MediaRecorder 实例
  - _需求: 7.1, 7.2, 7.3, 9.4_

- [ ]* 3.4 验证 Hook 实现质量
  - **属性 17: Hook 副作用正确管理**
  - **属性 18: Hook 返回函数使用 useCallback**
  - **属性 19: Hook 依赖数组完整**
  - **验证: 需求 7.1, 7.2, 7.3**

- [x] 4. 优化 useChat Hook




- [x] 4.1 简化 useChat 实现


  - 移除 VRM、TTS、录音相关逻辑（已提取到专用 Hook）
  - 优化消息加载和发送逻辑
  - 确保所有依赖正确声明
  - 移除未使用的参数和变量
  - _需求: 6.4, 7.3, 9.2_

- [ ]* 4.2 验证 useChat 优化
  - **属性 10: 无未使用的代码**
  - **属性 20: Hook 大小合理**
  - **验证: 需求 3.2, 6.4, 7.4**

- [x] 5. 拆分 ChatInterface 组件





- [x] 5.1 创建 MessageList 组件


  - 创建 components/chat/MessageList.tsx
  - 负责渲染消息列表和滚动管理
  - _需求: 1.2, 9.1, 9.2_

- [x] 5.2 创建 MessageItem 组件


  - 创建 components/chat/MessageItem.tsx
  - 负责渲染单条消息、思维链、操作按钮
  - _需求: 1.2, 9.1, 9.2_

- [x] 5.3 创建 ChatInput 组件


  - 创建 components/chat/ChatInput.tsx
  - 负责输入框、录音按钮、发送按钮
  - 使用 useAudioRecorder Hook
  - _需求: 1.2, 9.1, 9.2_

- [x] 5.4 创建 VRMViewer 组件


  - 创建 components/chat/VRMViewer.tsx
  - 负责 VRM 模型渲染和字幕显示
  - 使用 useVRM Hook
  - _需求: 1.2, 9.1, 9.2_

- [x] 5.5 创建 ChatHeader 组件


  - 创建 components/chat/ChatHeader.tsx
  - 负责头部信息、模型选择、显示模式切换
  - _需求: 1.2, 9.1, 9.2_

- [x] 5.6 重构 ChatInterface 主组件


  - 简化 ChatInterface.tsx，使用新创建的子组件
  - 使用 useChat、useVRM、useTTS Hook
  - 移除冗余代码和状态
  - _需求: 1.2, 9.1, 9.2_

- [ ]* 5.7 验证组件拆分效果
  - **属性 2: 文件大小符合单一职责原则**
  - **属性 25: 组件大小合理**
  - **属性 26: 组件职责单一**
  - **验证: 需求 1.2, 9.1, 9.2**

- [x] 6. 优化常量和配置管理





- [x] 6.1 扩展 constants.ts


  - 添加缺失的常量定义（如消息 ID 偏移量）
  - 整理现有常量，按类别分组
  - _需求: 3.3, 4.4_


- [x] 6.2 消除魔法数字和硬编码

  - 搜索代码中的数字字面量，替换为具名常量
  - 搜索硬编码的 URL 和路径，替换为配置
  - _需求: 4.4, 5.1_

- [ ]* 6.3 验证常量管理
  - **属性 11: 常量集中管理**
  - **属性 13: 无魔法数字**
  - **属性 14: 配置化而非硬编码**
  - **验证: 需求 3.3, 4.4, 5.1**

- [x] 7. 创建日志工具





- [x] 7.1 实现 Logger 类


  - 创建 utils/logger.ts
  - 实现不同级别的日志方法（debug、info、warn、error）
  - 支持开发/生产环境的日志控制
  - _需求: 8.3_

- [x] 7.2 替换 console.log


  - 全局搜索 console.log，替换为 Logger 调用
  - 移除调试用的 console.log
  - _需求: 3.2, 8.3_

- [ ]* 7.3 验证日志工具
  - **属性 23: 使用统一日志工具**
  - **验证: 需求 8.3**


- [x] 8. 统一错误处理




- [x] 8.1 创建错误类型定义

  - 在 types.ts 中添加 ErrorType 和 AppError 类型
  - _需求: 2.1, 8.1_

- [x] 8.2 在 HttpClient 中实现错误处理


  - 捕获网络错误并分类
  - 返回标准化的错误响应
  - _需求: 8.1, 8.2_

- [x] 8.3 在 Hooks 中实现错误处理


  - 在 useChat、useVRM、useTTS 等 Hook 中添加错误状态
  - 提供错误信息给组件
  - _需求: 8.1, 8.2_

- [x] 8.4 在组件中显示错误提示


  - 使用 Toast 组件显示错误信息
  - 确保错误信息使用中文
  - _需求: 8.1, 8.4_

- [ ]* 8.5 验证错误处理
  - **属性 21: API 错误被捕获**
  - **属性 22: 错误处理集中管理**
  - **属性 24: 错误信息国际化**
  - **验证: 需求 8.1, 8.2, 8.4**

- [x] 9. 代码清理和优化






- [x] 9.1 移除未使用的代码

  - 运行 ESLint 检查未使用的变量、函数、导入
  - 删除未使用的代码
  - _需求: 3.2, 6.4_

- [x] 9.2 优化命名规范


  - 检查并修正不符合 camelCase 的命名
  - 确保函数名清晰表达其作用
  - _需求: 4.1, 4.3_


- [x] 9.3 添加必要注释

  - 为复杂逻辑添加注释说明
  - 为公共函数添加 JSDoc 注释
  - _需求: 4.2_

- [ ]* 9.4 验证代码质量
  - **属性 10: 无未使用的代码**
  - **属性 12: 命名符合 camelCase 规范**
  - **验证: 需求 3.2, 4.1, 6.4**


- [x] 10. 配置代码质量工具



- [x] 10.1 配置 ESLint 规则


  - 更新 .eslintrc.js，添加严格的规则
  - 包括 no-unused-vars、no-console、no-magic-numbers 等
  - _需求: 2.4, 3.2, 4.4_

- [x] 10.2 配置 TypeScript 严格模式


  - 更新 tsconfig.json，启用严格模式
  - 启用 noUnusedLocals、noUnusedParameters 等选项
  - _需求: 2.3, 2.4, 3.2_

- [ ]* 10.3 运行代码质量检查
  - 运行 `npm run lint` 确保无 ESLint 错误
  - 运行 `npm run type-check` 确保无类型错误
  - **属性 7: TypeScript 编译无错误**
  - **属性 8: 避免使用 any 类型**
  - **验证: 需求 2.3, 2.4**

- [x] 11. 最终验证和文档






- [x] 11.1 运行完整测试套件

  - 确保所有单元测试通过
  - 确保所有集成测试通过
  - 检查测试覆盖率是否达标

- [x] 11.2 更新项目文档


  - 更新 README.md，说明新的项目结构
  - 添加代码规范文档
  - 添加开发指南



- [ ] 11.3 代码审查
  - 检查所有修改的文件
  - 确保符合设计文档的要求
  - 确保所有正确性属性得到验证
