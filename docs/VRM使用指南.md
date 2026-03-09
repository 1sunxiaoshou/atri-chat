# VRM 使用指南

## 核心概念

系统采用资产分离架构：Avatar（3D形象）、Motion（动作）、Character（角色）独立管理。

- **Avatar** - VRM 模型文件，可被多个角色引用
- **Motion** - VRMA 动画文件，可被多个角色绑定
- **Character** - 引用 Avatar + VoiceAsset，通过绑定关联 Motion
- **CharacterMotionBinding** - 角色-动作绑定，支持分类（idle/thinking/reply）

## API 端点

### Avatar
```
GET/POST/PUT/DELETE  /api/v1/avatars[/{id}]
POST                 /api/v1/avatars/upload  # 支持缩略图
```

### Motion
```
GET/POST/PUT/DELETE  /api/v1/motions[/{id}]
POST                 /api/v1/motions/upload
```

### 角色-动作绑定
```
GET     /api/v1/characters/{id}/motions
POST    /api/v1/character-motion-bindings[/batch]
PUT     /api/v1/character-motion-bindings/{id}
DELETE  /api/v1/character-motion-bindings/{id}
POST    /api/v1/characters/{id}/motions/batch-delete
```

## 前端组件

**AdminVRM** - `frontend/components/admin/vrm/AdminVRM.tsx`
- 管理 Avatar 和 Motion 资产（上传、编辑、删除）

**CharacterMotionBindings** - 角色动作绑定组件（待实现）
- 为角色绑定动作，按分类管理（idle/thinking/reply）

## 使用流程

### 1. 上传3D形象

1. 进入管理界面的"3D形象"标签
2. 点击"上传VRM"
3. 选择VRM文件和缩略图（可选）
4. 输入名称并保存

### 2. 上传动作

1. 进入管理界面的"动作库"标签
2. 点击"上传动作"
3. 选择VRMA文件
4. 填写名称、描述、持续时间和标签
5. 保存

### 3. 创建角色

1. 在角色管理界面创建角色
2. 选择一个Avatar（3D形象）
3. 选择一个VoiceAsset（音色）
4. 配置其他属性

### 4. 绑定动作

1. 进入角色编辑界面
2. 打开"动作绑定"面板
3. 选择分类（idle/thinking/reply）
4. 选择要绑定的动作
5. 保存

## 数据库表结构

### assets_avatars（3D形象表）

| 字段                  | 类型        | 说明                 |
| --------------------- | ----------- | -------------------- |
| id                    | String(36)  | UUID主键             |
| name                  | String(255) | 形象名称             |
| has_thumbnail         | Boolean     | 是否有缩略图         |
| available_expressions | Text        | 可用表情列表（JSON） |
| created_at            | DateTime    | 创建时间             |
| updated_at            | DateTime    | 更新时间             |

### assets_motions（动作表）

| 字段        | 类型        | 说明             |
| ----------- | ----------- | ---------------- |
| id          | String(36)  | UUID主键         |
| name        | String(255) | 动作名称         |
| duration_ms | Integer     | 持续时间（毫秒） |
| description | Text        | 描述             |
| tags        | JSON        | 标签列表         |
| created_at  | DateTime    | 创建时间         |
| updated_at  | DateTime    | 更新时间         |

### character_motion_bindings（绑定表）

| 字段         | 类型       | 说明                        |
| ------------ | ---------- | --------------------------- |
| id           | String(36) | UUID主键                    |
| character_id | String(36) | 角色ID                      |
| motion_id    | String(36) | 动作ID                      |
| category     | String(50) | 分类（idle/thinking/reply） |
| created_at   | DateTime   | 创建时间                    |

## 注意事项

1. **删除保护**：
   - 被角色引用的Avatar无法删除
   - 被角色绑定的Motion无法删除
   - 需要先解除引用/绑定关系

2. **文件格式**：
   - Avatar只支持`.vrm`格式
   - Motion只支持`.vrma`格式
   - 缩略图支持`.png`、`.jpg`、`.jpeg`格式

3. **分类说明**：
   - `idle`：待机动作，角色空闲时播放
   - `thinking`：思考动作，AI思考时播放
   - `reply`：回复动作，AI回复时播放

## 迁移说明

如果你的系统使用旧的VRM架构，需要进行数据迁移：

1. 旧的`vrm_models`表 → 新的`assets_avatars`表
2. 旧的`vrm_animations`表 → 新的`assets_motions`表
3. 旧的模型-动作关联 → 新的角色-动作绑定

详细迁移脚本请参考：`docs/MIGRATION_PLAN.md`

## 故障排查

### 问题1：上传失败

- 检查文件格式是否正确
- 检查文件大小是否超限
- 查看后端日志获取详细错误信息

### 问题2：删除失败

- 检查是否有角色正在引用该资产
- 查看错误提示中的引用列表
- 先解除引用关系再删除

### 问题3：动作不播放

- 检查角色是否绑定了该分类的动作
- 检查动作文件是否完整
- 查看浏览器控制台的错误信息

## 开发者信息

- 后端框架：FastAPI + SQLAlchemy
- 前端框架：React + TypeScript
- 3D渲染：Three.js + @pixiv/three-vrm
- 动画格式：VRMA (VRM Animation)

## 相关文档

- [数据库架构](./ARCHITECTURE_STATUS.md)
- [迁移计划](./MIGRATION_PLAN.md)
- [TTS架构](./TTS_ARCHITECTURE.md)
