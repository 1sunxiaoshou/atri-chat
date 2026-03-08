# VRM 动作系统 API 接口规范

## 概述

本文档定义了 VRM 动作系统的前后端接口规范，包括动作分类、数据结构和 API 端点。

## 动作分类（Motion Categories）

新架构支持 4 种动作分类：

| 分类     | 英文       | 说明               | 触发时机          | 循环播放               |
| -------- | ---------- | ------------------ | ----------------- | ---------------------- |
| 初始动作 | `initial`  | AI加载时的默认姿态 | VRM模型加载完成后 | 是                     |
| 闲置动作 | `idle`     | 长时间未交互时触发 | 15秒无交互后      | 否（播放完回到初始）   |
| 思考动作 | `thinking` | 等待AI响应时播放   | 用户发送消息后    | 否（循环直到收到响应） |
| 回复动作 | `reply`    | AI回复时播放       | 由AI标记控制      | 否                     |

## 数据结构

### 1. Motion（动作资产）

```typescript
interface Motion {
  id: string;                    // UUID
  name: string;                  // 动作名称
  file_url: string;              // 文件URL（如：/uploads/vrm_animations/{id}.vrma）
  duration_ms: number;           // 动作时长（毫秒）
  description?: string;          // 描述
  tags?: string[];               // 标签
  created_at: string;            // 创建时间
  updated_at: string;            // 更新时间
}
```

### 2. CharacterMotionBinding（角色-动作绑定）

```typescript
interface CharacterMotionBinding {
  id: string;                    // 绑定ID（UUID）
  character_id: string;          // 角色ID
  character_name: string;        // 角色名称（仅响应）
  motion_id: string;             // 动作ID
  motion_name: string;           // 动作名称（仅响应）
  motion_file_url: string;       // 动作文件URL（仅响应）
  motion_duration_ms: number;    // 动作时长（仅响应）
  category: 'initial' | 'idle' | 'thinking' | 'reply';  // 分类
  weight: number;                // 权重（用于随机选择，默认1.0）
  created_at: string;            // 创建时间
}
```

### 3. CharacterMotionBindings（按分类分组的绑定）

```typescript
interface CharacterMotionBindings {
  character_id: string;
  character_name: string;
  bindings_by_category: {
    initial?: CharacterMotionBinding[];
    idle?: CharacterMotionBinding[];
    thinking?: CharacterMotionBinding[];
    reply?: CharacterMotionBinding[];
  };
  total_bindings: number;
}
```

## API 端点

### 1. 获取所有绑定

**端点**: `GET /api/v1/character-motion-bindings`

**查询参数**:
- `skip`: 跳过数量（分页）
- `limit`: 返回数量（分页）
- `character_id`: 按角色ID过滤
- `motion_id`: 按动作ID过滤
- `category`: 按分类过滤

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": "uuid",
      "character_id": "uuid",
      "character_name": "角色名",
      "motion_id": "uuid",
      "motion_name": "动作名",
      "category": "idle",
      "weight": 1.0,
      "created_at": "2024-01-01T00:00:00"
    }
  ]
}
```

### 2. 获取角色的所有动作（按分类分组）

**端点**: `GET /api/v1/characters/{character_id}/motions`

**查询参数**:
- `category`: 按分类过滤（可选）

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "character_id": "uuid",
    "character_name": "角色名",
    "bindings_by_category": {
      "initial": [
        {
          "binding_id": "uuid",
          "motion_id": "uuid",
          "motion_name": "默认姿态",
          "motion_file_url": "/uploads/vrm_animations/xxx.vrma",
          "motion_duration_ms": 3000,
          "weight": 1.0,
          "created_at": "2024-01-01T00:00:00"
        }
      ],
      "idle": [...],
      "thinking": [...],
      "reply": [...]
    },
    "total_bindings": 10
  }
}
```

### 3. 创建绑定

**端点**: `POST /api/v1/character-motion-bindings`

**请求体**:
```json
{
  "character_id": "uuid",
  "motion_id": "uuid",
  "category": "idle",
  "weight": 1.0
}
```

**响应**:
```json
{
  "code": 200,
  "message": "绑定创建成功",
  "data": {
    "id": "uuid",
    "character_id": "uuid",
    "motion_id": "uuid",
    "category": "idle",
    "weight": 1.0,
    "created_at": "2024-01-01T00:00:00"
  }
}
```

### 4. 批量创建绑定

**端点**: `POST /api/v1/character-motion-bindings/batch`

**请求体**:
```json
{
  "character_id": "uuid",
  "motion_ids": ["uuid1", "uuid2", "uuid3"],
  "category": "idle",
  "weight": 1.0
}
```

**响应**:
```json
{
  "code": 200,
  "message": "成功创建 3 个绑定，跳过 0 个已存在的绑定",
  "data": {
    "created_count": 3,
    "skipped_count": 0,
    "total_count": 3
  }
}
```

### 5. 更新绑定

**端点**: `PUT /api/v1/character-motion-bindings/{binding_id}`

**请求体**:
```json
{
  "category": "thinking",
  "weight": 2.0
}
```

**响应**:
```json
{
  "code": 200,
  "message": "绑定更新成功",
  "data": {
    "id": "uuid",
    "character_id": "uuid",
    "motion_id": "uuid",
    "category": "thinking",
    "weight": 2.0,
    "created_at": "2024-01-01T00:00:00"
  }
}
```

### 6. 删除绑定

**端点**: `DELETE /api/v1/character-motion-bindings/{binding_id}`

