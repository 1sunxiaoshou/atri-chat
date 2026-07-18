# ATRI Chat

<div align="center">

<img src=".github/images/atri.png" alt="ATRI Mascot" width="280">

**Windows 桌面优先、私有、可定制的 3D AI 伴侣**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-Desktop-FFC107?logo=tauri&logoColor=white)](https://tauri.app/)

[项目概览](#项目概览) | [功能特性](#功能特性) | [获取使用](#获取与使用) | [本地开发](#本地开发) | [文档中心](#文档中心)

</div>

## 项目概览

ATRI Chat 是一个开源的桌面端 3D AI 伴侣项目，整合了大语言模型、语音识别、语音合成与 VRM 3D 渲染能力，目标是提供一个本地优先、可长期使用、可持续扩展的数字伙伴。

---

## 功能特性

- **多模型驱动**：支持主流云端模型与本地 Ollama，兼顾能力和隐私。
- **角色可定制**：支持角色设定、立绘、语音和模型配置。
- **离线语音识别**：集成 SenseVoice ONNX，支持低延迟本地识别。
- **多供应商语音合成**：支持多种 TTS 服务与角色绑定。
- **长期记忆**：支持结构化的长短期记忆管理。
- **3D 互动**：基于 React Three Fiber 与 VRM 的实时渲染和动作驱动。

---

## 开发路线

当前开发优先保证 Windows 桌面主链的安全、数据正确性和运行可靠性，再继续完善 VRM 与产品体验。已经决定推进、暂缓或停止的事项统一记录在 [路线图](docs/03-规划/路线图.md)；README 不维护第二份功能清单。

---

## 技术栈

ATRI Chat 采用了目前最现代化的前后端分离跨端技术体系构建：

- **视窗前端**: React 19 + Tailwind CSS（通过 `React Three Fiber` 驱动 3D 场景）
- **逻辑后端**: FastAPI + Python 3.12 + LangChain / LangGraph + aiosqlite
- **桌面容器**: Tauri（负责窗口、运行时目录和 Python sidecar 生命周期）
- **语音引擎**: SenseVoice-Small ONNX (高性能离线 ASR) + 支持多种 TTS 接口 (如 GPT-SoVITS 等)

---

## 界面预览


<img src=".github/images/chat-interface.png"> 
<img src=".github/images/3D模型.png"> 



## 获取与使用

只需三步，即可零代码基础唤醒你的专属伴侣（*目前主要针对 Windows 用户*）：

1. 前往 [Releases](https://github.com/1sunxiaoshou/atri-chat/releases) 页面下载最新的发行版本。
2. 解压或安装后，运行目录下的 `ATRI Chat.exe`。
3. 在左下角「设置」中输入对应大模型的 API Key（或配置本地 Ollama 服务地址），即可开始交流！

---

## 本地开发

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

# 可选：检查发布前状态或打开发布脚本菜单
uv run python scripts/release.py check
# 或直接运行 uv run python scripts/release.py 进入交互式菜单

# 启动开发环境（自动并行启动前端 Vite 服务、后端 FastAPI 服务及 Tauri 视窗）
cd frontend
npm install
npm run tauri:dev
```

> [!TIP]
> 更完整的开发、构建和发布说明请查看：
> [开发指南](docs/01-入门/开发指南.md)
> [桌面构建与发布指南](docs/01-入门/桌面构建与发布指南.md)

---

## 文档中心

项目文档已经统一整理到 `docs/`，推荐从 [文档中心](docs/README.md) 开始：

- 入门文档：开发指南、桌面构建与发布指南、国际化脚本指南
- 架构文档：系统设计、命令系统、记忆系统架构、供应商系统、TTS 架构、日志系统
- 规划文档：[路线图](docs/03-规划/路线图.md)、[架构审计与重构建议](docs/03-规划/架构审计与重构建议.md)、[未来改造参考](docs/03-规划/未来改造参考.md)
- 历史复盘：[ATRI vNext：一次做通、推倒与重新开始](docs/03-规划/一次失败的教训.md)

---

## 参与贡献

ATRI Chat 正处于快速迭代期，我们非常欢迎任何形式的开源贡献：包括但不限于提交 Bug 报告、优化前端性能、增加新的大模型支持、完善周边工具或补充文档。

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feat/AmazingFeature`)
3. 提交您的特性变更 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到您的个人仓库 (`git push origin feat/AmazingFeature`)
5. 新建并提交 Pull Request

---

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=1sunxiaoshou/atri-chat&type=date&legend=top-left)](https://www.star-history.com/?repos=1sunxiaoshou%2Fatri-chat&type=date&legend=top-left)

---

## 许可证

本项目基于 [MIT License](LICENSE) 协议开源。请自由使用，并在您的相关项目中遵循此协议开源共享。

---

<p align="center"><i>"毕竟我可是高性能的嘛！"<n></n> —— ATRI -My Dear Moments-</i></p>
