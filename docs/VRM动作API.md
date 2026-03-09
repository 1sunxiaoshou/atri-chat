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

## 前端实现细节

### 动作查找函数

位置：`frontend/hooks/useVRM.ts`

```typescript
/**
 * 根据动作名称从 reply 分类中查找动作 URL
 * 只从 reply 分类搜索（不区分大小写，支持模糊匹配）
 */
async function findMotionByName(
  bindingsRef: React.MutableRefObject<CharacterMotionBindings | null>,
  motionName: string
): Promise<string | null> {
  if (!bindingsRef.current) {
    return null;
  }

  const normalizedName = motionName.toLowerCase().trim();

  // 只从 reply 分类中查找
  const bindings = bindingsRef.current.reply;
  if (!bindings || bindings.length === 0) {
    console.warn(`[useVRM] No reply motions available for character`);
    return null;
  }

  // 1. 精确匹配（优先级最高）
  const exactMatch = bindings.find(
    (b: any) => b.motion_name?.toLowerCase() === normalizedName
  );
  if (exactMatch?.motion_file_url) {
    console.log(`[useVRM] Found exact match for motion: ${motionName}`);
    return buildResourceUrl(exactMatch.motion_file_url);
  }

  // 2. 包含匹配（模糊匹配）
  const partialMatch = bindings.find(
    (b: any) => b.motion_name?.toLowerCase().includes(normalizedName)
  );
  if (partialMatch?.motion_file_url) {
    console.log(`[useVRM] Found partial match for motion: ${motionName} -> ${partialMatch.motion_name}`);
    return buildResourceUrl(partialMatch.motion_file_url);
  }

  // 找不到匹配的动作
  console.warn(`[useVRM] Motion not found in reply category: ${motionName}`);
  return null;
}
```

### 动作标记处理逻辑

```typescript
// 在 playNextSegment 函数中
for (const markup of markups) {
  if (markup.type === 'state') {
    // 情感 → 表情
    setExpression(markup.value.toLowerCase());
  } else if (markup.type === 'action') {
    // 动作标记处理
    if (character?.id) {
      const actionValue = markup.value.toLowerCase();

      // 检查是否是动作分类标记（idle/thinking/reply）
      const actionCategories = ['idle', 'thinking', 'reply'];

      if (actionCategories.includes(actionValue)) {
        // 分类标记：从该分类中随机选择动作
        const motionUrl = await getCharacterMotionUrl(
          motionBindingsRef,
          character.id,
          actionValue as 'idle' | 'thinking' | 'reply',
          true  // 随机选择
        );
        if (motionUrl) {
          setMotionUrl(motionUrl);
        }
      } else {
        // 具体动作名称：从 reply 分类中查找匹配的动作
        const motionUrl = await findMotionByName(motionBindingsRef, actionValue);
        if (motionUrl) {
          setMotionUrl(motionUrl);
        }
        // 找不到时不播放，已在 findMotionByName 中打印日志
      }
    }
  }
}
```

### 缓存机制

动作绑定在角色加载时一次性获取并缓存：

```typescript
// 在 loadModel 函数中
if (characterId) {
  const response = await motionBindingsApi.getCharacterBindings(characterId);
  if (response.code === 200 && response.data) {
    // 缓存所有分类的动作绑定
    motionBindingsRef.current = response.data.bindings_by_category;
    
    // 加载初始动作
    const initialMotionUrl = await getCharacterMotionUrl(
      motionBindingsRef, 
      characterId, 
      'initial', 
      true
    );
    setMotionUrl(initialMotionUrl);
  }
}
```

**优势**：
- 避免每次播放都请求 API
- 支持离线查找（从缓存中查找）
- 提高响应速度

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

## 动作标记系统

AI 可以通过在文本中嵌入标记来控制 VRM 的动作和表情：

### 标记语法

```
[state:表情名称]  - 控制表情
[action:动作标识] - 控制动作
```

### 表情标记

```typescript
// 支持的表情
[state:neutral]  // 中性
[state:happy]    // 开心
[state:sad]      // 悲伤
[state:angry]    // 生气
[state:surprised] // 惊讶
```

### 动作标记

动作标记支持两种模式：

