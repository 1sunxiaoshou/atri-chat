from __future__ import annotations

import json
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

PYPROJECT_PATH = ROOT / "pyproject.toml"
PACKAGE_JSON_PATH = ROOT / "frontend" / "package.json"
TAURI_CONF_PATH = ROOT / "frontend" / "src-tauri" / "tauri.conf.json"
CARGO_TOML_PATH = ROOT / "frontend" / "src-tauri" / "Cargo.toml"

VERSION_FILES = {
    "pyproject.toml": PYPROJECT_PATH,
    "frontend/package.json": PACKAGE_JSON_PATH,
    "frontend/src-tauri/tauri.conf.json": TAURI_CONF_PATH,
    "frontend/src-tauri/Cargo.toml": CARGO_TOML_PATH,
}


def read_pyproject() -> dict:
    with PYPROJECT_PATH.open("rb") as f:
        return tomllib.load(f)


def read_pyproject_version() -> str:
    return read_pyproject()["project"]["version"]


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def read_json_version(path: Path) -> str:
    return read_json(path)["version"]


def read_cargo_toml() -> dict:
    with CARGO_TOML_PATH.open("rb") as f:
        return tomllib.load(f)


def read_cargo_version() -> str:
    return read_cargo_toml()["package"]["version"]


def collect_project_versions() -> dict[str, str]:
    return {
        "pyproject.toml": read_pyproject_version(),
        "frontend/package.json": read_json_version(PACKAGE_JSON_PATH),
        "frontend/src-tauri/tauri.conf.json": read_json_version(TAURI_CONF_PATH),
        "frontend/src-tauri/Cargo.toml": read_cargo_version(),
    }
