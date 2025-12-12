# VRM虚拟角色集成文档

## 目录

- [1. 概述](#1-概述)
- [2. 架构设计](#2-架构设计)
- [3. 嵌入式标记语法](#3-嵌入式标记语法)
- [4. 后端实现](#4-后端实现)
- [5. 前端实现](#5-前端实现)
- [6. API接口](#6-api接口)
- [7. 同步机制](#7-同步机制)
- [8. 使用示例](#8-使用示例)
- [9. 最佳实践](#9-最佳实践)
- [10. 故障排查](#10-故障排查)

---

## 1. 概述

### 1.1 功能简介

VRM虚拟角色集成允许AI对话系统驱动3D虚拟角色，实现：
- **表情同步**：根据对话情感实时切换表情
- **动作触发**：在特定话语时播放动作
- **口型同步**：音频播放时同步口型（可选）
- **文本显示**：实时显示对话字幕

### 1.2 核心特性

- ✅ **嵌入式标记**：AI生成带动作/表情标签的文本
- ✅ **精确同步**：基于时间戳的音频-动作对齐
- ✅ **按句生成**：TTS按句子生成，保证流畅性
- ✅ **资源解耦**：VRM资源独立管理，不依赖对话流程
- ✅ **多模式支持**：文本/VRM/Live2D模式切换

### 1.3 技术栈

**后端**：
- Python 3.12+
- FastAPI
- LangChain/LangGraph
- SQLite

**前端**：
- TypeScript
- Three.js
- @pixiv/three-vrm
- Web Audio API

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ VRM加载器 │  │ 标记解析器│  │ 音频播放器│  │ 时间同步器│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/SSE
┌─────────────────────────────────────────────────────────────┐
│                         API层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ 消息路由  │  │ VRM路由   │  │ TTS路由   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                        业务逻辑层                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │AgentManager│ │标记解析器 │  │音频生成器 │  │时间戳计算 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                         存储层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ VRM模型表 │  │ 动作表    │  │ 角色表    │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 职责划分

| 层级 | 职责 |
|------|------|
| **前端** | VRM模型加载、动作播放、音频播放、时间同步 |
| **API** | 接口路由、请求验证、响应格式化 |
| **业务逻辑** | AI生成、标记解析、音频合成、时间戳计算 |
| **存储** | VRM资源管理、角色配置、对话历史 |

### 2.3 数据流

```
用户输入
  ↓
AI生成带标记文本: "[State:开心][Action:打招呼]你好！[State:好奇]今天想学什么？"
  ↓
按句分割: ["[State:开心][Action:打招呼]你好！", "[State:好奇]今天想学什么？"]
  ↓
逐句处理:
  句子1: "[State:开心][Action:打招呼]你好！"
    ↓
  解析标记: {text: "你好！", markups: [{type: "state", value: "happy", position: 0}, {type: "action", value: "wave", position: 0}]}
    ↓
  TTS合成: audio_url="/uploads/vrm_audio/xxx1.wav", duration=0.6s
    ↓
  计算时间戳: 
    - [State:happy] position=0 → timestamp = 0.0 + (0/3) * 0.6 = 0.0s
    - [Action:wave] position=0 → timestamp = 0.0 + (0/3) * 0.6 = 0.0s
  ↓
  句子2: "[State:好奇]今天想学什么？"
    ↓
  解析标记: {text: "今天想学什么？", markups: [{type: "state", value: "curious", position: 0}]}
    ↓
  TTS合成: audio_url="/uploads/vrm_audio/xxx2.wav", duration=1.2s
    ↓
  计算时间戳:
    - [State:curious] position=0 → timestamp = 0.6 + (0/7) * 1.2 = 0.6s
  ↓
返回前端: {segments: [{text, audio_url, duration, start_time, markups}, ...]}
  ↓
前端播放: 按时间戳顺序触发标记并播放音频
```

---


## 3. 嵌入式标记语法

### 3.1 标记类型

#### 3.1.1 表情标签（State）

**语法**：`[State:表情名]`

**作用**：改变角色的情绪状态，持续到下一个表情标签

**可用表情**：
- `开心` (happy) - 微笑、愉悦
- `难过` (sad) - 悲伤、失落
- `生气` (angry) - 愤怒、不满
- `惊讶` (surprised) - 惊讶、震惊
- `中性` (neutral) - 默认表情
- `好奇` (curious) - 好奇、疑惑

**示例**：
```
[State:开心]今天天气真好！
[State:难过]这个功能还没做完。
```

#### 3.1.2 动作标签（Action）

**语法**：`[Action:动作名]`

**作用**：瞬时触发动作，只作用于紧跟的文本片段

**动作来源**：
- ✅ **数据库动态获取**：动作列表从 `vrm_animations` 表读取
- ✅ **与VRM模型关联**：每个VRM模型有自己的动作集
- ✅ **支持自定义**：用户可以上传自定义动作文件

**标准动作示例**：

| 类型 | 动作名（中文） | 英文ID | 时长 |
|------|---------------|--------|------|
| 短动作 | 打招呼 | wave | 1-2s |
| 短动作 | 挠头 | scratch_head | 1-2s |
| 短动作 | 弹手指 | snap_fingers | 1s |
| 短动作 | 羞愧 | shy | 1-2s |
| 中等动作 | 兴奋 | excited | 2-3s |
| 中等动作 | 问候 | greet | 2s |
| 中等动作 | 和平手势 | peace_sign | 2s |
| 中等动作 | 叉腰 | hands_on_hips | 2-3s |
| 长动作 | 土下座 | dogeza | 3-5s |
| 长动作 | 喝水 | drink | 3-4s |

**注意**：
- 实际可用动作取决于数据库中为该VRM模型配置的动作
- AI生成标记时会根据角色关联的VRM模型动态获取动作列表
- 使用未配置的动作会保留原始中文名并记录警告

**示例**：
```
[Action:打招呼]你好呀！
[Action:挠头]嗯...让我想想。
[Action:跳舞]开始表演！  # 自定义动作
```

### 3.2 标记规则

#### 3.2.1 基本规则

1. **不修改原文**：标记只插入，不改变文本内容
2. **克制使用**：不是每句话都需要动作，保持自然
3. **位置合理**：标签插入在语气转折、重音或句首
4. **表情持续**：State标签改变状态，持续到下一个State
5. **动作瞬时**：Action标签只作用于紧跟的文本

#### 3.2.2 组合使用

**表情+动作**：
```
[State:开心][Action:打招呼]你好！
```

**多个动作**：
```
[Action:兴奋]太棒了！[Action:和平手势]我终于完成了！
```

**情绪转折**：
```
[State:好奇][Action:挠头]嗯...让我想想，[State:难过]这个功能好像还没做完。
```

### 3.3 AI生成示例

**输入**：用户说"老师你好呀！今天想学点什么？"

**AI生成**：
```
[State:开心][Action:打招呼]老师你好呀！今天想学点什么？
```

**解析结果**：
- 纯文本：`老师你好呀！今天想学点什么？`
- 表情：`开心` (在0.0s触发)
- 动作：`打招呼` (在0.0s触发)

---

## 4. 后端实现

### 4.1 数据库设计

#### 4.1.0 关系说明

**核心关系**：
```
角色 (characters) ──┐
                    ├─→ VRM模型 (vrm_models) ──→ 动作 (vrm_animations)
角色 (characters) ──┘
```

- **角色 → VRM模型**：多对一（多个角色可以共享同一个VRM模型）
- **VRM模型 → 动作**：一对多（一个VRM模型有多个动作）
- **动作映射**：动态从数据库获取，支持自定义

**数据流**：
1. 用户选择角色 → 获取角色的 `vrm_model_id`
2. 根据 `vrm_model_id` 查询动作列表 → 构建动作映射
3. 动作映射传递给标记解析器 → 解析AI生成的标记
4. 前端根据解析结果播放动作

#### 4.1.1 VRM模型表

```sql
CREATE TABLE vrm_models (
    vrm_model_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model_path TEXT NOT NULL,
    thumbnail_path TEXT,
    description TEXT,
    created_at TEXT NOT NULL
);
```

**字段说明**：
- `vrm_model_id`: 唯一标识符（UUID）
- `name`: 模型名称
- `model_path`: VRM文件路径（如 `/uploads/vrm_models/xxx.vrm`）
- `thumbnail_path`: 缩略图路径
- `description`: 模型描述
- `created_at`: 创建时间

#### 4.1.2 VRM动作表

```sql
CREATE TABLE vrm_animations (
    animation_id TEXT PRIMARY KEY,
    vrm_model_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_cn TEXT NOT NULL,
    animation_path TEXT NOT NULL,
    duration REAL,
    type TEXT DEFAULT 'short',
    FOREIGN KEY (vrm_model_id) REFERENCES vrm_models(vrm_model_id)
);
```

**字段说明**：
- `animation_id`: 唯一标识符（UUID）
- `vrm_model_id`: 关联的VRM模型ID（动作与模型关联）
- `name`: 动作英文名（如 `wave`）
- `name_cn`: 动作中文名（如 `打招呼`）
- `animation_path`: 动作文件路径（.fbx或.bvh）
- `duration`: 动作时长（秒）
- `type`: 动作类型（short/medium/long）

#### 4.1.3 角色表扩展

```sql
ALTER TABLE characters ADD COLUMN vrm_model_id TEXT;
```

**关系说明**：
- **角色 → VRM模型**：多对一关系（多个角色可以共享同一个VRM模型）
- **VRM模型 → 动作**：一对多关系（一个VRM模型有多个动作）

**示例**：
```
角色A (character_id=1, vrm_model_id="model-xxx")  ┐
角色B (character_id=2, vrm_model_id="model-xxx")  ├─→ VRM模型 (vrm_model_id="model-xxx")
角色C (character_id=3, vrm_model_id="model-xxx")  ┘       ↓
                                                    动作1: wave
                                                    动作2: scratch_head
                                                    动作3: greet
```

### 4.2 核心模块

#### 4.2.1 标记解析器

**文件**：`core/vrm/markup_parser.py`

**功能**：
- 解析嵌入式标记
- 计算标记在纯文本中的位置
- 映射中文名到英文ID（动作映射动态获取）

**关键特性**：
- ✅ **动态动作映射**：从数据库获取VRM模型的实际动作列表
- ✅ **固定表情映射**：使用VRM规范定义的标准表情
- ✅ **精确位置计算**：使用正向扫描算法，避免位置偏移错误
- ✅ **未知动作处理**：保留原始中文名并记录警告日志

**初始化**：
```python
# 从数据库获取动作映射
animations = app_storage.list_vrm_animations(vrm_model_id)
action_mapping = {anim["name_cn"]: anim["name"] for anim in animations}

# 创建解析器（传入动作映射）
parser = VRMMarkupParser(action_mapping=action_mapping)
```

**关键方法**：
```python
def __init__(self, action_mapping: Optional[Dict[str, str]] = None):
    """初始化解析器
    
    Args:
        action_mapping: 动作映射字典（中文名 -> 英文ID），从数据库动态获取
    """
    self.action_mapping = action_mapping or {}

def parse(self, marked_text: str) -> Tuple[str, List[VRMMarkup]]:
    """解析带标记的文本
    
    Args:
        marked_text: 带标记的文本
        
    Returns:
        (纯文本, 标记列表)
    """
```

**示例**：
```python
# 1. 从数据库获取动作映射
animations = app_storage.list_vrm_animations("model-001")
action_mapping = {
    "打招呼": "wave",
    "挠头": "scratch_head",
    "跳舞": "dance"  # 自定义动作
}

# 2. 创建解析器
parser = VRMMarkupParser(action_mapping=action_mapping)

# 3. 解析文本
clean_text, markups = parser.parse("[State:开心][Action:打招呼]你好！")

# clean_text = "你好！"
# markups = [
#     VRMMarkup(type="state", value="happy", position=0),
#     VRMMarkup(type="action", value="wave", position=0)
# ]

# 4. 未知动作处理
clean_text2, markups2 = parser.parse("[Action:未知动作]测试")
# markups2[0].value = "未知动作"  # 保留原始中文名
# 同时记录警告日志
```

**优势**：
- 支持用户自定义动作，无需修改代码
- 不同VRM模型可以有不同的动作集
- 动作列表完全由数据库管理，灵活可扩展

#### 4.2.2 音频生成器

**文件**：`core/vrm/audio_generator.py`

**功能**：
- 按句分割文本（保留标记）
- 为每个句子生成TTS音频
- 计算精确时间戳

**初始化**：
```python
# 从数据库获取动作映射
animations = app_storage.list_vrm_animations(vrm_model_id)
action_mapping = {anim["name_cn"]: anim["name"] for anim in animations}

# 创建音频生成器（传入动作映射）
audio_gen = AudioGenerator(tts_factory, action_mapping=action_mapping)
```

**关键方法**：
```python
def __init__(self, tts_factory: TTSFactory, action_mapping: Optional[dict] = None):
    """初始化音频生成器
    
    Args:
        tts_factory: TTS工厂实例
        action_mapping: 动作映射字典（中文名 -> 英文ID），从数据库获取
    """
    self.parser = VRMMarkupParser(action_mapping=action_mapping)

async def generate_by_sentence(self, marked_text: str) -> List[AudioSegment]:
    """按句生成音频（带精确时间戳）
    
    Args:
        marked_text: 带标记的完整文本
        
    Returns:
        音频片段列表
    """
```

**句子分割算法改进**：
- ✅ **正向扫描**：直接在带标记的文本上分割，避免回溯匹配
- ✅ **标记完整性**：确保标记不会被分割到不同句子
- ✅ **边界准确**：精确识别句子结束符（。！？.!?）

**数据结构**：
```python
@dataclass
class AudioSegment:
    sentence_index: int      # 句子索引
    text: str                # 纯文本
    marked_text: str         # 带标记的文本
    audio_url: str           # 音频URL
    duration: float          # 音频时长（秒）
    start_time: float        # 起始时间
    end_time: float          # 结束时间
    markups: List[TimedMarkup]  # 带时间戳的标记
```

#### 4.2.3 标记过滤器

**文件**：`core/vrm/markup_filter.py`

**功能**：
- 移除文本中的标记（用于TTS）
- 检查文本是否包含标记

**关键方法**：
```python
@staticmethod
def remove_markup(text: str) -> str:
    """移除所有标记，返回纯文本"""
```

### 4.3 消息处理流程

```python
# core/agent_manager.py

async def send_message_stream_vrm(
    self,
    user_message: str,
    conversation_id: int,
    character_id: int,
    model_id: str,
    provider_id: str,
    **model_kwargs
):
    # 1. 获取角色和VRM模型信息
    character = self.app_storage.get_character(character_id)
    vrm_model_id = character.get("vrm_model_id")
    
    # 2. 生成VRM标记指令（基于数据库中的动作列表）
    if vrm_model_id:
        animations = self.app_storage.list_vrm_animations(vrm_model_id)
        action_names = [anim["name_cn"] for anim in animations]
        vrm_instruction = generate_vrm_instruction(DEFAULT_EXPRESSIONS, action_names)
    else:
        vrm_instruction = generate_vrm_instruction(DEFAULT_EXPRESSIONS, [])
    
    # 3. 在内存中创建临时角色配置（避免并发问题）
    temp_character = character.copy()
    temp_character["system_prompt"] = character["system_prompt"] + vrm_instruction
    
    # 4. 创建Agent（使用修改后的prompt）
    agent = create_agent(
        model=model,
        tools=tools,
        system_prompt=temp_character["system_prompt"],  # 临时prompt
        checkpointer=self.checkpointer,
        store=self.store
    )
    
    # 5. 流式生成文本
    full_response = ""
    async for message in agent.astream(...):
        chunk_text = message.content
        full_response += chunk_text
        
        # 发送文本chunk
        yield json.dumps({"type": "text", "content": chunk_text})
    
    # 6. 生成音频（传入动作映射）
    if full_response:
        # 构建动作映射
        action_mapping = {}
        if vrm_model_id:
            animations = self.app_storage.list_vrm_animations(vrm_model_id)
            action_mapping = {anim["name_cn"]: anim["name"] for anim in animations}
        
        # 创建音频生成器（传入动作映射）
        audio_gen = AudioGenerator(self.tts_factory, action_mapping=action_mapping)
        segments = await audio_gen.generate_by_sentence(
            full_response,
            tts_provider=character.get("tts_id", "default")
        )
        
        # 发送音频片段
        yield json.dumps({
            "type": "audio_segments",
            "segments": audio_gen.to_dict_list(segments)
        })
    
    # 7. 保存消息（移除标记）
    clean_response = MarkupFilter.remove_markup(full_response)
    self.app_storage.add_message(conversation_id, "user", user_message)
    self.app_storage.add_message(conversation_id, "assistant", clean_response)
```

**关键改进**：
- ✅ **动态动作列表**：从数据库读取VRM模型的实际动作
- ✅ **内存中修改prompt**：避免数据库并发写入问题
- ✅ **动作映射传递**：确保解析器使用正确的映射关系

---


## 5. 前端实现

### 5.1 VRM资源加载器

**文件**：`frontend/utils/vrmLoader.ts`

**功能**：
- 加载VRM模型文件
- 加载动作文件（.fbx/.bvh）
- 管理Three.js场景
- 提供动作播放和表情切换接口

**关键方法**：

```typescript
class VRMLoader {
  // 加载VRM资源
  async loadResources(resources: VRMResources): Promise<void>
  
  // 播放动作
  playAction(actionName: string): void
  
  // 设置表情
  setExpression(expressionName: string, value: number): void
  
  // 清理资源
  dispose(): void
}
```

**使用示例**：

```typescript
// 初始化
const loader = new VRMLoader(canvasElement);

// 加载资源
await loader.loadResources({
  model_path: "/uploads/vrm_models/xxx.vrm",
  animations: {
    "wave": "/uploads/vrm_animations/xxx/wave.fbx",
    "scratch_head": "/uploads/vrm_animations/xxx/scratch.fbx"
  }
});

// 播放动作
loader.playAction("wave");

// 设置表情
loader.setExpression("happy", 1.0);
```

### 5.2 精确时间戳播放器

**文件**：`frontend/utils/vrmTimedPlayer.ts`

**功能**：
- 管理音频片段播放
- 根据时间戳触发标记
- 同步文本进度

**关键方法**：

```typescript
class VRMTimedPlayer {
  // 设置音频片段
  setSegments(segments: AudioSegment[]): void
  
  // 开始播放
  async play(): Promise<void>
  
  // 暂停播放
  pause(): void
  
  // 停止播放
  stop(): void
}
```

**回调接口**：

```typescript
interface VRMPlayerCallbacks {
  // 表情变化
  onStateChange: (state: string) => void;
  
  // 动作触发
  onActionTrigger: (action: string) => void;
  
  // 文本进度
  onTextProgress: (text: string, progress: number) => void;
}
```

**使用示例**：

```typescript
// 初始化播放器
const player = new VRMTimedPlayer({
  onStateChange: (state) => {
    vrmLoader.setExpression(state);
  },
  onActionTrigger: (action) => {
    vrmLoader.playAction(action);
  },
  onTextProgress: (text, progress) => {
    updateSubtitle(text, progress);
  }
});

// 设置音频片段
player.setSegments(audioSegments);

// 开始播放
await player.play();
```

### 5.3 标记解析器

**文件**：`frontend/utils/vrmMarkupParser.ts`

**功能**：
- 解析嵌入式标记（前端备用）
- 提取动作和表情信息

**关键方法**：

```typescript
class VRMMarkupParser {
  parse(markedText: string): VRMSegment[]
}
```

### 5.4 聊天界面集成

**文件**：`frontend/components/chat/ChatInterface.tsx`

**集成步骤**：

```typescript
const ChatInterface: React.FC<Props> = ({ ... }) => {
  const [vrmLoader, setVrmLoader] = useState<VRMLoader | null>(null);
  const [vrmPlayer, setVrmPlayer] = useState<VRMTimedPlayer | null>(null);
  const vrmCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. 初始化VRM加载器
  useEffect(() => {
    if (displayMode === 'vrm' && vrmCanvasRef.current) {
      const loader = new VRMLoader(vrmCanvasRef.current);
      setVrmLoader(loader);
      
      return () => loader.dispose();
    }
  }, [displayMode]);

  // 2. 加载VRM资源
  useEffect(() => {
    if (vrmLoader && activeCharacter?.vrm_model_id) {
      loadVRMResources();
    }
  }, [vrmLoader, activeCharacter]);

  const loadVRMResources = async () => {
    const res = await api.getVRMModel(activeCharacter.vrm_model_id);
    await vrmLoader!.loadResources(res.data);
  };

  // 3. 初始化播放器
  useEffect(() => {
    if (displayMode === 'vrm' && vrmLoader) {
      const player = new VRMTimedPlayer({
        onStateChange: (state) => vrmLoader.setExpression(state),
        onActionTrigger: (action) => vrmLoader.playAction(action),
        onTextProgress: (text, progress) => updateSubtitle(text, progress)
      });
      setVrmPlayer(player);
      
      return () => player.dispose();
    }
  }, [displayMode, vrmLoader]);

  // 4. 处理消息响应
  const handleSend = async () => {
    const result = await api.sendMessage({
      content: inputValue,
      display_mode: displayMode,
      enable_tts: displayMode === 'vrm',
      tts_mode: 'sentence'
    });

    // 处理音频片段
    if (result.audio_segments && vrmPlayer) {
      vrmPlayer.setSegments(result.audio_segments);
      await vrmPlayer.play();
    }
  };

  return (
    <div className="chat-container">
      {/* VRM渲染区域 */}
      {displayMode === 'vrm' && (
        <div className="vrm-viewer">
          <canvas ref={vrmCanvasRef} width={384} height={384} />
        </div>
      )}
      
      {/* 其他UI */}
    </div>
  );
};
```

---

## 6. API接口

### 6.1 VRM资源管理

#### 6.1.1 列出VRM模型

**请求**：
```http
GET /api/v1/vrm/models
```

**响应**：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "vrm_model_id": "uuid-xxx",
      "name": "角色A",
      "model_path": "/uploads/vrm_models/xxx.vrm",
      "thumbnail_path": "/uploads/vrm_thumbnails/xxx.png",
      "description": "可爱的女孩角色",
      "created_at": "2024-01-01T00:00:00"
    }
  ]
}
```

#### 6.1.2 获取VRM模型详情

**请求**：
```http
GET /api/v1/vrm/models/{vrm_model_id}
```

**响应**：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "vrm_model_id": "uuid-xxx",
    "name": "角色A",
    "model_path": "/uploads/vrm_models/xxx.vrm",
    "animations": [
      {
        "animation_id": "uuid-yyy",
        "name": "wave",
        "name_cn": "打招呼",
        "animation_path": "/uploads/vrm_animations/xxx/wave.fbx",
        "duration": 1.5,
        "type": "short"
      }
    ]
  }
}
```

#### 6.1.3 上传VRM模型

**请求**：
```http
POST /api/v1/vrm/models/upload
Content-Type: multipart/form-data

file: <vrm文件>
name: "角色A"
description: "可爱的女孩角色"
```

**响应**：
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "vrm_model_id": "uuid-xxx",
    "model_path": "/uploads/vrm_models/xxx.vrm"
  }
}
```

#### 6.1.4 上传VRM动作

**请求**：
```http
POST /api/v1/vrm/models/{vrm_model_id}/animations/upload
Content-Type: multipart/form-data

file: <fbx/bvh文件>
name: "wave"
name_cn: "打招呼"
duration: 1.5
type: "short"
```

**响应**：
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "animation_id": "uuid-yyy",
    "animation_path": "/uploads/vrm_animations/xxx/wave.fbx"
  }
}
```

### 6.2 消息接口

#### 6.2.1 发送消息（VRM模式）

**请求**：
```http
POST /api/v1/messages
Content-Type: application/json

{
  "conversation_id": 1,
  "character_id": 1,
  "model_id": "gpt-4",
  "provider_id": "openai",
  "content": "你好",
  "display_mode": "vrm",
  "enable_tts": true,
  "tts_mode": "sentence"
}
```

**响应**（SSE流式）：

```
data: {"type": "text", "content": "[State:开心][Action:打招呼]你好！"}

data: {"type": "text", "content": "[State:好奇]今天想学点什么？"}

data: {"type": "audio_segments", "segments": [
  {
    "sentence_index": 0,
    "text": "你好！",
    "marked_text": "[State:开心][Action:打招呼]你好！",
    "audio_url": "/uploads/vrm_audio/xxx1.wav",
    "duration": 0.6,
    "start_time": 0.0,
    "end_time": 0.6,
    "markups": [
      {"type": "state", "value": "happy", "timestamp": 0.0, "sentence_index": 0},
      {"type": "action", "value": "wave", "timestamp": 0.0, "sentence_index": 0}
    ]
  },
  {
    "sentence_index": 1,
    "text": "今天想学点什么？",
    "marked_text": "[State:好奇]今天想学点什么？",
    "audio_url": "/uploads/vrm_audio/xxx2.wav",
    "duration": 1.2,
    "start_time": 0.6,
    "end_time": 1.8,
    "markups": [
      {"type": "state", "value": "curious", "timestamp": 0.6, "sentence_index": 1}
    ]
  }
]}

data: {"done": true}
```

---


## 7. 同步机制

### 7.1 时间戳计算原理

#### 7.1.1 基本原理

VRM同步的核心是**将标记位置映射到音频时间轴**：

```
处理流程:
1. 按句分割带标记的文本
2. 逐句移除标记，得到纯文本
3. 对纯文本进行TTS合成，获得音频时长
4. 根据标记在纯文本中的位置，估算触发时间
```

**时间戳计算公式**：
```
timestamp = sentence_start_time + (markup_position / clean_text_length) * audio_duration
```

**关键点**：
- ✅ **先分句，再TTS**：确保每个句子有精确的音频时长
- ✅ **标记位置基于纯文本**：移除标记后计算位置
- ✅ **线性估算**：假设语速均匀分布

**示例1：句首标记**
```
原始文本: "[State:开心][Action:打招呼]你好！"
纯文本: "你好！" (长度=3)
TTS合成: audio_duration=0.6秒
句子起始时间: 0.0秒

标记1: [State:开心]
  - 在纯文本中的位置: 0 (在"你"之前)
  - 时间戳: 0.0 + (0/3) * 0.6 = 0.0秒

标记2: [Action:打招呼]
  - 在纯文本中的位置: 0 (在"你"之前)
  - 时间戳: 0.0 + (0/3) * 0.6 = 0.0秒
```

**示例2：句中标记**
```
原始文本: "[State:开心]你好！[State:好奇]今天怎么样？"
纯文本: "你好！今天怎么样？" (长度=10)
TTS合成: audio_duration=1.5秒
句子起始时间: 0.0秒

标记1: [State:开心]
  - 在纯文本中的位置: 0
  - 时间戳: 0.0 + (0/10) * 1.5 = 0.0秒

标记2: [State:好奇]
  - 在纯文本中的位置: 3 (在"今"之前)
  - 时间戳: 0.0 + (3/10) * 1.5 = 0.45秒
```

#### 7.1.2 多句子场景

```
句子1: "[State:开心][Action:打招呼]你好！"
  - 纯文本: "你好！"
  - 时长: 0.6秒
  - 起始时间: 0.0秒
  - 标记时间戳: 0.0秒

句子2: "[State:好奇]今天想学点什么？"
  - 纯文本: "今天想学点什么？"
  - 时长: 1.2秒
  - 起始时间: 0.6秒 (累积)
  - 标记时间戳: 0.6秒
```

### 7.2 同步流程

#### 7.2.1 后端处理流程

```python
# 1. AI生成带标记的文本
marked_text = "[State:开心][Action:打招呼]你好！[State:好奇]今天想学点什么？"

# 2. 按句分割（保留标记）
sentences = split_sentences(marked_text)
# 结果: [
#   "[State:开心][Action:打招呼]你好！",
#   "[State:好奇]今天想学点什么？"
# ]

# 3. 逐句处理
cumulative_time = 0.0
segments = []

for sentence in sentences:
    # 3.1 解析标记，得到纯文本和标记列表
    clean_text, markups = parser.parse(sentence)
    # 示例: clean_text = "你好！"
    #       markups = [
    #           VRMMarkup(type="state", value="happy", position=0),
    #           VRMMarkup(type="action", value="wave", position=0)
    #       ]
    
    # 3.2 对纯文本进行TTS合成
    audio_url, audio_duration = await synthesize_audio(clean_text)
    # 示例: audio_duration = 0.6秒
    
    # 3.3 计算标记时间戳
    # 公式: timestamp = cumulative_time + (position / text_length) * audio_duration
    timed_markups = []
    text_length = len(clean_text)
    
    for markup in markups:
        # 计算该标记在音频中的触发时间
        if text_length > 0:
            relative_position = markup.position / text_length
        else:
            relative_position = 0.0
        
        timestamp = cumulative_time + (relative_position * audio_duration)
        
        timed_markups.append({
            "type": markup.type,
            "value": markup.value,
            "timestamp": timestamp,
            "sentence_index": len(segments)
        })
    
    # 3.4 创建音频片段
    segments.append({
        "sentence_index": len(segments),
        "text": clean_text,
        "marked_text": sentence,
        "audio_url": audio_url,
        "duration": audio_duration,
        "start_time": cumulative_time,
        "end_time": cumulative_time + audio_duration,
        "markups": timed_markups
    })
    
    # 3.5 累积时间
    cumulative_time += audio_duration

# 4. 返回给前端
return segments

# 示例结果:
# [
#   {
#     "sentence_index": 0,
#     "text": "你好！",
#     "audio_url": "/uploads/vrm_audio/xxx1.wav",
#     "duration": 0.6,
#     "start_time": 0.0,
#     "end_time": 0.6,
#     "markups": [
#       {"type": "state", "value": "happy", "timestamp": 0.0},
#       {"type": "action", "value": "wave", "timestamp": 0.0}
#     ]
#   },
#   {
#     "sentence_index": 1,
#     "text": "今天想学点什么？",
#     "audio_url": "/uploads/vrm_audio/xxx2.wav",
#     "duration": 1.2,
#     "start_time": 0.6,
#     "end_time": 1.8,
#     "markups": [
#       {"type": "state", "value": "curious", "timestamp": 0.6}
#     ]
#   }
# ]
```

#### 7.2.2 前端播放流程

```typescript
// 1. 接收音频片段
player.setSegments(segments);

// 2. 开始播放
await player.play();

// 3. 播放循环
for (const segment of segments) {
    // 加载音频
    const audioBuffer = await loadAudio(segment.audio_url);
    
    // 播放音频
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.start();
    
    // 监听时间进度
    const startTime = performance.now();
    const checkMarkups = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const globalTime = segment.start_time + elapsed;
        
        // 检查是否有标记需要触发
        for (const markup of segment.markups) {
            if (!triggered.has(markup) && globalTime >= markup.timestamp) {
                triggerMarkup(markup);
                triggered.add(markup);
            }
        }
        
        if (elapsed < segment.duration) {
            requestAnimationFrame(checkMarkups);
        }
    };
    
    checkMarkups();
    
    // 等待音频播放完毕
    await waitForAudioEnd(source);
}
```

### 7.3 精度保证

#### 7.3.1 音频时长精确测量

```python
import wave

def get_audio_duration(audio_path: str) -> float:
    """获取WAV文件的精确时长"""
    with wave.open(audio_path, 'rb') as wav_file:
        frames = wav_file.getnframes()
        rate = wav_file.getframerate()
        duration = frames / float(rate)
    return duration
```

#### 7.3.2 时间戳容差

为了避免浮点数精度问题，前端触发标记时使用容差：

```typescript
const TIMESTAMP_TOLERANCE = 0.05; // 50ms容差

if (Math.abs(globalTime - markup.timestamp) < TIMESTAMP_TOLERANCE) {
    triggerMarkup(markup);
}
```

### 7.4 同步优化

#### 7.4.1 预加载

```typescript
// 预加载下一个片段的音频
if (currentIndex + 1 < segments.length) {
    preloadAudio(segments[currentIndex + 1].audio_url);
}
```

#### 7.4.2 缓冲策略

```typescript
// 等待最少2个片段缓冲后再开始播放
const MIN_BUFFER_SEGMENTS = 2;

if (bufferedSegments.length >= MIN_BUFFER_SEGMENTS) {
    startPlayback();
}
```

---

## 8. 使用示例

### 8.1 完整对话示例

#### 8.1.1 场景：问候对话

**用户输入**：
```
"老师你好！今天想学点什么？"
```

**AI生成**：
```
[State:开心][Action:打招呼]老师你好呀！[State:好奇]今天想学点什么呢？
```

**后端处理流程**：

```python
# 1. 按句分割（保留标记）
sentences = [
    "[State:开心][Action:打招呼]老师你好呀！",
    "[State:好奇]今天想学点什么呢？"
]

# 2. 逐句处理
# 句子1: "[State:开心][Action:打招呼]老师你好呀！"
#   - 解析标记: clean_text="老师你好呀！", markups=[{type:"state", value:"happy", position:0}, {type:"action", value:"wave", position:0}]
#   - TTS合成: audio_duration=0.8秒
#   - 计算时间戳: 
#       [State:happy] → 0.0 + (0/6) * 0.8 = 0.0秒
#       [Action:wave] → 0.0 + (0/6) * 0.8 = 0.0秒

# 句子2: "[State:好奇]今天想学点什么呢？"
#   - 解析标记: clean_text="今天想学点什么呢？", markups=[{type:"state", value:"curious", position:0}]
#   - TTS合成: audio_duration=1.2秒
#   - 计算时间戳:
#       [State:curious] → 0.8 + (0/9) * 1.2 = 0.8秒

# 3. 生成音频片段
segments = [
    {
        "sentence_index": 0,
        "text": "老师你好呀！",
        "audio_url": "/uploads/vrm_audio/xxx1.wav",
        "duration": 0.8,
        "start_time": 0.0,
        "end_time": 0.8,
        "markups": [
            {"type": "state", "value": "happy", "timestamp": 0.0},
            {"type": "action", "value": "wave", "timestamp": 0.0}
        ]
    },
    {
        "sentence_index": 1,
        "text": "今天想学点什么呢？",
        "audio_url": "/uploads/vrm_audio/xxx2.wav",
        "duration": 1.2,
        "start_time": 0.8,
        "end_time": 2.0,
        "markups": [
            {"type": "state", "value": "curious", "timestamp": 0.8}
        ]
    }
]
```

**前端播放时间轴**：

```
0.0s: 播放音频1 "老师你好呀！"
0.0s: 触发 [State:happy] - VRM切换到开心表情
0.0s: 触发 [Action:wave] - VRM播放打招呼动作
0.8s: 音频1结束，播放音频2 "今天想学点什么呢？"
0.8s: 触发 [State:curious] - VRM切换到好奇表情
2.0s: 音频2结束，播放完毕
```

#### 8.1.2 场景：句中情绪转折

**用户输入**：
```
"这个功能实现了吗？"
```

**AI生成**：
```
[State:好奇][Action:挠头]嗯...让我想想，[State:难过]这个功能好像还没做完。
```

**后端处理流程**：

```python
# 1. 按句分割（这是一个完整句子）
sentences = [
    "[State:好奇][Action:挠头]嗯...让我想想，[State:难过]这个功能好像还没做完。"
]

# 2. 解析标记
# clean_text = "嗯...让我想想，这个功能好像还没做完。" (长度=20)
# markups = [
#   {type:"state", value:"curious", position:0},    # 在"嗯"之前
#   {type:"action", value:"scratch_head", position:0},
#   {type:"state", value:"sad", position:9}         # 在"这"之前
# ]

# 3. TTS合成
# audio_duration = 3.0秒

# 4. 计算时间戳
# [State:curious] → 0.0 + (0/20) * 3.0 = 0.0秒
# [Action:scratch_head] → 0.0 + (0/20) * 3.0 = 0.0秒
# [State:sad] → 0.0 + (9/20) * 3.0 = 1.35秒

# 5. 生成片段
segment = {
    "sentence_index": 0,
    "text": "嗯...让我想想，这个功能好像还没做完。",
    "audio_url": "/uploads/vrm_audio/xxx.wav",
    "duration": 3.0,
    "start_time": 0.0,
    "end_time": 3.0,
    "markups": [
        {"type": "state", "value": "curious", "timestamp": 0.0},
        {"type": "action", "value": "scratch_head", "timestamp": 0.0},
        {"type": "state", "value": "sad", "timestamp": 1.35}
    ]
}
```

**前端播放时间轴**：

```
0.00s: 播放音频 "嗯...让我想想，这个功能好像还没做完。"
0.00s: 触发 [State:curious] - VRM切换到好奇表情
0.00s: 触发 [Action:scratch_head] - VRM播放挠头动作
1.35s: 触发 [State:sad] - VRM切换到难过表情（音频播放到"这"字时）
3.00s: 音频结束，播放完毕
```

**关键点**：
- ✅ 一句话中可以有多个标记
- ✅ 通过 `(position / text_length) * duration` 估算切换时机
- ✅ 表情在音频播放到对应位置时自动切换

### 8.2 代码示例

#### 8.2.1 后端：生成VRM响应

```python
# api/routes/messages.py

@router.post("/messages")
async def send_message(req: MessageRequest):
    async def generate():
        # 1. AI生成带标记的文本
        async for chunk in agent_manager.send_message_stream(
            user_message=req.content,
            conversation_id=req.conversation_id,
            character_id=req.character_id,
            model_id=req.model_id,
            provider_id=req.provider_id,
            display_mode=req.display_mode
        ):
            yield f"data: {chunk}\n\n"
        
        # 2. 生成音频（如果是VRM模式）
        if req.display_mode == "vrm" and req.enable_tts:
            audio_gen = AudioGenerator(tts_factory)
            segments = await audio_gen.generate_by_sentence(full_response)
            
            yield f"data: {json.dumps({'type': 'audio_segments', 'segments': segments})}\n\n"
        
        yield f"data: {json.dumps({'done': True})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

#### 8.2.2 前端：处理VRM响应

```typescript
// frontend/services/api.ts

async sendMessage(
    conversationId: number,
    content: string,
    displayMode: DisplayMode,
    onChunk?: (content: string) => void,
    onAudioSegments?: (segments: AudioSegment[]) => void
) {
    const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            conversation_id: conversationId,
            content: content,
            display_mode: displayMode,
            enable_tts: displayMode === 'vrm',
            tts_mode: 'sentence'
        })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'text' && onChunk) {
                    onChunk(data.content);
                } else if (data.type === 'audio_segments' && onAudioSegments) {
                    onAudioSegments(data.segments);
                }
            }
        }
    }
}
```

#### 8.2.3 前端：VRM播放

```typescript
// frontend/components/chat/ChatInterface.tsx