#### 1. 分类标记（随机选择）

从指定分类中随机选择一个动作：

```typescript
[action:idle]     // 从 idle 分类中随机选择
[action:thinking] // 从 thinking 分类中随机选择
[action:reply]    // 从 reply 分类中随机选择
```

#### 2. 具体动作标记（精确匹配）

指定具体的动作名称，**仅从 reply 分类中查找**：

```typescript
[action:wave]     // 播放 reply 分类中名为 "wave" 的动作
[action:nod]      // 播放 reply 分类中名为 "nod" 的动作
[action:clap]     // 播放 reply 分类中名为 "clap" 的动作
```

**匹配规则**：
1. **精确匹配**（优先）：动作名称完全匹配（不区分大小写）
2. **模糊匹配**（降级）：动作名称包含指定文本
3. **找不到时**：不播放动作，仅在控制台打印警告日志

**搜索范围**：仅从 reply 分类中搜索

**注意**：如果动作不存在或名称错误，不会有降级策略，直接跳过该动作标记。

### 标记示例

```typescript
// AI 输出示例
"你好[state:happy][action:wave]，很高兴见到你！"
// 效果：显示开心表情 + 播放 reply 分类中的 wave 动作（如果存在）

"让我想想[state:neutral][action:thinking]..."
// 效果：显示中性表情 + 从 thinking 分类随机选择动作

"没错[action:nod]，就是这样！"
// 效果：播放 reply 分类中的 nod 动作（如果存在）

"太棒了[state:happy][action:clap]！"
// 效果：显示开心表情 + 播放 reply 分类中的 clap 动作（如果存在）

"[action:dance]来跳个舞吧！"
// 如果 reply 分类中没有 dance 动作，则不播放，仅显示字幕
```

### 最佳实践

1. **动作命名规范**：使用简短、语义明确的英文名称
   - ✅ 好的命名：`wave`, `nod`, `clap`, `bow`, `think`
   - ❌ 不好的命名：`动作1`, `motion_v2_final`, `test123`

2. **AI 提示词建议**：在系统提示词中告知 AI 可用的动作名称
   ```
   可用动作：wave（挥手）、nod（点头）、clap（鼓掌）、bow（鞠躬）
   使用方式：[action:wave]
   ```

3. **容错处理**：即使动作不存在，也不会影响对话流程
   - 字幕正常显示
   - 音频正常播放
   - 仅动作不播放

4. **调试技巧**：查看浏览器控制台日志
   ```javascript
   // 过滤 VRM 相关日志
   console.log 中搜索 "[useVRM]"
   ```

## 动作播放流程

### 1. 初始化流程

```
加载VRM模型
  ↓
加载角色动作绑定（GET /characters/{id}/motions）
  ↓
缓存所有分类的动作绑定
  ↓
设置初始动作URL（从 initial 分类中随机选择）
  ↓
播放初始动作（循环）
  ↓
记录动作切换时间
  ↓
启动闲置计时器（12秒 ±3秒）
```

### 2. 用户交互流程

```
用户发送消息
  ↓
停止闲置计时器
  ↓
播放思考动作（从 thinking 分类中随机选择）
  ↓
记录动作切换时间
  ↓
收到AI响应（包含标记文本）
  ↓
停止思考动作
  ↓
解析标记文本
  ├─ [state:happy] → 设置表情
  ├─ [action:wave] → 查找并播放动作，记录切换时间
  └─ 纯文本 → 显示字幕
  ↓
播放音频 + 同步口型
  ↓
回复完成
  ↓
回到初始动作（从 initial 分类中随机选择）
  ↓
记录动作切换时间
  ↓
重新启动闲置计时器（12秒 ±3秒）
```

### 3. 闲置流程

```
角色处于 initial 动作状态
  ↓
启动闲置计时器（12秒 ±3秒 = 9-15秒随机）
  ↓
计时器到期时检查条件：
  1. 当前是否为 initial 动作？
  2. 距离上次动作切换是否超过计时器时间？
  ↓
条件满足 → 触发闲置动作
  ↓
从 idle 分类中随机选择一个动作播放
  ↓
动作播放完成（idle 动作不循环）
  ↓
保持在 idle 状态（不会自动回到 initial）
```

