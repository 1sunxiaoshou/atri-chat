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

**ATRI Chat** 是一个开源的桌面端 3D AI 伴侣项目。它融合了先进的大型语言模型（LLM）、端侧语音识别与合成（ASR/TTS）以及基于 VRM 标准的 3D 模型渲染与动作交互技术。致力于打破次元壁，为您提供一个真正私有、可感知、可进化的桌面数字伙伴。

---

## ✨ 核心特性

- 🧠 **多模型引擎驱动**：基于 LangChain 1.0 架构，无缝集成市面上主流的 AI 大模型供应商（OpenAI, Anthropic 等），同时完美支持直连本地 Ollama，保障数据绝对隐私。
- 🎭 **高度自定义角色**：内置角色编辑器，你可以自由定义 AI 的性格设定（Prompt）、背景故事、人物立绘与声音表现，捏出你的专属灵魂伴侣。
- 🎤 **离线极速语音识别 (ASR)**：内置阿里通义实验室开源的高性能 **SenseVoice** 模型（ONNX 版本），实现了纯 CPU 环境下也能拥有极低延迟、高精度的语音转文本体验。
- 🗣️ **丰富的语音合成 (TTS)**：原生集成多种 TTS 供应商接口（包含强大的 GPT-SoVITS 等），让你的 AI 伴侣拥有充满情感的拟真声线。
- 💾 **无损长期记忆系统**：不仅是即时问答，系统支持长短期记忆管理，能够将你们交流的日常点滴持久化存储在本地，打造真正“懂你”的伴侣。
- 💃 **3D 沉浸式互动**：深度集成 React Three Fiber，自由配置导入标准 VRM 格式模型与动作文件，实现真正的 3D 形象交互，让陪伴可视化。

---

## 📅 功能计划 (Roadmap)

我们正致力于让 ATRI Chat 变得更加聪明和有趣，以下是我们未来的开发计划：

- [x] 多 LLM 供应商接入与 LangGraph 记忆流机制
- [x] VRM 3D 模型的导入与基础动作驱动
- [x] SenseVoice 离线语音识别与多源 TTS 集成
- [ ] **obs推流**：可以将画面推送到obs
- [ ] **视觉感知能力 (Vision)**：支持屏幕捕获
- [ ] **Live2D 支持**：除了 3D，也将支持精美的 2D 动态模型
- [ ] **桌面挂件模式**：支持透明背景，让 AI 真正站在你的电脑桌面上
- [ ] **创意工坊 (Workshop)**：支持一键导入/分享社区玩家制作的角色卡、模型与动作预设
- [ ] **多平台适配**：在现有 Windows 基础之上，完善 macOS / Linux 端的打包与测试

---

## 🛠️ 技术栈

ATRI Chat 采用了目前最现代化的前后端分离跨端技术体系构建：

- **视窗前端**: React 19 + Tailwind CSS + Framer Motion (通过 `React Three Fiber` 驱动 3D 场景)
- **逻辑后端**: FastAPI + Python 3.12 + LangChain / LangGraph + aiosqlite
- **跨端容器**: Tauri (提供超越 Electron 的极致轻量化桌面体验与极速启动)
- **语音引擎**: SenseVoice-Small ONNX (高性能离线 ASR) + 支持多种 TTS 接口 (如 GPT-SoVITS 等)

---

## 🖼️ 界面预览


<img src=".github/images/chat-interface.png"> 
<img src=".github\images\3D模型.png"> 



## 🚀 获取与使用 (面向普通用户)

只需三步，即可零代码基础唤醒你的专属伴侣（*目前主要针对 Windows 用户*）：

1. 前往 [Releases](https://github.com/1sunxiaoshou/atri-chat/releases) 页面下载最新的发行版本。
2. 解压或安装后，运行目录下的 `ATRI Chat.exe`。
3. 在左下角「设置」中输入对应大模型的 API Key（或配置本地 Ollama 服务地址），即可开始交流！

---

## 💻 本地开发 (面向开发者)

我们提供了一键式的环境依赖检查与打包构建流。

### 1. 环境前置要求
- 操作系统：Windows 10 / 11
- 环境依赖：Python 3.12+ | Node.js 18+ | Rust 1.77+
- 包管理器：推荐安装 [uv](https://github.com/astral-sh/uv) (超快速的 Python 依赖管理工具)

### 2. 快速启动开发环境
```bash
# 克隆代码库
git clone https://github.com/1sunxiaoshou/atri-chat.git
cd atri-chat

# 可选：检查环境依赖与一键管理菜单
uv run build.py --clean  # 或直接运行 uv run build.py 进入交互式菜单

# 启动开发环境（自动并行启动前端 Vite 服务、后端 FastAPI 服务及 Tauri 视窗）
cd frontend
npm install
npm run tauri:dev
```

> [!TIP]
> 开发者如需手动打包便携版、安装包或进行二次分发，请参阅：
> **👉 [构建与打包工具指南 (BUILD_README.md)](BUILD_README.md)**
> **👉 [开发指南 (docs/DEVELOPMENT.md)](docs/DEVELOPMENT.md)**

---

## 📚 文档库

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

## 🤝 参与贡献

ATRI Chat 正处于快速迭代期，我们非常欢迎任何形式的开源贡献：包括但不限于提交 Bug 报告、优化前端性能、增加新的大模型支持、完善周边工具或补充文档。

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feat/AmazingFeature`)
3. 提交您的特性变更 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到您的个人仓库 (`git push origin feat/AmazingFeature`)
5. 新建并提交 Pull Request

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/image?repos=1sunxiaoshou/atri-chat&type=date&legend=top-left)](https://www.star-history.com/?repos=1sunxiaoshou%2Fatri-chat&type=date&legend=top-left)

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 协议开源。请自由使用，并在您的相关项目中遵循此协议开源共享。

---

<p align="center"><i>"毕竟我可是高性能的嘛！"<n></n> —— ATRI -My Dear Moments-</i></p>
```