const handleSend = async () => {
    let fullText = '';
    
    // 发送消息
    await api.sendMessage(
        conversationId,
        inputValue,
        displayMode,
        // 文本chunk回调
        (chunk) => {
            fullText += chunk;
            setMessages(prev => [...prev, { content: fullText }]);
        },
        // 音频片段回调
        async (segments) => {
            if (vrmPlayer) {
                vrmPlayer.setSegments(segments);
                await vrmPlayer.play();
            }
        }
    );
};
```

---


## 9. 最佳实践

### 9.1 标记生成建议

#### 9.1.1 AI Prompt设计

**推荐Prompt（动态生成）**：

系统会根据角色关联的VRM模型，从数据库动态获取动作列表，生成个性化的Prompt：

```python
# 后端自动生成Prompt
def generate_vrm_instruction(expressions: list[str], actions: list[str]) -> str:
    """生成VRM标记指令
    
    Args:
        expressions: 表情列表（固定）
        actions: 动作列表（从数据库获取）
    """
    return f"""
你是一个VRM虚拟角色的动作导演。你的任务是为对话文本添加动作和表情标记。

## 标记语法
- 表情标签：[State:表情名] - 改变情绪状态，持续到下一个表情标签
- 动作标签：[Action:动作名] - 瞬时触发，只作用于紧跟的文本

## 可用资源
### 表情列表
{', '.join(expressions)}

### 动作列表
{', '.join(actions)}

## 编排规则
1. **不修改原文** - 保持文本完整性，只插入标签
2. **克制使用** - 不是每句话都需要动作，保持自然
3. **位置合理** - 标签插入在语气转折、重音或句首
4. **表情持续** - State标签改变情绪状态，持续到下一个State
5. **动作瞬时** - Action标签只作用于紧跟的文本

## 示例
输入: "你好呀！今天想学点什么？"
输出: "[State:开心][Action:打招呼]你好呀！今天想学点什么？"

输入: "嗯...让我想想，这个功能好像还没做完。"
输出: "[State:好奇][Action:挠头]嗯...让我想想，[State:难过]这个功能好像还没做完。"

请在你的回复中自然地添加这些标记。
"""
```

**关键特性**：
- ✅ **动态动作列表**：根据VRM模型的实际动作生成
- ✅ **自动适配**：不同角色可以有不同的动作集
- ✅ **无需手动维护**：添加新动作后自动生效

**示例场景**：

```python
# 场景1：标准VRM模型
animations = ["打招呼", "挠头", "弹手指", "羞愧"]
prompt = generate_vrm_instruction(DEFAULT_EXPRESSIONS, animations)
# AI只会使用这4个动作

