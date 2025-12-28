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
- **3D 渲染**：Three.js + @pixiv/three-vrm
- **Markdown 渲染**：react-markdown + rehype-highlight

## 项目结构

### 后端结构

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
│   │   ├── asr.py         # ASR 接口
│   │   ├── vrm.py         # VRM 模型管理
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
│   │   ├── base.py        # ASR 基类
│   │   ├── factory.py     # ASR 工厂
│   │   ├── funasr.py      # FunASR 实现
│   │   └── openai_whisper.py # Whisper 实现
│   ├── tts/               # 语音合成
│   │   ├── base.py        # TTS 基类
│   │   ├── factory.py     # TTS 工厂
│   │   └── gpt_sovits.py  # GPT-SoVITS 实现
│   ├── vrm/               # VRM 模型处理
│   │   ├── audio_generator.py # 音频生成
│   │   ├── audio_manager.py   # 音频管理
│   │   ├── markup_parser.py   # 标记解析
│   │   └── vrm_service.py     # VRM 服务
│   ├── tools/             # 工具系统
│   │   └── memory_tools.py # 记忆工具
│   ├── middleware/        # 中间件系统
│   │   └── logging_middleware.py # 日志中间件
│   └── utils/             # 工具函数
│       └── file_naming.py # 文件命名工具
├── config/                # 配置文件
│   ├── asr.yaml          # ASR 配置
│   └── tts.yaml          # TTS 配置
├── data/                  # 数据文件
│   ├── app.db            # 应用数据库
│   ├── checkpoints.db    # 检查点数据库
│   ├── store.db          # 长期记忆数据库
│   └── uploads/          # 上传文件目录
│       ├── avatars/      # 角色头像
│       ├── vrm_models/   # VRM 模型文件
│       ├── vrm_animations/ # VRM 动画文件
│       ├── vrm_audio/    # VRM 音频文件
│       └── vrm_thumbnails/ # VRM 缩略图
├── asr_models/           # ASR 模型文件
├── tests/                # 测试文件
├── main.py               # 应用入口
└── pyproject.toml        # 项目配置
```

### 前端结构（优化后）

```
frontend/
├── components/           # UI 组件
│   ├── admin/           # 管理后台组件
│   │   ├── AdminCharacters.tsx  # 角色管理
│   │   ├── AdminModels.tsx      # 模型管理
│   │   ├── AdminProviders.tsx   # 供应商管理
│   │   ├── AdminVRM.tsx         # VRM 管理
│   │   └── AdminDashboard.tsx   # 仪表盘
│   ├── chat/            # 聊天相关组件
│   │   ├── ChatInterface.tsx    # 主聊天界面
│   │   ├── ChatHeader.tsx       # 聊天头部
│   │   ├── MessageList.tsx      # 消息列表
│   │   ├── MessageItem.tsx      # 单条消息
│   │   ├── ChatInput.tsx        # 输入框
│   │   ├── VRMViewer.tsx        # VRM 查看器
│   │   └── ModelConfigPopover.tsx # 模型配置弹窗
│   ├── settings/        # 设置相关组件
│   │   ├── SettingsModal.tsx    # 设置模态框
│   │   ├── GeneralSettings.tsx  # 通用设置
│   │   ├── ASRSettings.tsx      # ASR 设置
│   │   ├── TTSSettings.tsx      # TTS 设置
│   │   └── ProviderSettingsTemplate.tsx # 供应商设置模板
│   ├── ui/              # 通用 UI 组件
│   │   ├── Button.tsx   # 按钮组件
│   │   ├── Input.tsx    # 输入框组件
│   │   ├── Select.tsx   # 选择器组件
│   │   └── Modal.tsx    # 模态框组件
│   ├── Sidebar.tsx      # 侧边栏
│   ├── Toast.tsx        # 提示组件
│   └── AvatarEditor.tsx # 头像编辑器
├── contexts/            # React Context
│   ├── ThemeContext.tsx    # 主题上下文
│   ├── LanguageContext.tsx # 语言上下文
│   └── ASRContext.tsx      # ASR 上下文
├── hooks/               # 自定义 Hooks
│   ├── useChat.ts          # 聊天逻辑
│   ├── useVRM.ts           # VRM 逻辑
│   ├── useTTS.ts           # TTS 逻辑
│   ├── useAudioRecorder.ts # 录音逻辑
│   ├── useSettings.ts      # 设置逻辑
│   └── index.ts            # 统一导出
├── services/            # 服务层
│   ├── api/            # API 服务（按业务领域拆分）
│   │   ├── base.ts         # 基础 HTTP 客户端
│   │   ├── providers.ts    # Provider API
│   │   ├── models.ts       # Model API
│   │   ├── characters.ts   # Character API
│   │   ├── conversations.ts # Conversation API
│   │   ├── messages.ts     # Message API
│   │   ├── vrm.ts          # VRM API
│   │   ├── asr.ts          # ASR API
│   │   ├── tts.ts          # TTS API
│   │   └── index.ts        # 统一导出
│   └── storage.ts      # 本地存储服务
├── utils/               # 工具函数
│   ├── constants.ts        # 常量定义
│   ├── helpers.ts          # 辅助函数
│   ├── logger.ts           # 日志工具
│   ├── vrmLoader.ts        # VRM 加载器
│   ├── vrmTimedPlayer.ts   # VRM 定时播放器
│   ├── vrmMarkupParser.ts  # VRM 标记解析器
│   ├── streamTTSPlayer.ts  # 流式 TTS 播放器
│   ├── pcmStreamPlayer.ts  # PCM 流播放器
│   ├── audioCache.ts       # 音频缓存
│   ├── animationTransition.ts # 动画过渡
│   └── markdownConfig.tsx  # Markdown 配置
├── types.ts             # TypeScript 类型定义
├── App.tsx              # 应用主组件
├── index.tsx            # 应用入口
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── eslint.config.js     # ESLint 配置
└── package.json         # 依赖配置
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
