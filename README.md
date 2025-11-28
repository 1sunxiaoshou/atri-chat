# AI Agent API

一个基于 FastAPI 和 LangChain 的多角色 AI Agent 系统，支持多模型供应商、语音识别（ASR）和语音合成（TTS）功能。

## 功能特性

- 🤖 **多角色管理**：支持创建和管理多个 AI 角色，每个角色有独立的系统提示词
- 🔌 **多供应商支持**：内置支持 OpenAI、Anthropic、Google、通义千问、本地模型（Ollama）
- 🎯 **自定义供应商**：支持添加任意 OpenAI 兼容的 API 供应商（如 DeepSeek、Moonshot 等）
- 💬 **会话管理**：支持多会话并发，每个会话独立维护对话历史
- 🎤 **语音识别**：集成 FunASR 和 OpenAI Whisper，支持音频转文本
- 🔊 **语音合成**：集成 GPT-SoVITS 和 OpenAI TTS，支持文本转语音
- 🛠️ **工具系统**：支持为角色配置自定义工具
- 🔄 **中间件支持**：可扩展的中间件架构
- 💾 **持久化存储**：基于 SQLite 的数据存储，支持长期记忆和检查点
- 🌐 **前端界面**：基于 React + TypeScript + Vite 的现代化 Web 界面

## 技术栈

### 后端
- **Web 框架**：FastAPI
- **AI 框架**：LangChain、LangGraph
- **语音识别**：FunASR、OpenAI Whisper
- **语音合成**：GPT-SoVITS、OpenAI TTS
- **数据库**：SQLite
- **Python 版本**：3.12+

### 前端
- **框架**：React 19.2
- **语言**：TypeScript 5.8
- **构建工具**：Vite 6.2
- **UI 图标**：Lucide React

## 项目结构

```
.
├── api/                    # API 路由层
│   ├── routes/            # 路由模块
│   │   ├── characters.py  # 角色管理
│   │   ├── conversations.py # 会话管理
│   │   ├── messages.py    # 消息管理
│   │   ├── models.py      # 模型管理
│   │   ├── providers.py   # 供应商管理
│   │   ├── tts.py         # TTS 接口
│   │   └── health.py      # 健康检查
│   └── schemas.py         # API 数据模型
├── core/                  # 核心业务逻辑
│   ├── agent_manager.py   # Agent 管理器
│   ├── storage.py         # 应用存储
│   ├── store.py           # 长期记忆存储
│   ├── dependencies.py    # 依赖注入
│   ├── models/            # 模型管理
│   │   ├── factory.py     # 模型工厂
│   │   ├── provider.py    # 供应商实现
│   │   └── config.py      # 配置模型
│   ├── asr/               # 语音识别
│   │   └── factory.py     # ASR 工厂
│   ├── tts/               # 语音合成
│   │   └── factory.py     # TTS 工厂
│   ├── tools/             # 工具系统
│   │   ├── manager.py     # 工具管理器
│   │   └── registry.py    # 工具注册表
│   └── middleware/        # 中间件系统
│       └── manager.py     # 中间件管理器
├── config/                # 配置文件
│   ├── asr.yaml          # ASR 配置
│   └── tts.yaml          # TTS 配置
├── data/                  # 数据文件
│   ├── app.db            # 应用数据库
│   ├── checkpoints.db    # 检查点数据库
│   └── store.db          # 长期记忆数据库
├── asr_models/           # ASR 模型文件
├── tests/                # 测试文件
├── main.py               # 应用入口
└── requirements-api.txt  # 依赖列表
```

## 环境要求

### 系统要求
- **操作系统**：Windows / Linux / macOS
- **Python**：3.12 或更高版本
- **Node.js**：18.0 或更高版本（前端开发）
- **uv**：Python 包管理器（推荐）

### 必需依赖

#### Python 后端依赖
```bash
# 核心框架
fastapi>=0.115.0
uvicorn[standard]>=0.32.0

# AI 框架
langchain>=0.3.0
langchain-openai>=0.2.0
langchain-anthropic>=0.3.0
langchain-google-genai>=2.0.0
langchain-community>=0.3.0
langgraph>=0.2.0
langgraph-checkpoint-sqlite>=2.0.0

# 数据库
aiosqlite>=0.20.0

# 语音识别（可选）
funasr>=1.0.0  # FunASR
modelscope>=1.0.0  # FunASR 模型下载

# 其他工具
pyyaml>=6.0
python-dotenv>=1.0.0
```

#### 前端依赖
```bash
# 核心框架
react@19.2.0
react-dom@19.2.0

# 开发工具
vite@6.2.0
typescript@5.8.2
@vitejs/plugin-react@5.0.0

# UI 组件
lucide-react@0.555.0
```

## 快速开始

### 方式一：使用 uv（推荐）

#### 1. 安装 uv
```bash
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Linux / macOS
curl -LsSf https://astral.sh/uv/install.sh | sh
```