**响应**:
```json
{
  "code": 200,
  "message": "绑定删除成功",
  "data": null
}
```

### 7. 批量删除角色的动作绑定

**端点**: `POST /api/v1/characters/{character_id}/motions/batch-delete`

**查询参数**:
- `category`: 按分类过滤（可选）

**请求体**:
```json
["motion_id1", "motion_id2", "motion_id3"]
```

**响应**:
```json
{
  "code": 200,
  "message": "成功删除 3 个绑定",
  "data": {
    "deleted_count": 3,
    "total_count": 3
  }
}
```

## 前端 API 服务

### 位置
- `frontend/services/api/motions.ts` - 动作资产和绑定API

### 使用示例

```typescript
import { api } from '@/services/api';

// 获取角色的动作绑定（按分类分组）
const response = await api.getCharacterMotionBindings(characterId);
if (response.code === 200) {
  const bindings = response.data;
  console.log('初始动作:', bindings.bindings_by_category.initial);
  console.log('闲置动作:', bindings.bindings_by_category.idle);
  console.log('思考动作:', bindings.bindings_by_category.thinking);
  console.log('回复动作:', bindings.bindings_by_category.reply);
}

// 创建绑定
await api.createMotionBinding({
  character_id: 'uuid',
  motion_id: 'uuid',
  category: 'idle',
  weight: 1.0
});

// 更新绑定
await api.updateMotionBinding('binding_id', {
  category: 'thinking',
  weight: 2.0
});

// 删除绑定
await api.deleteMotionBinding('binding_id');
```

## 动作播放流程

### 1. 初始化流程

```
加载VRM模型
  ↓
加载角色动作绑定（GET /characters/{id}/motions）
  ↓
设置初始动作URL（从 initial 分类中选择）
  ↓
播放初始动作（循环）
  ↓
启动闲置计时器（15秒）
```

### 2. 用户交互流程

```
用户发送消息
  ↓
停止闲置计时器
  ↓
播放思考动作（从 thinking 分类中随机选择）
  ↓
收到AI响应
  ↓
停止思考动作
  ↓
播放回复动作（由AI标记控制，从 reply 分类中选择）
  ↓
回复完成
  ↓
回到初始动作
  ↓
重置闲置计时器
```

### 3. 闲置流程

```
15秒无交互
  ↓
触发闲置状态
  ↓
播放闲置动作（从 idle 分类中随机选择）
  ↓
动作播放完成
  ↓
回到初始动作
  ↓
重置闲置计时器
```

## 权重系统

每个绑定都有一个 `weight` 字段，用于随机选择动作时的权重计算：

```typescript
// 权重随机选择算法
function selectRandomMotion(bindings: CharacterMotionBinding[]): string {
  const totalWeight = bindings.reduce((sum, b) => sum + b.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const binding of bindings) {
    random -= binding.weight;
    if (random <= 0) {
      return binding.motion_name;
    }
  }
  
  return bindings[0].motion_name; // 降级
}
```

**示例**:
- 动作A: weight = 1.0 (33.3% 概率)
- 动作B: weight = 1.0 (33.3% 概率)
- 动作C: weight = 1.0 (33.3% 概率)

或者：
- 动作A: weight = 2.0 (50% 概率)
- 动作B: weight = 1.0 (25% 概率)
- 动作C: weight = 1.0 (25% 概率)

## 约束和验证

### 后端约束

1. **唯一性约束**: 同一角色不能在同一分类下重复绑定同一动作
   - 数据库约束: `UniqueConstraint("character_id", "motion_id", "category")`

2. **外键约束**:
   - `character_id` → `characters.id` (CASCADE DELETE)
   - `motion_id` → `assets_motions.id` (RESTRICT DELETE)

3. **权重验证**: `weight >= 0.0`

### 前端验证

1. 创建绑定前检查是否已存在
2. 分类必须是 `'initial' | 'idle' | 'thinking' | 'reply'` 之一
3. 权重必须为非负数

## 错误处理

### 常见错误码

- `400`: 请求参数错误（如重复绑定、无效分类）
- `404`: 资源不存在（角色、动作或绑定不存在）
- `500`: 服务器内部错误

### 错误响应示例

```json
{
  "code": 400,
  "message": "该动作已在此分类下绑定到角色",
  "data": null
}
```

## 迁移指南

### 从旧架构迁移

旧架构只有 `idle` 和 `reply` 两种分类，迁移步骤：

1. 将旧的 `idle` 分类动作迁移到 `initial` 分类（作为默认姿态）
2. 为每个角色添加新的 `idle` 和 `thinking` 分类动作
3. 更新前端代码，使用新的动作流程

### 数据库迁移

```sql
-- 添加 initial 分类的动作绑定
INSERT INTO character_motion_bindings (id, character_id, motion_id, category, weight)
SELECT 
  gen_random_uuid(),
  character_id,
  motion_id,
  'initial',
  weight
FROM character_motion_bindings
WHERE category = 'idle'
LIMIT 1; -- 每个角色只保留一个初始动作
```

## 测试建议

### 单元测试

1. 测试权重随机选择算法
2. 测试动作流程状态机
3. 测试API请求和响应格式

### 集成测试

1. 测试完整的动作播放流程
2. 测试闲置计时器触发
3. 测试思考动作切换
4. 测试动作绑定的CRUD操作

### E2E测试

1. 加载VRM模型并验证初始动作播放
2. 发送消息并验证思考动作触发
3. 等待15秒并验证闲置动作触发
4. 验证动作播放完成后回到初始状态