# 场景2：扩展VRM模型（添加了自定义动作）
animations = ["打招呼", "挠头", "跳舞", "鞠躬", "拍手"]
prompt = generate_vrm_instruction(DEFAULT_EXPRESSIONS, animations)
# AI可以使用5个动作，包括自定义的"跳舞"、"鞠躬"、"拍手"
```

#### 9.1.2 标记使用原则

**DO（推荐）**：
- ✅ 在问候时使用打招呼动作
- ✅ 在思考时使用挠头动作
- ✅ 在情绪转折处切换表情
- ✅ 在重要话语前添加动作强调

**DON'T（避免）**：
- ❌ 每句话都添加动作（过度使用）
- ❌ 在同一句话中添加多个动作
- ❌ 使用与情感不符的表情
- ❌ 在长句中间频繁切换表情

#### 9.1.3 自定义动作管理

**添加自定义动作**：

```bash
# 1. 上传动作文件（.fbx或.bvh）
POST /api/v1/vrm/models/{vrm_model_id}/animations/upload
Content-Type: multipart/form-data

file: dance.fbx
name: "dance"
name_cn: "跳舞"
duration: 3.0
type: "medium"
```

**使用自定义动作**：

```python
# 后端自动处理
# 1. 从数据库获取动作列表（包括自定义动作）
animations = app_storage.list_vrm_animations(vrm_model_id)
# 结果: [
#   {"name": "wave", "name_cn": "打招呼"},
#   {"name": "dance", "name_cn": "跳舞"},  # 自定义动作
# ]

