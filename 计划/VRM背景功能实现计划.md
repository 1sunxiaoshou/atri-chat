# VRM 背景功能实现计划

## 功能概述

为 VRM 模块添加背景功能，让用户可以自定义背景，支持 AI 自动切换背景，提供沉浸式的对话体验。

---

## 核心设计

### 1. 数据关系

- **背景与角色**：多对多关系
- **背景库**：全局统一管理
- **会话背景**：每个会话独立记录当前背景

### 2. 三种背景模式

| 模式 | 英文标识 | 说明 | 可用背景来源 |
|------|---------|------|------------|
| 无背景 | `none` | 不显示背景图片 | 无 |
| 全部 | `all` | 使用所有全局背景 | 全局背景库 |
| 自定义 | `custom` | 使用已绑定的背景 | 角色绑定的背景 |

### 3. 背景切换方式

- **AI 自动切换**：通过 Function Call 调用 `switch_background` 工具
- **用户手动切换**：在 VRM 对话页面选择背景

### 4. 背景上下文

- 当前背景的名称和描述会加载到 AI 的上下文中
- AI 可以根据对话内容智能切换背景

---

## 数据库设计

### 1. 背景表（全局背景库）

```sql
CREATE TABLE vrm_backgrounds (
    background_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    description TEXT
);
```

**字段说明**：
- `background_id`：背景ID
- `name`：背景名称（不区分中英文，全局唯一）
- `filename`：文件名（不含路径）
- `description`：描述（可选，供 AI 理解）

### 2. 角色-背景绑定表（多对多）

```sql
CREATE TABLE character_backgrounds (
    character_id INTEGER NOT NULL,
    background_id TEXT NOT NULL,
    bind_order INTEGER DEFAULT 0,
    PRIMARY KEY (character_id, background_id),
    FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE,
    FOREIGN KEY (background_id) REFERENCES vrm_backgrounds(background_id) ON DELETE CASCADE
);
```

**字段说明**：
- `bind_order`：绑定顺序，用于确定"第一张"背景

### 3. 角色表扩展

```sql
ALTER TABLE characters ADD COLUMN background_mode TEXT DEFAULT 'all';
```

**字段说明**：
- `background_mode`：背景模式（`none` | `all` | `custom`）

### 4. 会话表扩展

```sql
ALTER TABLE conversations ADD COLUMN current_background_id TEXT;
```

**字段说明**：
- `current_background_id`：当前会话使用的背景ID

---

## 业务逻辑

### 1. 新建会话

**规则**：根据角色的背景模式，自动设置初始背景

- `none` 模式 → `current_background_id = NULL`
- `all` 模式 → 第一张全局背景
- `custom` 模式 → 第一张已绑定的背景（按 `bind_order` 排序）

### 2. 模式切换

**规则**：切换模式后，检查当前背景是否在新模式的可选范围内

- 如果不在 → 切换到新模式的第一张可用背景
- 如果在 → 保持不变

**影响范围**：该角色的所有会话

### 3. 背景删除

**规则**：删除背景前，处理使用该背景的会话

- 查找所有使用该背景的会话
- 将这些会话的背景切换到"第一张可用背景"
- 删除背景（级联删除绑定关系）

### 4. 背景解绑（custom 模式）

**规则**：解绑背景前，处理使用该背景的会话

- 查找该角色使用该背景的会话
- 将这些会话的背景切换到"第一张可用背景"
- 解除绑定关系

### 5. 背景切换

**AI 切换**：
1. AI 调用 `switch_background(background_name)` 工具
2. 验证背景是否在可用范围内
3. 更新 `conversations.current_background_id`
4. 返回切换结果

**用户切换**：
1. 用户在界面选择背景
2. 前端调用 API 切换背景
3. 更新 `conversations.current_background_id`

---

## 文件存储

### 目录结构

```
data/uploads/
└── vrm_backgrounds/
    ├── classroom_abc123.jpg
    ├── cafe_def456.png
    └── park_ghi789.jpg
```

### 命名规则

- 格式：`{name_slug}_{short_id}.{ext}`
- 与 VRM 模型、动画保持一致
- 支持格式：`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

### 文件限制

- 单个文件：5MB 以内
- 推荐尺寸：1920x1080 或 2560x1440

---

## API 设计

### 1. 背景管理 API

```
# 上传背景
POST /api/v1/vrm/backgrounds/upload
FormData: { file, name, description }