#### 2. 创建虚拟环境并安装依赖
```bash
# 创建虚拟环境
uv venv

# 激活虚拟环境
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

# 安装后端依赖
uv pip install fastapi uvicorn[standard] langchain langchain-openai langchain-anthropic langchain-google-genai langchain-community langgraph langgraph-checkpoint-sqlite aiosqlite pyyaml python-dotenv
```

#### 3. 配置环境变量
创建 `.env` 文件：
```env
# OpenAI API 密钥（可选）
OPENAI_API_KEY=sk-xxx

# 其他供应商的 API 密钥
ANTHROPIC_API_KEY=xxx
GOOGLE_API_KEY=xxx
DASHSCOPE_API_KEY=xxx  # 通义千问
```

#### 4. 配置 ASR 和 TTS（可选）
编辑 `config/asr.yaml` 和 `config/tts.yaml` 文件，配置你需要的语音服务。

如果需要使用 FunASR：
```bash
uv pip install funasr modelscope
```

#### 5. 启动后端服务
```bash
python main.py
```
服务将在 `http://localhost:8000` 启动。

#### 6. 启动前端（可选）
```bash
cd frontend
npm install
npm run dev
```
前端将在 `http://localhost:5173` 启动。

### 方式二：使用 pip

```bash
# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

# 安装依赖
pip install fastapi uvicorn[standard] langchain langchain-openai langchain-anthropic langchain-google-genai langchain-community langgraph langgraph-checkpoint-sqlite aiosqlite pyyaml python-dotenv

# 启动服务
python main.py
```

### 访问 API 文档

打开浏览器访问：
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 核心概念

### 供应商（Provider）

供应商是模型的提供方，系统支持：

- **内置供应商**：
  - `openai`: OpenAI GPT 系列
  - `anthropic`: Anthropic Claude 系列
  - `google`: Google Gemini 系列
  - `tongyi`: 阿里通义千问
  - `local`: 本地模型（Ollama）

- **自定义供应商**：
  - 任何 OpenAI 兼容的 API 都可以作为自定义供应商
  - 例如：DeepSeek、Moonshot、智谱 AI 等

### 模型（Model）

模型是具体的 AI 模型实例，每个模型属于一个供应商。模型分为两种类型：
- `text`: 文本生成模型（用于对话）
- `embedding`: 嵌入模型（用于向量化）

### 角色（Character）

角色是 AI Agent 的人格化配置，包含：
- 系统提示词（system_prompt）
- 默认使用的模型和供应商
- 绑定的工具列表
- 绑定的中间件列表

### 会话（Conversation）

会话是用户与角色的对话上下文，每个会话：
- 关联一个角色
- 维护独立的对话历史
- 可以切换使用不同的模型

### 消息（Message）

消息是会话中的单条对话记录，包含：
- 角色类型（user/assistant）
- 消息内容
- 时间戳

## API 使用示例

### 1. 创建供应商

```bash
# 创建 OpenAI 供应商
curl -X POST "http://localhost:8000/api/v1/providers" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "openai",
    "config_json": {
      "api_key": "sk-xxx",
      "base_url": "https://api.openai.com/v1"
    }
  }'

# 创建自定义供应商（DeepSeek）
curl -X POST "http://localhost:8000/api/v1/providers" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "deepseek",
    "config_json": {
      "api_key": "sk-xxx",
      "base_url": "https://api.deepseek.com/v1"
    }
  }'
```

### 2. 创建模型

```bash
curl -X POST "http://localhost:8000/api/v1/models" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "openai",
    "model_id": "gpt-4",
    "model_type": "text",
    "capabilities": ["chat"],
    "enabled": true
  }'
```

### 3. 创建角色

```bash
curl -X POST "http://localhost:8000/api/v1/characters" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "助手",
    "system_prompt": "你是一个友好的AI助手",
    "primary_model_id": "gpt-4",
    "primary_provider_id": "openai",
    "enabled": true
  }'
```

### 4. 创建会话

```bash
curl -X POST "http://localhost:8000/api/v1/conversations" \
  -H "Content-Type: application/json" \
  -d '{
    "character_id": 1,
    "title": "我的第一个会话"
  }'
```

### 5. 发送消息

```bash
curl -X POST "http://localhost:8000/api/v1/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": 1,
    "content": "你好！"
  }'
```

### 6. 语音转文本

```bash
curl -X POST "http://localhost:8000/api/v1/tts/audio-to-text" \
  -F "audio=@audio.wav" \
  -F "provider=funasr"
```

### 7. 文本转语音

```bash
curl -X POST "http://localhost:8000/api/v1/tts/text-to-audio" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，我是AI助手",
    "provider": "gpt_sovits"
  }' \
  --output output.wav
```

## 配置说明

### ASR 配置（config/asr.yaml）

