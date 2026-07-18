# ATRI Chat Agent Guide

## 项目定位

ATRI Chat 是 Windows 桌面优先的 AI 伴侣应用：

- 后端：Python 3.12+、FastAPI、LangChain/LangGraph、SQLite
- 前端：React 19、TypeScript、Vite、Tailwind CSS、React Three Fiber
- 桌面壳：Tauri v2 + Rust
- 打包：PyInstaller sidecar + Tauri bundle

## 文档入口

- 总览与导航：`README.md`、`docs/README.md`
- 当前系统事实：`docs/02-架构/系统设计.md`
- 命令系统：`docs/02-架构/命令系统.md`
- 未来计划：`docs/03-规划/路线图.md`

新增或修改说明时，优先更新现有 `docs/` 文档，不要创建重复主题文档。

## 分层约定

- `api/`：HTTP 路由、请求/响应 schema
- `core/`：后端业务逻辑、Agent、数据库、服务、工具
- `frontend/`：React UI、状态、VRM 渲染
- `frontend/src-tauri/`：桌面壳、后端进程管理、运行时目录
- `scripts/`：发布、版本、清理脚本
- `data/`：运行时数据和资源，通常不要当源码编辑

保持现有分层。除非任务明确要求，不做跨层大重构。

## 启动运行时契约

桌面模式下，Tauri 是运行时契约来源，并注入：

- `ATRI_BACKEND_PORT`
- `ATRI_RUNTIME_MODE`
- `ATRI_APP_ROOT`
- `ATRI_DATA_ROOT`

Python 从 `ATRI_RUNTIME_MODE` 派生 `app_env`，日志目录固定为 `data_root/logs`。不要重新引入跨进程的 `ATRI_APP_ENV` 或 `ATRI_LOGS_ROOT`，除非明确重设计启动契约。

## 高风险区域

修改这些位置前先读相关代码和架构文档：

- `main.py`
- `core/bootstrap.py`
- `core/config.py`
- `core/runtime_layout.py`
- `frontend/src-tauri/src/runtime_layout.rs`
- `frontend/src-tauri/src/backend.rs`
- `frontend/locales/`
- `core/agent/`
- `core/middleware/`
- `core/tools/`
- `core/tts/`
- `core/asr/`
- `frontend/components/vrm/`

UI 文案变更必须同步 locale，并运行 i18n 检查。

## 常用命令

后端：

```bash
uv sync
uv run main.py
uv run ruff check .
uv run black --check .
uv run pytest
```

前端：

```bash
npm install --prefix frontend
npm --prefix frontend run dev
npm --prefix frontend run type-check
npm --prefix frontend run lint
npm --prefix frontend run check-i18n
```

桌面与发布：

```bash
npm run tauri:dev
npm run tauri:build
uv run python scripts/release.py check
uv run python scripts/bump_version.py --check
```

## 验证原则

- 后端改动：至少跑相关 Python 检查；常规质量检查优先 `ruff`、`black --check`、`pytest`。
- 前端改动：优先跑 `type-check`、`lint`；改文案时跑 `check-i18n`。
- Tauri、启动、打包相关改动：优先跑 `scripts/release.py check`，可行时验证 `npm run tauri:dev`。
- 文档改动：做链接和 diff sanity check；无需运行代码测试时要说明。

## 工作规则

- 仓库可能有用户未提交改动；不要回滚不是自己做的修改。
- 不编辑生成物，除非任务明确要求：`data/`、`build/`、`dist/`、`release_package/`、`frontend/dist/`、`frontend/node_modules/`、`*.egg-info`、`__pycache__/`。
- 改 API 行为时，同时检查 FastAPI 路由和前端调用方。
- 改 prompts、memory、providers、TTS、ASR、VRM 前，先看 `docs/02-架构/`。
- README 保持高层概览；详细解释放 `docs/`。