# 2. 构建动作映射
action_mapping = {anim["name_cn"]: anim["name"] for anim in animations}
# 结果: {"打招呼": "wave", "跳舞": "dance"}

# 3. 传递给解析器
parser = VRMMarkupParser(action_mapping=action_mapping)

# 4. AI生成时会包含自定义动作
# "[Action:跳舞]开始表演！"
```

**最佳实践**：
- ✅ 动作文件应与VRM模型骨骼匹配
- ✅ 中文名应简洁明了，便于AI理解
- ✅ 设置合理的时长，避免动作被截断
- ✅ 按类型分类（short/medium/long）

### 9.2 性能优化

#### 9.2.1 音频缓存

```python
# 使用LRU缓存避免重复合成
from functools import lru_cache

@lru_cache(maxsize=100)
async def synthesize_audio_cached(text: str) -> bytes:
    """缓存TTS结果"""
    tts = tts_factory.create_tts()
    return await tts.synthesize_async(text)
```

#### 9.2.2 资源预加载

```typescript
// 前端预加载VRM资源
const preloadVRMResources = async (characterId: number) => {
    const res = await api.getCharacterVRM(characterId);
    
    // 预加载模型
    await vrmLoader.loadResources(res.data);
    
    // 预加载常用动作
    const commonActions = ['wave', 'scratch_head', 'greet'];
    for (const action of commonActions) {
        vrmLoader.preloadAction(action);
    }
};
```

#### 9.2.3 音频流式传输

```python
# 使用流式TTS（如果TTS支持）
async def synthesize_audio_stream(text: str) -> AsyncGenerator[bytes, None]:
    """流式生成音频"""
    tts = tts_factory.create_tts()
    
    if tts.supports_streaming():
        async for chunk in tts.synthesize_stream(text):
            yield chunk
    else:
        # 回退到一次性生成
        audio_bytes = await tts.synthesize_async(text)
        yield audio_bytes