```yaml
default_provider: funasr

providers:
  # FunASR (阿里达摩院) - 本地部署
  funasr:
    enabled: true
    model: ./asr_models/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch
    device: cuda  # 或 cpu
    vad_model: ./asr_models/speech_fsmn_vad_zh-cn-16k-common-pytorch
    punc_model: ./asr_models/punc_ct-transformer_zh-cn-common-vocab272727-pytorch
    language: zh
  
  # OpenAI Whisper - 云端 API
  openai:
    enabled: false
    api_key: ""  # 留空则从环境变量读取
    base_url: ""  # 可选，自定义 API 地址
    model: whisper-1
    language: ""  # 可选，如 zh, en
    temperature: 0.0
```

**FunASR 模型下载**：
```bash
# 使用 modelscope 下载模型
from modelscope import snapshot_download

# 下载 ASR 模型
snapshot_download('damo/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch', 
                  cache_dir='./asr_models')

# 下载 VAD 模型
snapshot_download('damo/speech_fsmn_vad_zh-cn-16k-common-pytorch',
                  cache_dir='./asr_models')

# 下载标点模型
snapshot_download('damo/punc_ct-transformer_zh-cn-common-vocab272727-pytorch',
                  cache_dir='./asr_models')
```

### TTS 配置（config/tts.yaml）

```yaml
default_provider: gpt_sovits

providers:
  # GPT-SoVITS - 本地部署
  gpt_sovits:
    enabled: true
    api_url: http://localhost:9880
    refer_wav_path: "path/to/reference.wav"  # 参考音频路径
    prompt_text: "参考文本"  # 参考音频对应的文本
    prompt_language: zh
    text_language: zh
  
  # OpenAI TTS - 云端 API
  openai:
    enabled: false
    api_key: ""
    base_url: ""
    model: tts-1  # 或 tts-1-hd
    voice: alloy  # alloy, echo, fable, onyx, nova, shimmer
    speed: 1.0
```

**GPT-SoVITS 部署**：
1. 从 [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) 下载并部署
2. 启动 API 服务（默认端口 9880）
3. 准备参考音频和对应文本

## 高级功能

### 动态模型参数

在发送消息时，可以动态覆盖模型参数：

```python
# 通过 API 暂不支持，需要在代码层面调用
agent_manager.send_message(
    user_message="你好",
    conversation_id=1,
    character_id=1,
    model_id="gpt-4",
    provider_id="openai",
    temperature=0.8,  # 动态参数
    max_tokens=1000   # 动态参数
)
```

### 工具绑定

为角色添加自定义工具，让 AI 能够调用外部功能。

### 中间件

通过中间件可以在消息处理前后添加自定义逻辑。

## 开发指南

### 添加新的供应商

1. 在 `core/models/provider.py` 中创建新的供应商类
2. 继承 `BaseProvider` 并实现必要的方法
3. 在 `ModelFactory._register_default_providers()` 中注册

### 添加新的工具

1. 在 `core/tools/` 中创建工具实现
2. 在 `ToolRegistry` 中注册工具
3. 通过 API 将工具绑定到角色

## 常见问题

### 1. 如何添加自定义 OpenAI 兼容供应商？

```bash
curl -X POST "http://localhost:8000/api/v1/providers" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "deepseek",
    "config_json": {
      "api_key": "sk-xxx",
      "base_url": "https://api.deepseek.com/v1"
    }
  }'
```

支持的自定义供应商包括：DeepSeek、Moonshot、智谱 AI、零一万物等。

### 2. 如何切换模型？

在发送消息时指定不同的 `model_id` 和 `provider_id` 即可。

### 3. 语音功能是必需的吗？

不是。ASR 和 TTS 功能是可选的，如果不需要可以不安装相关依赖。

### 4. 支持流式响应吗？

支持。API 提供了流式响应接口，可以实时获取 AI 的回复。

### 5. 数据存储在哪里？

所有数据存储在 `data/` 目录下的 SQLite 数据库中：
- `app.db`：应用数据（角色、会话、消息）
- `checkpoints.db`：对话历史检查点
- `store.db`：长期记忆存储

## 注意事项

- **Python 版本**：必须使用 Python 3.12 或更高版本
- **ASR 模型**：FunASR 模型文件需要单独下载并放置在 `asr_models/` 目录
- **GPT-SoVITS**：需要单独部署并配置 API 地址
- **数据库**：数据库文件会自动创建在 `data/` 目录
- **环境变量**：建议在生产环境中使用环境变量管理敏感信息（API 密钥等）
- **CUDA 支持**：如果使用 FunASR 的 GPU 加速，需要安装对应的 CUDA 和 PyTorch

## 项目架构

```
后端架构：
├── FastAPI (Web 框架)
├── LangChain (AI 框架)
├── LangGraph (Agent 编排)
└── SQLite (数据存储)

前端架构：
├── React (UI 框架)
├── TypeScript (类型安全)
└── Vite (构建工具)

数据流：
用户 → 前端 → FastAPI → AgentManager → LangChain/LangGraph → LLM → 响应
```

## 开发路线图

- [ ] 支持更多 LLM 供应商
- [ ] 增强工具系统
- [ ] 添加向量数据库支持
- [ ] 实现多模态输入（图片、视频）
- [ ] 优化前端交互体验
- [ ] 添加用户认证和权限管理
- [ ] 支持分布式部署

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
