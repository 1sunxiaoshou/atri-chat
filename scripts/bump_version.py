"""同步项目多处版本号。

用法示例:

    python scripts/bump_version.py 1.0.2
    python scripts/bump_version.py --check
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from scripts.common import (
        CARGO_TOML_PATH,
        PACKAGE_JSON_PATH,
        PYPROJECT_PATH,
        TAURI_CONF_PATH,
        collect_project_versions,
    )
except ModuleNotFoundError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from common import (
        CARGO_TOML_PATH,
        PACKAGE_JSON_PATH,
        PYPROJECT_PATH,
        TAURI_CONF_PATH,
        collect_project_versions,
    )


def collect_versions() -> dict[str, str]:
    return collect_project_versions()


def replace_once(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f"无法在 {path} 中定位待替换版本字段")
    path.write_text(updated, encoding="utf-8")


def update_pyproject(version: str) -> None:
    replace_once(
        PYPROJECT_PATH,
        r'(^version\s*=\s*")([^"]+)(")',
        rf"\g<1>{version}\g<3>",
    )


def update_package_json(version: str) -> None:
    text = PACKAGE_JSON_PATH.read_text(encoding="utf-8")
    data = json.loads(text)
    data["version"] = version
    PACKAGE_JSON_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_tauri_conf(version: str) -> None:
    text = TAURI_CONF_PATH.read_text(encoding="utf-8")
    data = json.loads(text)
    data["version"] = version
    TAURI_CONF_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_cargo_toml(version: str) -> None:
    replace_once(
        CARGO_TOML_PATH,
        r'(^version\s*=\s*")([^"]+)(")',
        rf"\g<1>{version}\g<3>",
    )


def validate_version_format(version: str) -> None:
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", version):
        raise ValueError(
            "版本号格式不合法，推荐使用语义化版本，例如 1.0.2 或 1.1.0-beta.1"
        )


def print_versions(versions: dict[str, str]) -> None:
    for name, value in versions.items():
        print(f"{name}: {value}")


def run_check() -> int:
    versions = collect_versions()
    print_versions(versions)
    unique_versions = set(versions.values())
    if len(unique_versions) == 1:
        print("\n版本一致性检查通过。")
        return 0

    print("\n版本不一致，请先执行版本同步。", file=sys.stderr)
    return 1


def bump_version(version: str) -> int:
    validate_version_format(version)

    update_pyproject(version)
    update_package_json(version)
    update_tauri_conf(version)
    update_cargo_toml(version)

    versions = collect_versions()
    print_versions(versions)
    print(
        "\n版本同步完成。"
        "\n建议下一步执行:"
        "\n  1. uv lock --check"
        "\n  2. uv run python scripts/release.py release --format all"
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="同步 ATRI Chat 多处版本号")
    parser.add_argument("version", nargs="?", help="要同步到的版本号，例如 1.0.2")
    parser.add_argument(
        "--check",
        action="store_true",
        help="只检查版本是否一致，不修改文件",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.check:
        return run_check()
    if not args.version:
        print("请提供目标版本号，或使用 --check 仅检查。", file=sys.stderr)
        return 1
    return bump_version(args.version)


if __name__ == "__main__":
    raise SystemExit(main())