# 获取所有背景
GET /api/v1/vrm/backgrounds

# 获取背景详情
GET /api/v1/vrm/backgrounds/{background_id}

# 删除背景
DELETE /api/v1/vrm/backgrounds/{background_id}
```

### 2. 角色背景配置 API

```
# 更新角色背景模式
PUT /api/v1/characters/{character_id}
Body: { background_mode: "all" | "custom" | "none" }

# 绑定背景到角色（custom 模式）
POST /api/v1/characters/{character_id}/backgrounds
Body: { background_id }

# 获取角色已绑定的背景
GET /api/v1/characters/{character_id}/backgrounds

# 解绑背景
DELETE /api/v1/characters/{character_id}/backgrounds/{background_id}

# 批量绑定背景
POST /api/v1/characters/{character_id}/backgrounds/batch
Body: { background_ids: [] }
```

### 3. 会话背景 API

```
# 切换会话背景
POST /api/v1/conversations/{conversation_id}/background
Body: { background_id }

# 获取会话当前背景
GET /api/v1/conversations/{conversation_id}/background
```

---

## Function Call 工具

### 工具定义

```python
Tool: switch_background
Description: 切换VRM角色的场景背景
Parameters:
  - background_name (string): 背景名称
```

### 工具行为

1. 获取角色的可用背景列表
2. 根据名称查找背景
3. 验证背景是否可用
4. 更新会话的 `current_background_id`
5. 返回切换结果

### AI Prompt 示例

```
## 场景背景

当前场景：教室 - 明亮的学校教室

你可以使用 switch_background 工具切换场景。可用场景：
- 教室: 明亮的学校教室
- 咖啡厅: 温馨的咖啡店
- 公园: 户外公园

使用时机：
- 对话场景自然转移时
- 需要营造特定氛围时
- 用户明确提到某个地点时
```

---

## 前端实现

### 1. 背景管理页面

**功能**：
- 查看所有背景（卡片式展示）
- 上传新背景
- 删除背景
- 预览背景

### 2. 角色配置页面

**功能**：
- 选择背景模式（无背景/全部/自定义）
- custom 模式下：
  - 从背景库选择背景进行绑定
  - 查看已绑定的背景
  - 调整背景顺序
  - 解绑背景

### 3. VRM 对话页面

**功能**：
- 显示当前背景
- 手动切换背景（下拉选择）
- 监听 AI 的背景切换事件
- 背景切换动画效果

### 4. VRM 渲染

**实现**：
- 使用 Three.js 的 `scene.background` 加载背景图片
- 支持背景切换的淡入淡出动画
- 背景图片自适应缩放

---

## 实现步骤

### 阶段一：数据库和后端基础

1. 创建数据库表和索引
2. 实现 Storage 层方法
3. 实现文件上传和路径管理
4. 实现背景管理 API

### 阶段二：角色背景配置

1. 实现角色背景模式配置
2. 实现角色-背景绑定 API
3. 实现模式切换逻辑
4. 实现背景删除/解绑的级联处理

### 阶段三：会话背景

1. 扩展会话表
2. 实现会话背景初始化逻辑
3. 实现会话背景切换 API
4. 实现背景上下文构建

### 阶段四：AI 集成

1. 实现 `switch_background` Function Call 工具
2. 将工具注册到 Agent
3. 构建背景相关的 AI Prompt
4. 实现背景切换事件的流式返回

### 阶段五：前端实现

1. 实现背景管理页面
2. 实现角色配置页面的背景设置
3. 实现 VRM 对话页面的背景显示和切换
4. 实现背景切换动画效果

### 阶段六：测试和优化

1. 单元测试（Storage 层）
2. API 测试
3. 边界情况测试（删除、解绑、模式切换）
4. 性能优化（图片加载、缓存）
5. 用户体验优化

---

## 注意事项

### 1. 数据一致性

- 背景删除时，必须先处理引用该背景的会话
- 背景解绑时，必须先处理引用该背景的会话
- 模式切换时，必须更新所有相关会话的背景

### 2. 性能优化

- 背景图片压缩和优化
- 前端背景图片缓存
- 懒加载背景列表

### 3. 用户体验

- 提供清晰的错误提示
- 背景切换动画流畅
- 支持背景预览
- 支持背景搜索和筛选

### 4. 安全性

- 验证上传文件类型和大小
- 防止路径遍历攻击
- 限制上传频率

---
