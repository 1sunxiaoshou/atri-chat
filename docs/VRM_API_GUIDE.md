# VRM模型和动作管理API指南

## 概述

VRM系统采用**多对多关系**设计：
- 一个VRM模型可以关联多个动作
- 一个动作可以被多个模型使用
- 动作独立管理，可复用

## 数据结构

### VRM模型
```json
{
  "vrm_model_id": "model_xiaomei",
  "name": "小美",
  "model_path": "/models/xiaomei.vrm",
  "thumbnail_path": "/thumbnails/xiaomei.png"
}
```

### VRM动作
```json
{
  "animation_id": "anim_wave",
  "name": "wave",
  "name_cn": "挥手",
  "description": "友好地挥手打招呼，适合见面、告别等场景",
  "duration": 2.5
}
```

## API端点

### 1. VRM模型管理

#### 创建模型
```http
POST /api/v1/vrm/models
Content-Type: application/json

{
  "vrm_model_id": "model_xiaomei",
  "name": "小美",
  "model_path": "/models/xiaomei.vrm",
  "thumbnail_path": "/thumbnails/xiaomei.png"
}
```

#### 上传模型文件
```http
POST /api/v1/vrm/models/upload
Content-Type: multipart/form-data

file: [VRM文件]
name: "小美"
thumbnail_path: "/thumbnails/xiaomei.png" (可选)
```

#### 获取所有模型
```http
GET /api/v1/vrm/models
```

#### 获取模型详情
```http
GET /api/v1/vrm/models/{vrm_model_id}
```

#### 更新模型
```http
PUT /api/v1/vrm/models/{vrm_model_id}
Content-Type: application/json

{
  "name": "小美（更新）",
  "thumbnail_path": "/thumbnails/xiaomei_new.png"
}
```

#### 删除模型
```http
DELETE /api/v1/vrm/models/{vrm_model_id}
```

### 2. VRM动作管理

#### 创建动作
```http
POST /api/v1/vrm/animations
Content-Type: application/json

{
  "animation_id": "anim_wave",
  "name": "wave",
  "name_cn": "挥手",
  "description": "友好地挥手打招呼，适合见面、告别等场景",
  "duration": 2.5
}
```

#### 上传动作文件
```http
POST /api/v1/vrm/animations/upload
Content-Type: multipart/form-data

file: [动作文件 .fbx/.bvh]
name: "wave"
name_cn: "挥手"
description: "友好地挥手打招呼" (可选)
duration: 2.5 (可选)
```

#### 获取所有动作
```http
GET /api/v1/vrm/animations
```

#### 获取动作详情
```http
GET /api/v1/vrm/animations/{animation_id}
```

#### 更新动作
```http
PUT /api/v1/vrm/animations/{animation_id}
Content-Type: application/json

{
  "description": "更新后的描述",
  "duration": 3.0
}
```

#### 删除动作
```http
DELETE /api/v1/vrm/animations/{animation_id}
```

#### 查询使用该动作的模型
```http
GET /api/v1/vrm/animations/{animation_id}/models
```

### 3. 模型-动作关联管理

#### 为模型添加动作
```http
POST /api/v1/vrm/models/{vrm_model_id}/animations
Content-Type: application/json

{
  "animation_id": "anim_wave"
}
```

#### 上传动作并关联到模型（便捷接口）
```http
POST /api/v1/vrm/models/{vrm_model_id}/animations/upload
Content-Type: multipart/form-data

file: [动作文件 .fbx/.bvh]
name: "wave"
name_cn: "挥手"
description: "友好地挥手打招呼" (可选)
duration: 2.5 (可选)
```

#### 批量添加动作
```http
POST /api/v1/vrm/models/{vrm_model_id}/animations/batch
Content-Type: application/json

{
  "animation_ids": ["anim_wave", "anim_nod", "anim_think"]
}
```

#### 获取模型的所有动作
```http
GET /api/v1/vrm/models/{vrm_model_id}/animations
```

#### 移除模型的动作
```http
DELETE /api/v1/vrm/models/{vrm_model_id}/animations/{animation_id}
```

#### 批量移除动作
```http
DELETE /api/v1/vrm/models/{vrm_model_id}/animations/batch
Content-Type: application/json

{
  "animation_ids": ["anim_wave", "anim_nod"]
}
```

## 使用场景

### 场景1：创建通用动作库

```bash
# 1. 创建通用动作
curl -X POST http://localhost:8000/api/v1/vrm/animations \
  -H "Content-Type: application/json" \
  -d '{
    "animation_id": "anim_wave",
    "name": "wave",
    "name_cn": "挥手",
    "description": "友好地挥手打招呼",
    "duration": 2.5
  }'

# 2. 多个模型使用同一动作
curl -X POST http://localhost:8000/api/v1/vrm/models/model_xiaomei/animations \
  -H "Content-Type: application/json" \
  -d '{"animation_id": "anim_wave"}'

curl -X POST http://localhost:8000/api/v1/vrm/models/model_xiaoming/animations \
  -H "Content-Type: application/json" \
  -d '{"animation_id": "anim_wave"}'
```

### 场景2：为新模型批量添加动作

```bash
# 创建模型
curl -X POST http://localhost:8000/api/v1/vrm/models \
  -H "Content-Type: application/json" \
  -d '{
    "vrm_model_id": "model_new",
    "name": "新角色",
    "model_path": "/models/new.vrm"
  }'

# 批量添加动作
curl -X POST http://localhost:8000/api/v1/vrm/models/model_new/animations/batch \
  -H "Content-Type: application/json" \
  -d '{
    "animation_ids": ["anim_wave", "anim_nod", "anim_think", "anim_smile"]
  }'
```

### 场景3：查询动作使用情况

```bash
# 查询哪些模型使用了"挥手"动作
curl http://localhost:8000/api/v1/vrm/animations/anim_wave/models
```

## AI Prompt集成

动作的`description`和`duration`字段用于AI理解和编排：

```python
# 获取模型的动作
animations = storage.get_model_animations("model_xiaomei")

# 构建Prompt
prompt = "你可以使用以下动作：\n"
for anim in animations:
    prompt += f"- {anim['name_cn']}（{anim['name']}）"
    if anim['description']:
        prompt += f": {anim['description']}"
    if anim['duration']:
        prompt += f" [时长: {anim['duration']}秒]"
    prompt += "\n"
```

AI生成的标记示例：
```
[Action:挥手]你好！[Action:微笑]很高兴见到你。
```

## 测试

运行测试脚本验证功能：

```bash
python tests/test_vrm_many_to_many.py
```

## 注意事项

1. **动作名称唯一性**：`name`字段（英文ID）必须全局唯一
2. **级联删除**：删除模型或动作会自动删除关联关系
3. **缩略图默认值**：如果不提供`thumbnail_path`，使用默认图片
4. **描述可选**：`description`字段可选，但建议填写以帮助AI理解
5. **时长信息**：`duration`在导入动作时确定，用于AI编排