```

### 9.3 错误处理

#### 9.3.1 TTS失败降级

```python
async def generate_audio_with_fallback(text: str) -> tuple[str, float]:
    """生成音频，失败时降级"""
    try:
        # 尝试TTS合成
        audio_url, duration = await synthesize_audio(text)
        return audio_url, duration
    except Exception as e:
        logger.error(f"TTS合成失败: {e}")
        
        # 降级：使用文本时长估算
        duration = len(text) * 0.15
        return None, duration
```

#### 9.3.2 VRM加载失败处理

```typescript
// 前端VRM加载失败降级
const loadVRMWithFallback = async (modelPath: string) => {
    try {
        await vrmLoader.loadModel(modelPath);
    } catch (error) {
        console.error('VRM加载失败:', error);
        
        // 降级：显示默认头像
        showDefaultAvatar();
        
        // 禁用VRM功能
        setDisplayMode('text');
    }
};
```

#### 9.3.3 音频播放失败处理

```typescript
// 音频播放失败时的处理
const playAudioWithFallback = async (audioUrl: string) => {
    try {
        await audioPlayer.play(audioUrl);
    } catch (error) {
        console.error('音频播放失败:', error);
        
        // 降级：只显示文本，不播放音频
        showTextOnly();
        
        // 继续播放下一个片段
        playNextSegment();
    }
};
```

### 9.4 调试技巧

#### 9.4.1 时间轴可视化

```typescript
// 在控制台打印时间轴
const printTimeline = (segments: AudioSegment[]) => {
    console.log('=== VRM播放时间轴 ===');
    
    for (const segment of segments) {
        console.log(`\n片段 ${segment.sentence_index}:`);
        console.log(`  时间: ${segment.start_time.toFixed(2)}s - ${segment.end_time.toFixed(2)}s`);
        console.log(`  文本: ${segment.text}`);
        
        for (const markup of segment.markups) {
            console.log(`  标记 @ ${markup.timestamp.toFixed(2)}s: [${markup.type}:${markup.value}]`);
        }
    }
    
    console.log('\n===================');
};
```

#### 9.4.2 标记高亮显示

```typescript
// 在UI中高亮显示当前触发的标记
const highlightMarkup = (markup: TimedMarkup) => {
    const markupElement = document.createElement('div');
    markupElement.className = 'markup-indicator';
    markupElement.textContent = `[${markup.type}:${markup.value}]`;
    markupElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        animation: fadeOut 2s forwards;
    `;
    
    document.body.appendChild(markupElement);
    
    setTimeout(() => markupElement.remove(), 2000);
};
```

#### 9.4.3 性能监控

```typescript
// 监控播放性能
class VRMPerformanceMonitor {
    private startTime: number = 0;
    private frameCount: number = 0;
    
    start() {
        this.startTime = performance.now();
        this.frameCount = 0;
        this.monitor();
    }
    
    private monitor() {
        this.frameCount++;
        const elapsed = (performance.now() - this.startTime) / 1000;
        const fps = this.frameCount / elapsed;
        
        console.log(`FPS: ${fps.toFixed(2)}`);
        
        requestAnimationFrame(() => this.monitor());
    }
}
```

---

## 10. 故障排查

### 10.1 常见问题

#### 10.1.1 动作不触发

**症状**：音频播放正常，但VRM动作不触发

**可能原因**：
1. 标记时间戳计算错误
2. 前端未正确监听时间进度
3. 动作文件加载失败

**排查步骤**：

```typescript
// 1. 检查标记数据
console.log('音频片段:', segments);
console.log('标记列表:', segments.flatMap(s => s.markups));

// 2. 检查时间进度
const checkProgress = () => {
    const currentTime = audioContext.currentTime;
    console.log('当前播放时间:', currentTime);
    
    // 检查是否有标记应该触发
    for (const markup of allMarkups) {
        if (currentTime >= markup.timestamp && !triggered.has(markup)) {
            console.warn('标记未触发:', markup);
        }
    }
};

// 3. 检查动作加载
console.log('已加载动作:', vrmLoader.getLoadedAnimations());
```

**解决方案**：
- 确保标记时间戳正确计算
- 使用 `requestAnimationFrame` 而非 `setInterval` 监听进度
- 检查动作文件路径是否正确

#### 10.1.2 音频与文本不同步

**症状**：音频播放速度与文本显示不匹配

**可能原因**：
1. 音频时长测量不准确
2. 文本长度计算错误（包含标记）
3. 网络延迟导致音频加载慢

**排查步骤**：

```python
# 后端：验证音频时长
import wave

def verify_audio_duration(audio_path: str, expected_duration: float):
    with wave.open(audio_path, 'rb') as wav:
        actual_duration = wav.getnframes() / wav.getframerate()
        
    if abs(actual_duration - expected_duration) > 0.1:
        logger.warning(
            f"音频时长不匹配",
            extra={
                "expected": expected_duration,
                "actual": actual_duration,
                "diff": abs(actual_duration - expected_duration)
            }
        )
```

**解决方案**：
- 使用WAV文件头精确测量时长
- 确保文本长度计算时已移除标记
- 实现音频预加载机制

#### 10.1.3 表情切换不流畅

**症状**：表情切换时有明显跳变

**可能原因**：
1. 未使用表情插值
2. 表情权重设置不当
3. 帧率过低

**解决方案**：

```typescript
// 使用表情插值
class VRMExpressionController {
    private currentExpression: string = 'neutral';
    private targetExpression: string = 'neutral';
    private transitionProgress: number = 1.0;
    private transitionDuration: number = 0.3; // 300ms过渡
    
    setExpression(expression: string) {
        this.currentExpression = this.targetExpression;
        this.targetExpression = expression;
        this.transitionProgress = 0.0;
    }
    
    update(deltaTime: number) {
        if (this.transitionProgress < 1.0) {
            this.transitionProgress += deltaTime / this.transitionDuration;
            this.transitionProgress = Math.min(this.transitionProgress, 1.0);
            
            // 插值计算
            const t = this.easeInOutCubic(this.transitionProgress);
            
            // 设置表情权重
            this.vrm.expressionManager.setValue(this.currentExpression, 1 - t);
            this.vrm.expressionManager.setValue(this.targetExpression, t);
        }
    }
    
    private easeInOutCubic(t: number): number {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}
```

### 10.2 性能问题

#### 10.2.1 内存泄漏

**症状**：长时间使用后浏览器变慢

**排查**：

```typescript
// 检查资源是否正确释放
const checkMemoryLeaks = () => {
    console.log('VRM实例:', vrmLoader ? 'active' : 'disposed');
    console.log('音频上下文:', audioContext ? 'active' : 'closed');
    console.log('动画帧ID:', animationFrameId);
};

// 确保组件卸载时清理资源
useEffect(() => {
    return () => {
        vrmLoader?.dispose();
        audioContext?.close();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    };
}, []);
```

#### 10.2.2 帧率下降

**症状**：VRM渲染卡顿

**优化方案**：

```typescript
// 1. 降低渲染质量
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// 2. 使用LOD（细节层次）
if (cameraDistance > 5) {
    vrm.scene.traverse((obj) => {
        if (obj.isMesh) {
            obj.material.wireframe = true; // 简化渲染
        }
    });
}

// 3. 限制帧率
let lastFrameTime = 0;
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;

const animate = (currentTime: number) => {
    requestAnimationFrame(animate);
    
    if (currentTime - lastFrameTime < frameInterval) {
        return;
    }
    
    lastFrameTime = currentTime;
    renderer.render(scene, camera);
};
```

### 10.3 兼容性问题

#### 10.3.1 浏览器兼容性

**支持情况**：
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**不支持的功能**：
- ❌ IE 11（不支持Web Audio API）
- ❌ 旧版移动浏览器（性能不足）

**兼容性检测**：

```typescript
const checkBrowserSupport = (): boolean => {
    // 检查WebGL
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('浏览器不支持WebGL');
        return false;
    }
    
    // 检查Web Audio API
    if (!window.AudioContext && !window.webkitAudioContext) {
        console.error('浏览器不支持Web Audio API');
        return false;
    }
    
    // 检查Fetch API
    if (!window.fetch) {
        console.error('浏览器不支持Fetch API');
        return false;
    }
    
    return true;
};
```

---

## 附录

### A. 数据结构定义

#### A.1 后端数据结构

```python
@dataclass
class VRMMarkup:
    """VRM标记"""
    type: str  # "action" 或 "state"
    value: str  # 动作名或表情名
    position: int  # 在纯文本中的位置
    original_position: int  # 在原始文本中的位置

@dataclass
class TimedMarkup:
    """带时间戳的标记"""
    type: str
    value: str
    timestamp: float  # 秒
    sentence_index: int

@dataclass
class AudioSegment:
    """音频片段"""
    sentence_index: int
    text: str
    marked_text: str
    audio_url: str
    duration: float
    start_time: float
    end_time: float
    markups: List[TimedMarkup]
```

#### A.2 前端数据结构

```typescript
interface VRMMarkup {
    type: 'action' | 'state';
    value: string;
    position: number;
}

interface TimedMarkup {
    type: 'action' | 'state';
    value: string;
    timestamp: number;
    sentence_index: number;
}

interface AudioSegment {
    sentence_index: number;
    text: string;
    marked_text: string;
    audio_url: string;
    duration: number;
    start_time: number;
    end_time: number;
    markups: TimedMarkup[];
}

interface VRMResources {
    vrm_model_id: string;
    name: string;
    model_path: string;
    animations: Array<{
        animation_id: string;
        name: string;
        name_cn: string;
        animation_path: string;
        duration?: number;
        type: string;
    }>;
}
```

### B. 配置示例

#### B.1 角色VRM配置（多对一关系）

```json
{
  "characters": [
    {
      "character_id": 1,
      "name": "小助手A",
      "vrm_model_id": "model-001",
      "system_prompt": "你是一个友好的AI助手..."
    },
    {
      "character_id": 2,
      "name": "小助手B",
      "vrm_model_id": "model-001",
      "system_prompt": "你是一个专业的技术顾问..."
    },
    {
      "character_id": 3,
      "name": "小助手C",
      "vrm_model_id": "model-001",
      "system_prompt": "你是一个幽默的聊天伙伴..."
    }
  ],
  "note": "多个角色可以共享同一个VRM模型"
}
```

#### B.2 VRM模型配置（动作与模型关联）

```json
{
  "vrm_model_id": "model-001",
  "name": "可爱女孩模型",
  "model_path": "/uploads/vrm_models/model-001.vrm",
  "animations": [
    {
      "animation_id": "anim-001",
      "vrm_model_id": "model-001",
      "name": "wave",
      "name_cn": "打招呼",
      "animation_path": "/uploads/vrm_animations/model-001/wave.fbx",
      "duration": 1.5,
      "type": "short"
    },
    {
      "animation_id": "anim-002",
      "vrm_model_id": "model-001",
      "name": "scratch_head",
      "name_cn": "挠头",
      "animation_path": "/uploads/vrm_animations/model-001/scratch_head.fbx",
      "duration": 2.0,
      "type": "short"
    }
  ],
  "note": "动作文件与VRM模型绑定，确保动作适配模型骨骼"
}
```

### C. 参考资源

- [VRM规范](https://vrm.dev/en/)
- [three-vrm文档](https://github.com/pixiv/three-vrm)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Three.js文档](https://threejs.org/docs/)

---

---

## 更新日志

### v1.1.0 (2025-12-12)

**重要改进**：
1. **动态动作映射**：动作列表从数据库动态获取，支持用户自定义动作
2. **句子分割算法优化**：使用正向扫描替代回溯匹配，提高准确性
3. **标记位置计算修复**：实时维护纯文本长度，避免offset累积错误
4. **时间戳计算改进**：特殊处理句首/句尾标记，提高触发精度
5. **并发问题修复**：在内存中修改prompt，避免数据库并发冲突

**详细说明**：
- `VRMMarkupParser` 现在接收 `action_mapping` 参数，从数据库动态获取
- `AudioGenerator` 初始化时传入动作映射，确保解析器使用正确的映射
- `agent_manager.py` 在VRM模式下从数据库读取动作列表并构建映射
- 未知动作会保留原始中文名并记录警告日志
- 表情映射保持固定（VRM规范定义的标准表情）

**向后兼容性**：
- API接口保持不变
- 前端无需修改
- 数据库结构无变化

### v1.0.0 (2025-12-01)

**初始版本**：
- VRM虚拟角色集成基础功能
- 嵌入式标记语法
- 按句TTS生成
- 精确时间戳同步

---

**文档版本**：v1.1.0  
**最后更新**：2025-12-12  
**维护者**：开发团队

