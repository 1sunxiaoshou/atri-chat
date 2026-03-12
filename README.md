# ATRI Chat

<div align="center">

<img src=".github/images/atri.png" alt="ATRI Mascot" width="280">

**极度便携 · 深度交互 · 你的专属 3D AI 桌面伴侣**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-Desktop-FFC107?logo=tauri&logoColor=white)](https://tauri.app/)

[功能特性](#核心特性) | [获取使用](#获取与使用-面向普通用户) | [本地开发](#本地开发-面向开发者) | [文档库](#文档库)

</div>

<br>

**ATRI Chat** 是一个开源的桌面端 3D AI 伴侣项目。它融合了先进的大型语言模型（LLM）、端侧语音识别与合成（ASR/TTS）以及基于 VRM 标准的 3D 模型渲染与动作交互技术。致力于打破次元壁，为您提供一个真正私有、可感知、可进化的桌面伙伴。

---

## 核心特性

### 极度便携与数据隐私
- **全绿色免安装与沙盒隔离**：只需一个文件夹，解压即用。聊天记录、角色配置、离线 AI 模型均完全储存在程序同级目录的 `data` 中，绝不污染系统路径或注册表。
- **一键热迁移**：你可以将整个文件夹装进 U 盘，随时随地在任何 Windows 设备上唤醒你的 AI 伴侣。

### 沉浸式视听交互
- **原生 3D VRM 形象支持**：完美支持物理渲染、动态表情控制及自动口型同步（Lip-sync）。
- **情绪具身感知**：角色不仅有生动的语音输出，还会根据对话的上下文和情感反馈，自动展现出不同的神态与动作变化。

### 强大的 AI 驱动引擎
- **多模型供应商与自由切换**：原生集成 OpenAI, Anthropic, Gemini, 阿里通义千问，以及本地离线模型（基于 Ollama）。
- **长期记忆与 Tool Calling**：基于 LangGraph 和 SQLite 构建的长短期记忆工作流。她不仅能记住你的喜好，还能通过生态插件帮你处理本地文件等实际事务。

---

## 技术栈

ATRI Chat 采用了目前最现代化的前后端技术体系构建：

- **视窗前端**: React 19 + Tailwind CSS + Framer Motion (通过 `React Three Fiber` 驱动 3D 场景)
- **逻辑后端**: FastAPI + Python 3.12 + LangChain / LangGraph + aiosqlite
- **跨端容器**: Tauri (提供超越 Electron 的极致轻量化桌面体验)
- **语音引擎**: SenseVoice-Small ONNX (高性能离线 ASR) + 支持多种 TTS 接口 (如 GPT-SoVITS 等)

---

## 界面预览

| 聊天交互流 | VRM 三维沉浸 |
| :---: | :---: |
| <img src=".github/images/chat-interface.png" alt="对话界面"> | <img src=".github/images/vrm-mode.png" alt="VRM 交互"> |

---

## 获取与使用 (面向普通用户)

只需三步，即可零代码基础唤醒你的专属伴侣：

1. 前往 [Releases](https://github.com/1sunxiaoshou/atri-chat/releases) 页面下载最新的发行版本。
2. 解压或安装后，运行目录下的 `ATRI Chat.exe`。
3. 在左下角「设置」中输入对应大模型的 API Key（也可以直连本地 Ollama），即可开始交流！

---

## 本地开发 (面向开发者)

我们提供了一键式的环境依赖检查与打包构建流。

### 1. 环境前置要求
- Windows 10 / 11
- Python 3.12+ 
- Node.js 18+
- Rust 1.77+
- [uv](https://github.com/astral-sh/uv) (超快速的 Python 包管理器)

### 2. 快速启动开发环境
```bash
# 克隆代码库
git clone https://github.com/1sunxiaoshou/atri-chat.git
cd atri-chat

# 可选：检查环境依赖与一键管理菜单
uv run build.py --check

# 启动开发环境（自动启动前端 Vite 服务、后端 FastAPI 服务及 Tauri 视窗）
cd frontend
npm install
npm run tauri:dev
```

> [!TIP]
> 开发者如需手动打包便携版、安装包或进行二次分发，请参阅：
> **👉 [构建与打包工具指南 (BUILD_README.md)](BUILD_README.md)**
> **👉 [开发指南 (docs/DEVELOPMENT.md)](docs/DEVELOPMENT.md)**

---

## 文档库

想要深入了解 ATRI Chat 的底层架构设计与交互规范，请查阅以下内容：

- **核心设计**
  - [记忆系统架构](docs/记忆系统架构.md) - 长短期记忆与 LangGraph 工作流
  - [供应商系统说明](docs/供应商系统说明.md) - LLM 接入规范
  - [日志系统设计](docs/日志系统.md)
- **3D 与交互**
  - [VRM 使用指南](docs/VRM使用指南.md)
  - [VRM 动作与 API 规范](docs/VRM动作API.md)
  - [VRM + R3F 开发指南](docs/VRM-R3F-开发指南.md)
  - [VRM + R3F Hooks 使用规范](docs/VRM-R3F-Hooks使用规范.md)
  - [VRM + R3F 进阶技巧](docs/VRM-R3F-进阶技巧.md)
- **语音模块**
  - [TTS 架构说明](docs/TTS架构.md)
- **界面与国际化**
  - [i18n 脚本规范](docs/i18n-scripts.md)

---

## 参与贡献

ATRI Chat 正处于快速迭代期，我们非常欢迎任何形式的贡献：包括但不限于提交 Bug 报告、优化前端性能、增加新的大模型支持或完善周边工具。

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feat/AmazingFeature`)
3. 提交您的特性变更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到您的个人仓库 (`git push origin feat/AmazingFeature`)
5. 新建并提交 Pull Request

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=1sunxiaoshou/atri-chat&type=Date)](https://star-history.com/#1sunxiaoshou/atri-chat&Date)

---

## 许可证

本项目基于 [MIT License](LICENSE) 协议开源。请自由使用并在您的相关项目中遵循此协议开源共享。

---

<p align="center"><i>"既然是机器人，就应该更有机器人的样子吧？"</i></p>
