# ATRI Chat 开发与部署指南

欢迎贡献或部署 ATRI Chat。本说明旨在帮助你快速在本地搭建开发环境并进行构建。

## 🛠️ 前置要求

在开始之前，请确保你的系统已安装：
- **Python 3.12+** (推荐)
- **Node.js 18+**
- **Rust** 工具链 (用于 Tauri 构建)
- **FFmpeg** (用于音频编解码处理)
- [uv](https://github.com/astral-sh/uv) (强烈推荐，用于 Python 依赖管理)

---

## 🏃 快速启动 (开发模式)

### 1. 克隆并进入目录
```bash
git clone https://github.com/1sunxiaoshou/atri-chat.git
cd atri-chat
```

### 2. 后端服务 (FastAPI)
我们使用 `uv` 管理依赖，这会比 `pip` 快得多。
```bash
# 安装依赖并同步虚拟环境
uv sync

# 启动后端 (默认端口 9099)
python main.py
```

### 3. 前端界面 (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
访问控制台输出的地址即可开始调试。

---

## 📦 打包发布 (Production Build)

我们提供了一个统一的构建工具 `build.py`，它可以一键完成前端编译、后端打包、Tauri 客户端封装及 ZIP 发布包生成。

### 统一构建工具用法
```bash
# 查看所有可用选项
python build.py --help

# 执行完整流水线：环境检查 -> 后端打包 -> 前端构建 -> Tauri 编译 -> 生成发布 ZIP
python build.py --all

# 清理历史构建产物
python build.py --clean
```

### 构建产物说明
执行完成后，根目录会生成：
- `release_package/ATRI Chat/`：解压即用的绿色版文件夹。
- `ATRI_Chat_v1.0.0_Release.zip`：可直接发放给用户的发行包。

---

## 🏗️ 项目架构

- **`core/`**: 系统核心逻辑，包括 ASR, TTS, VRM 调度。
- **`api/`**: 暴露给前端的 RESTFUL 接口。
- **`frontend/`**: 基于 React 19 的单页应用。
- **`frontend/src-tauri/`**: Rust 壳程序，负责窗口管理及后端进程守护。
- **`data/`**: (运行时生成) 所有的用户数据、模型、配置均存放在此，实现真正的 Portable。

---

## 🤝 贡献规范
- 请遵循 `docs/` 下的各模块开发指南（如 VRM、记忆系统等）。
- 提交 PR 前请确保 `python build.py --check` 通过环境验证。
