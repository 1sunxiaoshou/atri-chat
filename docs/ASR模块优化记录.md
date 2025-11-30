# ASR 模块优化记录

## 优化时间
2025-11-30

## 数据库清理
- 已清除数据库中所有旧的 ASR 配置数据
- 移除代码中的旧格式兼容逻辑
- 现在只支持新的元数据格式

## 优化内容

### 1. 数据库连接管理优化 (service.py)
- **问题**: 每次操作都创建新的数据库连接，影响性能
- **解决**: 添加 `_get_connection()` 上下文管理器，统一管理连接的创建和关闭
- **影响**: 所有数据库操作方法

### 2. 日志系统改进
- **问题**: 使用 `print()` 输出错误信息，不便于生产环境管理
- **解决**: 引入项目统一的 `logger`，使用 `logger.error()` 记录错误
- **影响**: service.py, factory.py

### 3. 移除旧格式兼容 (service.py, ASRSettings.tsx)
- **问题**: 代码中存在大量旧格式兼容逻辑，增加复杂度
- **解决**: 
  - 清除数据库中的旧配置数据
  - 移除 `_is_field_metadata()` 方法
  - 简化 `_extract_values`, `_merge_values`, `_mask_sensitive_fields`, `_validate_config` 方法
  - 前端移除旧格式渲染逻辑
  - 所有方法现在只处理元数据格式，遇到异常格式会记录警告
- **影响**: 代码更简洁，维护成本降低

### 4. 缓存失效机制 (factory.py)
- **问题**: 配置更新后缓存不会自动刷新，可能使用过期配置
- **解决**: 
  - 添加 `_config_versions` 字典跟踪配置版本
  - 在 `create_asr()` 中检测配置变化，自动清除过期缓存
  - 改进 `clear_cache()` 支持清除指定服务商或全部缓存
- **影响**: 确保配置变更后立即生效

### 5. 错误处理细化
- **问题**: 使用 `except Exception` 捕获所有异常，不够精确
- **解决**: 改为捕获具体异常类型如 `json.JSONDecodeError`
- **影响**: service.py 中的 JSON 解析相关代码

### 6. 临时文件清理 (funasr.py)
- **问题**: 异常时临时文件可能不会被删除
- **解决**: 在 `finally` 块中添加 `try-except` 确保删除操作不会抛出异常
- **影响**: `transcribe()` 方法

### 7. 文件句柄管理 (openai_whisper.py)
- **问题**: 文件打开后异常可能导致句柄泄漏
- **解决**: 
  - 对于文件路径输入，使用 `with` 语句自动管理文件句柄
  - 对于 bytes 输入，使用 `BytesIO` 无需手动关闭
- **影响**: `transcribe()` 和 `transcribe_async()` 方法

### 8. 类型提示改进 (base.py)
- **问题**: `get_config_template()` 返回类型不够精确
- **解决**: 添加 `ConfigField` TypedDict 定义配置字段结构
- **影响**: 提供更好的 IDE 提示和类型检查

### 9. 配置验证 (service.py)
- **问题**: 保存配置时没有验证必填字段和取值范围
- **解决**: 添加 `_validate_config()` 方法验证：
  - 必填字段检查
  - 数字类型的 min/max 范围检查
  - select 类型的选项值检查
- **影响**: `save_config()` 方法，提前发现配置错误

## 未优化项
- **测试连接实现不一致**: FunASR 只检查文件存在性，OpenAI 实际发送请求。保持现状，因为两者的测试场景不同。

## API 和前端更新

### API 路由更新 (api/routes/asr.py)
- 添加统一的 logger 日志记录
- 在关键操作点添加日志：配置保存、测试连接、语音转录
- 优化 `save_config` 使用 `clear_cache(provider_id)` 只清除指定服务商缓存
- 改进错误日志记录，便于问题排查

### 前端类型定义更新 (frontend/types.ts)
- 新增 `ASRConfigField` 接口，定义配置字段元数据结构
- 支持多种字段类型：string, password, number, select, file
- 包含完整的 UI 渲染信息：label, description, placeholder, options 等

### 前端组件更新 (frontend/components/ASRSettings.tsx)
- 重构 `renderFormFields()` 只支持元数据格式
- 移除旧格式兼容逻辑
- 根据字段类型渲染不同的输入控件：
  - select: 下拉选择框
  - number: 数字输入框（支持 min/max/step）
  - password/sensitive: 密码框（带显示/隐藏切换）
  - string: 文本输入框
- 显示字段描述和必填标记
- 添加 `extractValues()` 方法从元数据中提取实际值
- 更新 `handleInputChange()` 保持元数据结构
- 测试和保存时提取纯值发送到后端
- 遇到格式错误的字段会在控制台输出错误并跳过渲染

## 测试建议
1. 测试配置保存和加载流程
2. 测试配置变更后缓存自动刷新
3. 测试必填字段验证（前端显示 + 后端验证）
4. 测试不同字段类型的渲染和交互
5. 测试文件上传的 ASR 识别（验证文件句柄正确关闭）
6. 测试 bytes 数据的 ASR 识别（验证临时文件清理）
7. 测试 OpenAI Whisper 和 FunASR 两个服务商的配置和使用
8. 测试数值范围验证（temperature 0-1）
9. 测试选项验证（device 选择）
