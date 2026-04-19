"""运行时判定与目录约定。"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


APP_DIR_NAME = "ATRI-Chat"
PORTABLE_MARKER = "portable.mode"
BINARIES_DIR_NAME = "binaries"
RESOURCES_DIR_NAME = "resources"


class AppEnv(str, Enum):
    """应用环境。"""

    DEVELOPMENT = "development"
    PRODUCTION = "production"


class RuntimeMode(str, Enum):
    """桌面端运行模式。"""

    DEVELOPMENT = "development"
    INSTALLED = "installed"
    PORTABLE = "portable"


@dataclass(frozen=True)
class RuntimeLayout:
    """运行时判定结果。"""

    app_env: AppEnv
    mode: RuntimeMode
    app_root: Path
    data_root: Path
    logs_root: Path


def get_project_root() -> Path:
    """返回仓库根目录。"""
    return Path(__file__).resolve().parent.parent


def get_local_data_home() -> Path:
    """返回本地用户数据根目录。"""
    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        return Path(local_appdata).resolve() / APP_DIR_NAME
    return get_project_root()


def resolve_data_root(runtime_mode: RuntimeMode, app_root: Path) -> Path:
    """根据运行模式解析数据根目录。"""
    if runtime_mode == RuntimeMode.INSTALLED:
        return get_local_data_home() / "data"
    return app_root / "data"


def resolve_logs_root(runtime_mode: RuntimeMode, app_root: Path) -> Path:
    """根据运行模式解析日志根目录。"""
    if runtime_mode == RuntimeMode.INSTALLED:
        return get_local_data_home() / "logs"
    return app_root / "data" / "logs"


def resolve_runtime_layout() -> RuntimeLayout:
    """根据实际运行情况判定目录策略。"""
    if not getattr(sys, "frozen", False):
        app_root = get_project_root().resolve()
        mode = RuntimeMode.DEVELOPMENT
        return RuntimeLayout(
            app_env=AppEnv.DEVELOPMENT,
            mode=mode,
            app_root=app_root,
            data_root=resolve_data_root(mode, app_root).resolve(),
            logs_root=resolve_logs_root(mode, app_root).resolve(),
        )

    executable = Path(sys.executable).resolve()
    app_root = resolve_packaged_app_root(executable)
    mode = detect_packaged_mode(app_root)
    return RuntimeLayout(
        app_env=AppEnv.PRODUCTION,
        mode=mode,
        app_root=app_root,
        data_root=resolve_data_root(mode, app_root).resolve(),
        logs_root=resolve_logs_root(mode, app_root).resolve(),
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