**注意**：
- 闲置计时器仅在 initial 状态下运行
- 用户交互（发送消息）会停止计时器
- AI 回复完成后回到 initial 状态，重新启动计时器
- 每次计时器的延迟时间都是随机的（9-15秒）

### 4. 动作查找流程

```
解析到 [action:xxx]
  ↓
检查是否是分类标记（idle/thinking/reply）
  ├─ 是 → 从该分类中随机选择动作
  └─ 否 → 执行具体动作查找
      ↓
      仅从 reply 分类中查找
      ↓
      1. 精确匹配：motion_name == "xxx"（不区分大小写）
         ├─ 找到 → 播放该动作
         └─ 未找到 → 继续
      ↓
      2. 模糊匹配：motion_name.includes("xxx")
         ├─ 找到 → 播放该动作
         └─ 未找到 → 继续
      ↓
      3. 找不到 → 打印警告日志，不播放动作
```

**日志示例**：

```typescript
// 找到精确匹配
[useVRM] Found exact match for motion: wave

// 找到模糊匹配
[useVRM] Found partial match for motion: wave -> wave_hello

// 找不到动作
[useVRM] Motion not found in reply category: dance

// reply 分类为空
[useVRM] No reply motions available for character

// 闲置计时器触发
[useVRM] Idle timer triggered, playing idle motion
```

## 闲置计时器机制

### 触发条件

闲置动作的触发需要同时满足两个条件：

1. **当前动作状态为 initial**
   - 只有在初始动作状态下才会触发闲置
   - thinking、reply、idle 状态下不会触发

2. **距离上次动作切换的时间超过计时器延迟**
   - 防止动作刚切换就立即触发闲置
   - 确保动作有足够的播放时间

### 计时器参数

- **基础延迟**：12秒
- **随机波动**：±3秒
- **实际延迟范围**：9-15秒
- **每次重启都会重新随机**

### 计时器生命周期

```typescript
// 启动时机
1. VRM 模型加载完成，播放 initial 动作后
2. AI 回复完成，回到 initial 动作后

// 停止时机
1. 用户发送消息（进入 thinking 状态）
2. 开始播放 AI 回复（进入 reply 状态）
3. 组件卸载

// 重置时机
每次启动时都会生成新的随机延迟
```

### 实现细节

```typescript
// 计算随机延迟
const baseDelay = 12000; // 12秒
const randomOffset = (Math.random() * 6000) - 3000; // ±3秒
const delay = baseDelay + randomOffset; // 9000-15000ms

// 检查触发条件
if (
  currentMotionCategoryRef.current === 'initial' &&
  Date.now() - lastMotionChangeTimeRef.current >= delay
) {
  // 触发闲置动作
}
```

### 状态追踪

系统使用以下 ref 追踪动作状态：

- `currentMotionCategoryRef`：当前动作分类（initial/idle/thinking/reply）
- `lastMotionChangeTimeRef`：上次动作切换的时间戳
- `idleTimerRef`：计时器引用

每次动作切换时都会更新这些状态。

## 动作选择机制

当一个分类中有多个动作时，系统会随机选择一个播放：

```typescript
// 随机选择算法
function selectMotion(bindings: CharacterMotionBinding[]): CharacterMotionBinding {
  const randomIndex = Math.floor(Math.random() * bindings.length);
  return bindings[randomIndex];
}
```

**示例**：
- 如果 idle 分类有 3 个动作：stretch、yawn、look_around
- 每次触发闲置状态时，会随机选择其中一个播放
- 每个动作被选中的概率相等（33.3%）

## 约束和验证

### 后端约束

1. **唯一性约束**: 同一角色不能在同一分类下重复绑定同一动作
   - 数据库约束: `UniqueConstraint("character_id", "motion_id", "category")`

2. **外键约束**:
   - `character_id` → `characters.id` (CASCADE DELETE)
   - `motion_id` → `assets_motions.id` (RESTRICT DELETE)

### 前端验证

1. 创建绑定前检查是否已存在
2. 分类必须是 `'initial' | 'idle' | 'thinking' | 'reply'` 之一

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
