"""运行时判定与目录约定。"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

APP_DIR_NAME = "ATRI-Chat"
PORTABLE_MARKER = "portable.mode"
BINARIES_DIR_NAME = "binaries"
RESOURCES_DIR_NAME = "resources"
RUNTIME_MODE_ENV = "ATRI_RUNTIME_MODE"
APP_ROOT_ENV = "ATRI_APP_ROOT"
DATA_ROOT_ENV = "ATRI_DATA_ROOT"


def normalize_windows_path(path: str | Path) -> Path:
    """移除 Windows verbatim 路径前缀，避免下游 SQLite/日志库兼容性问题。"""
    raw = str(path)
    if os.name == "nt":
        if raw.startswith("\\\\?\\UNC\\"):
            return Path("\\\\" + raw[8:])
        if raw.startswith("\\\\?\\"):
            return Path(raw[4:])
    return Path(raw)


def build_runtime_layout(
    mode: RuntimeMode,
    app_root: str | Path,
    data_root: str | Path,
) -> RuntimeLayout:
    """构造统一的运行时布局，并在入口处完成路径规整。"""
    return RuntimeLayout(
        mode=mode,
        app_root=normalize_windows_path(app_root).resolve(),
        data_root=normalize_windows_path(data_root).resolve(),
    )


class AppEnv(StrEnum):
    """应用环境。"""

    DEVELOPMENT = "development"
    PRODUCTION = "production"


class RuntimeMode(StrEnum):
    """桌面端运行模式。"""

    DEVELOPMENT = "development"
    INSTALLED = "installed"
    PORTABLE = "portable"


@dataclass(frozen=True)
class RuntimeLayout:
    """运行时判定结果。"""

    mode: RuntimeMode
    app_root: Path
    data_root: Path


def get_project_root() -> Path:
    """返回仓库根目录。"""
    return normalize_windows_path(Path(__file__).resolve().parent.parent)


def get_local_data_home() -> Path:
    """返回本地用户数据根目录。"""
    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        return normalize_windows_path(local_appdata).resolve() / APP_DIR_NAME
    return get_project_root()


def resolve_data_root(runtime_mode: RuntimeMode, app_root: Path) -> Path:
    """根据运行模式解析数据根目录。"""
    if runtime_mode == RuntimeMode.INSTALLED:
        return get_local_data_home() / "data"
    return app_root / "data"


def resolve_runtime_layout() -> RuntimeLayout:
    """根据实际运行情况判定目录策略。"""
    env_layout = resolve_runtime_layout_from_env()
    if env_layout is not None:
        return env_layout

    if not getattr(sys, "frozen", False):
        app_root = get_project_root().resolve()
        mode = RuntimeMode.DEVELOPMENT
        return build_runtime_layout(
            mode=mode,
            app_root=app_root,
            data_root=resolve_data_root(mode, app_root),
        )

    executable = normalize_windows_path(sys.executable).resolve()
    app_root = resolve_packaged_app_root(executable)
    mode = detect_packaged_mode(app_root)
    return build_runtime_layout(
        mode=mode,
        app_root=app_root,
        data_root=resolve_data_root(mode, app_root),
    )


def resolve_runtime_layout_from_env() -> RuntimeLayout | None:
    """优先使用桌面壳注入的运行时布局，确保前后端共享同一套目录策略。"""
    runtime_mode = os.environ.get(RUNTIME_MODE_ENV)
    app_root = os.environ.get(APP_ROOT_ENV)
    data_root = os.environ.get(DATA_ROOT_ENV)

    if not all([runtime_mode, app_root, data_root]):
        return None

    return build_runtime_layout(
        mode=RuntimeMode(runtime_mode),
        app_root=app_root,
        data_root=data_root,
    )


def resolve_packaged_app_root(executable: Path) -> Path:
    """根据打包产物位置反推出应用根目录。"""
    exe_dir = executable.parent
    if exe_dir.name.lower() != BINARIES_DIR_NAME:
        return exe_dir

    parent = exe_dir.parent
    if parent.name.lower() == RESOURCES_DIR_NAME and parent.parent:
        return parent.parent
    return parent


def detect_packaged_mode(app_root: Path) -> RuntimeMode:
    """根据打包目录结构判断安装版或便携版。"""
    if (app_root / PORTABLE_MARKER).exists():
        return RuntimeMode.PORTABLE
    return RuntimeMode.INSTALLED
