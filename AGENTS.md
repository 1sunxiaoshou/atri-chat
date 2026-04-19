# ATRI Chat Agent Guide

This file gives coding agents a compact, project-specific orientation for working in this repository.

## Project Snapshot

- Name: `ATRI Chat`
- Goal: a lightweight, private, customizable desktop AI companion with 3D VRM rendering, LLM chat, ASR, TTS, and long-term memory.
- Primary target: Windows desktop first, with Tauri as the shell.
- Stack:
  - Backend: Python 3.12+, FastAPI, LangChain/LangGraph, aiosqlite
  - Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Three Fiber
  - Desktop shell: Tauri v2 + Rust
  - Packaging: PyInstaller + Tauri bundle + release scripts in `scripts/`

## Source Of Truth

- Start with [README.md](/C:/Users/24352/Desktop/src/atri-chat/README.md) for project overview and high-level usage.
- Start with [docs/README.md](/C:/Users/24352/Desktop/src/atri-chat/docs/README.md) for detailed docs navigation.
- Prefer updating existing docs in `docs/` instead of creating new overlapping documents.

## Key Directories

- `main.py`: FastAPI app entrypoint, startup lifecycle, static mount, router registration.
- `api/`: HTTP routes and request/response schemas.
- `core/`: backend domain logic.
  - `core/db/`: DB init and persistence-related code
  - `core/services/`: application services
  - `core/repositories/`: repository layer
  - `core/prompts/`: prompt templates
  - `core/asr/`, `core/tts/`, `core/vrm/`: modality-specific logic
- `frontend/`: React app and Tauri desktop shell.
  - `frontend/src-tauri/`: Rust host app, process/runtime integration
  - `frontend/components/`, `frontend/pages/`, `frontend/store/`, `frontend/contexts/`: UI structure
  - `frontend/locales/`: i18n resources
- `scripts/`: release, cleanup, and version bump workflows.
- `docs/`: documentation center, architecture notes, and planning docs.
- `data/`: runtime-generated data, assets, configs, and user state. Treat as runtime state, not normal source code.

## Common Commands

### Backend

- Install/sync Python deps: `uv sync`
- Run backend locally: `uv run main.py`
- Default backend port: `9099`

### Frontend

- Install frontend deps: `npm install --prefix frontend`
- Run Vite dev server: `npm --prefix frontend run dev`
- Build frontend: `npm --prefix frontend run build`
- Type check: `npm --prefix frontend run type-check`
- Lint: `npm --prefix frontend run lint`
- Check i18n: `npm --prefix frontend run check-i18n`

### Desktop

- Run Tauri dev app from repo root: `npm run tauri:dev`
- Build desktop app from repo root: `npm run tauri:build`

### Release / Packaging

- Preflight checks: `uv run python scripts/release.py check`
- Interactive release flow: `uv run python scripts/release.py`
- Full release build: `uv run python scripts/release.py release --format all --app-version <version>`
- Bump/check version sync:
  - `uv run python scripts/bump_version.py <version>`
  - `uv run python scripts/bump_version.py --check`

## Working Agreements

- Preserve the current architecture split: `api/` for transport, `core/` for business logic, `frontend/` for UI, `frontend/src-tauri/` for desktop integration.
- Prefer small, local changes over cross-layer refactors unless the task clearly requires structural work.
- When changing API behavior, inspect both the FastAPI route in `api/routes/` and the corresponding frontend service or caller.
- When changing prompts, memory, providers, TTS, ASR, or VRM behavior, check `docs/02-架构/` first for the intended design.
- Keep documentation names and top-level doc structure consistent with the existing Chinese-first convention under `docs/`.

## Areas To Treat Carefully

- `main.py`: startup sequencing, directory initialization, logging setup, and route registration are tightly coupled.
- `core/config.py`, `core/runtime.py`, and Tauri runtime integration: changes here can affect dev mode, packaged mode, and data directory resolution.
- `frontend/src-tauri/`: desktop runtime and backend process management. Validate carefully after edits.
- `frontend/locales/`: if UI text changes, update locale files and run `check-i18n`.
- `data/`, `build/`, `dist/`, `release_package/`, `frontend/dist/`, `frontend/node_modules/`, `*.egg-info`, and `__pycache__/`: usually generated artifacts or runtime outputs. Do not edit them unless the task is specifically about build/runtime artifacts.

## Validation Expectations

- For backend-only changes, at minimum run the narrowest relevant check available:
  - `pytest` if tests exist for the touched area
  - otherwise a focused startup or import sanity check
- For frontend changes, prefer:
  - `npm --prefix frontend run type-check`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run check-i18n` when text or locale keys change
- For packaging, runtime, or Tauri integration changes, prefer:
  - `uv run python scripts/release.py check`
  - and, when feasible, `npm run tauri:dev`
- The test suite in this repository may be sparse. If no automated test exists, explicitly state what was verified manually and what remains unverified.

## Practical Notes For Future Agents

- The repo may contain unrelated in-progress user changes. Do not revert them unless explicitly asked.
- `README.md` is intentionally high-level. Detailed explanations should usually live in `docs/`.
- Root `package.json` is a convenience wrapper around `frontend/` scripts.
- Tauri dev uses `http://localhost:9900` as the frontend dev URL.
- FastAPI serves static assets from the directory resolved by settings as `/static`; avoid breaking asset path assumptions during refactors.

## Good First Reads By Task

- General feature work: [docs/01-入门/开发指南.md](/C:/Users/24352/Desktop/src/atri-chat/docs/01-入门/开发指南.md)
- System design questions: [docs/02-架构/系统架构.md](/C:/Users/24352/Desktop/src/atri-chat/docs/02-架构/系统架构.md)
- Memory-related changes: [docs/02-架构/记忆系统架构.md](/C:/Users/24352/Desktop/src/atri-chat/docs/02-架构/记忆系统架构.md)
- TTS changes: [docs/02-架构/TTS 架构.md](/C:/Users/24352/Desktop/src/atri-chat/docs/02-架构/TTS%20架构.md)
- Provider changes: [docs/02-架构/供应商系统.md](/C:/Users/24352/Desktop/src/atri-chat/docs/02-架构/供应商系统.md)
- Logging changes: [docs/02-架构/日志系统.md](/C:/Users/24352/Desktop/src/atri-chat/docs/02-架构/日志系统.md)
