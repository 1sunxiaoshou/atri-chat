from __future__ import annotations

import argparse
import hashlib
import io
import os
import shutil
import stat
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

try:
    from scripts.common import (
        ROOT,
        TAURI_CONF_PATH,
        collect_project_versions,
        read_json,
        read_pyproject_version,
    )
except ModuleNotFoundError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from common import (
        ROOT,
        TAURI_CONF_PATH,
        collect_project_versions,
        read_json,
        read_pyproject_version,
    )

try:
    import psutil
except ImportError:
    psutil = None

RELEASE_SLUG = "atri-chat"
PLATFORM_TAG = "windows-x64"
SUPPORTED_FORMATS = ("installer", "portable")
DEFAULT_TAURI_TARGETS = ("nsis",)
FRONTEND_DIR = ROOT / "frontend"
TAURI_DIR = FRONTEND_DIR / "src-tauri"
TAURI_BINARIES_DIR = TAURI_DIR / "binaries"
RELEASE_PACKAGE_DIR = ROOT / "release_package"

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    END = "\033[0m"
    BOLD = "\033[1m"


@dataclass(frozen=True)
class ReleasePlan:
    version: str
    formats: tuple[str, ...]
    only_backend: bool = False


def print_header(msg):
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{msg.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*70}{Colors.END}\n")


def print_step(num, msg):
    print(f"{Colors.BOLD}{Colors.BLUE}[步骤 {num}] {msg}{Colors.END}")
    print(f"{Colors.BLUE}{'-'*70}{Colors.END}")


def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")


def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")


def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")


def get_project_version():
    try:
        return read_pyproject_version()
    except Exception:
        return "1.0.0"


def validate_version_consistency(expected_version: str):
    versions = collect_project_versions()
    mismatched = {
        name: version
        for name, version in versions.items()
        if version != expected_version
    }

    if mismatched:
        print_error("版本号不一致，已阻止构建。")
        print("请统一以下文件中的版本号：")
        for name, version in versions.items():
            print(f"  - {name}: {version}")
        print(f"预期发布版本: {expected_version}")
        return False

    print_success(f"版本一致性校验通过: {expected_version}")
    return True


def release_asset_name(version: str, kind: str, ext: str):
    return f"{RELEASE_SLUG}-{version}-{PLATFORM_TAG}-{kind}{ext}"


def checksum_asset_name(version: str):
    return f"{RELEASE_SLUG}-{version}-sha256sums.txt"


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_checksums(release_root: Path, version: str):
    checksum_path = release_root / checksum_asset_name(version)
    lines = []
    for file in sorted(
        p
        for p in release_root.iterdir()
        if p.is_file() and p.name != checksum_path.name
    ):
        lines.append(f"{sha256_file(file)}  {file.name}")
    checksum_path.write_text(
        "\n".join(lines) + ("\n" if lines else ""), encoding="utf-8"
    )
    print_success(f"校验文件已生成: {checksum_path.name}")


def remove_dir(path):
    p = Path(path)
    if not p.exists():
        return

    def on_error(func, err_path, exc_info):
        os.chmod(err_path, stat.S_IWRITE)
        func(err_path)

    for _ in range(3):
        try:
            shutil.rmtree(p, onerror=on_error)
            return
        except Exception:
            time.sleep(0.5)


def kill_existing_processes():
    if not psutil:
        return
    targets = ["ATRI Chat.exe", "atri-chat", "atri-backend"]
    for proc in psutil.process_iter(["name"]):
        try:
            proc_name = proc.info["name"] or ""
            if (
                any(t.lower() in proc_name.lower() for t in targets)
                and proc.pid != os.getpid()
            ):
                proc.kill()
        except Exception:
            continue
    time.sleep(0.5)


def run_command(cmd, cwd=None, env=None):
    current_env = os.environ.copy()
    if env:
        current_env.update(env)

    try:
        process = subprocess.Popen(
            cmd,
            cwd=str(cwd or ROOT),
            env=current_env,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        for line in process.stdout:
            print(line, end="")
        process.wait()
        return process.returncode == 0
    except Exception as exc:
        print_error(f"执行出错: {exc}")
        return False


def normalize_formats(format_arg: str):
    if format_arg == "all":
        return SUPPORTED_FORMATS
    if format_arg not in SUPPORTED_FORMATS:
        raise ValueError(f"不支持的发布格式: {format_arg}")
    return (format_arg,)


def ensure_pyinstaller():
    result = subprocess.run(
        ["uv", "pip", "show", "pyinstaller"], cwd=ROOT, capture_output=True
    )
    if result.returncode == 0:
        return True
    print("环境缺失 PyInstaller，正在自动安装...")
    return run_command(["uv", "pip", "install", "pyinstaller"])


def ensure_release_root():
    remove_dir(RELEASE_PACKAGE_DIR)
    RELEASE_PACKAGE_DIR.mkdir(parents=True, exist_ok=True)
    return RELEASE_PACKAGE_DIR


def copy_sidecar_to_binaries():
    TAURI_BINARIES_DIR.mkdir(parents=True, exist_ok=True)
    for item in TAURI_BINARIES_DIR.iterdir():
        if item.is_file():
            item.unlink()
        elif item.is_dir():
            remove_dir(item)

    target_name = "atri-backend-x86_64-pc-windows-msvc.exe"
    source_dir = ROOT / "dist" / "atri-backend"
    if not source_dir.exists():
        print_error("未找到打包后的后端目录产物")
        return False

    executable_found = False
    for item in source_dir.iterdir():
        target = TAURI_BINARIES_DIR / (
            target_name if item.name == "atri-backend.exe" else item.name
        )
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)
        if target.name == target_name:
            executable_found = True

    if not executable_found:
        print_error("未找到打包后的后端可执行文件")
        return False

    print_success("后端 Sidecar 目录已就绪")
    return True


def check_required_paths():
    required_paths = [
        ROOT / "atri-backend.spec",
        ROOT / "main.py",
        ROOT / "frontend/package.json",
        ROOT / "frontend/src-tauri/Cargo.toml",
        ROOT / "frontend/src-tauri/tauri.conf.json",
        ROOT / "frontend/src-tauri/portable.mode",
        ROOT / "frontend/src-tauri/nsis/custom_settings.nsh",
        ROOT / "frontend/src-tauri/icons/icon.ico",
        ROOT / "frontend/src-tauri/icons/32x32.png",
        ROOT / "frontend/src-tauri/icons/128x128.png",
        ROOT / "core/prompts/templates",
        ROOT / "core/models/providers.yaml",
    ]
    missing = [
        str(path.relative_to(ROOT)) for path in required_paths if not path.exists()
    ]
    if missing:
        print_error("以下关键打包资源缺失：")
        for path in missing:
            print(f"  - {path}")
        return False
    print_success("关键打包资源检查通过")
    return True


def check_tauri_release_config():
    try:
        tauri_config = read_json(TAURI_CONF_PATH)
    except Exception as exc:
        print_error(f"Tauri 配置读取失败: {exc}")
        return False

    bundle = tauri_config.get("bundle", {})
    targets = tuple(bundle.get("targets", []))
    product_name = tauri_config.get("productName")
    external_bin = tuple(bundle.get("externalBin", []))
    resources = tuple(bundle.get("resources", []))
    nsis = bundle.get("windows", {}).get("nsis", {})

    problems = []
    if product_name != "ATRI Chat":
        problems.append(f"productName 预期为 'ATRI Chat'，当前为 {product_name!r}")
    if targets != DEFAULT_TAURI_TARGETS:
        problems.append(
            f"bundle.targets 预期为 {list(DEFAULT_TAURI_TARGETS)!r}，当前为 {list(targets)!r}"
        )
    if "binaries/atri-backend" not in external_bin:
        problems.append("bundle.externalBin 缺少 'binaries/atri-backend'")
    if "binaries/*" not in resources:
        problems.append("bundle.resources 缺少 'binaries/*'")
    if nsis.get("installMode") != "currentUser":
        problems.append("NSIS installMode 预期为 'currentUser'")
    if nsis.get("displayLanguageSelector") is not False:
        problems.append("NSIS displayLanguageSelector 预期为 false")
    if nsis.get("installerHooks") != "nsis/custom_settings.nsh":
        problems.append("NSIS installerHooks 未指向 nsis/custom_settings.nsh")

    if problems:
        print_error("Tauri 发布配置与当前规范不一致：")
        for problem in problems:
            print(f"  - {problem}")
        return False

    print_success("Tauri 发布配置检查通过")
    return True


def check_uv_lock():
    print("正在校验 uv.lock ...")
    if run_command(["uv", "lock", "--check"]):
        print_success("uv.lock 校验通过")
        return True
    print_error("uv.lock 与 pyproject.toml 不一致")
    return False


def run_preflight_checks(expected_version: str):
    print_step(0, "执行发布前预检")
    checks = [
        ("版本一致性", lambda: validate_version_consistency(expected_version)),
        ("锁文件一致性", check_uv_lock),
        ("关键资源完整性", check_required_paths),
        ("Tauri 发布配置", check_tauri_release_config),
    ]

    failed = []
    for name, check in checks:
        print(f"\n[{name}]")
        if not check():
            failed.append(name)

    if failed:
        print_error("发布前预检失败")
        print("失败项目：")
        for name in failed:
            print(f"  - {name}")
        return False

    print_success("发布前预检全部通过")
    return True


def build_backend():
    print_step(1, "打包后端 (稳定 onedir 模式)")
    if not ensure_pyinstaller():
        print_error("PyInstaller 环境准备失败")
        return False
    if not run_command(
        ["uv", "run", "pyinstaller", "atri-backend.spec", "--noconfirm"]
    ):
        print_error("PyInstaller 打包失败")
        return False
    return copy_sidecar_to_binaries()


def build_app(formats=None):
    print_step(2, "构建应用全量资源")
    if not run_command(["npm", "run", "build"], cwd=FRONTEND_DIR):
        return False

    print("开始编译 Tauri...")
    bundles = []
    if formats and "installer" in formats:
        bundles.append("nsis")

    cmd = ["npm", "run", "tauri", "build"]
    if bundles:
        cmd.extend(["--", "--bundles", ",".join(bundles)])
    return run_command(cmd, cwd=FRONTEND_DIR)


def collect_installer_release(bundle_dir: Path, release_root: Path, version: str):
    print("正在搜寻安装程序...")
    installers = []
    target_dir = bundle_dir / "nsis"
    if target_dir.exists():
        installers.extend((setup, "setup") for setup in target_dir.glob("*.exe"))

    if not installers:
        print_warning("未发现安装程序")
        return

    for setup, kind in installers:
        target_name = release_asset_name(version, kind, setup.suffix)
        shutil.copy2(setup, release_root / target_name)
        print_success(f"安装程序已就绪: {target_name}")


def collect_portable_release(tauri_release_dir: Path, release_root: Path, version: str):
    print("正在创建便携版...")
    portable_basename = release_asset_name(version, "portable", "")
    portable_dir = release_root / portable_basename
    portable_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(tauri_release_dir / "atri-chat.exe", portable_dir / "ATRI Chat.exe")

    bin_dir = portable_dir / "binaries"
    shutil.copytree(TAURI_BINARIES_DIR, bin_dir)
    shutil.copy2(TAURI_DIR / "portable.mode", portable_dir / "portable.mode")

    (portable_dir / "README.txt").write_text(
        "ATRI Chat Portable Edition\n"
        "==========================\n"
        "\n"
        "启动方式:\n"
        "- 双击 ATRI Chat.exe\n"
        "\n"
        "便携版特性:\n"
        "- 无需安装，解压后即可运行\n"
        "- 所有运行数据都保存在当前目录内\n"
        "- 可直接复制到其他目录、移动硬盘或 U 盘使用\n"
        "\n"
        "数据位置:\n"
        "- 数据库: data/sqlite/\n"
        "- 资源文件: data/assets/\n"
        "- 模型文件: data/models/\n"
        "- 日志文件: data/logs/\n"
        "\n"
        "注意事项:\n"
        "- 请保持 ATRI Chat.exe、binaries/ 和 portable.mode 位于同一目录\n"
        "- portable.mode 是便携模式标记文件，请勿删除\n"
        "- 如需切换为安装版，请使用 Setup.exe\n",
        encoding="utf-8",
    )

    zip_name = release_asset_name(version, "portable", ".zip")
    zip_path = release_root / zip_name
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in portable_dir.rglob("*"):
            zf.write(file, file.relative_to(portable_dir.parent))
    remove_dir(portable_dir)
    print_success(f"便携版 ZIP 已生成: {zip_name}")


def collect_release(formats, version):
    print_step(3, "整理发布包")
    release_root = ensure_release_root()
    tauri_release_dir = TAURI_DIR / "target" / "release"
    bundle_dir = tauri_release_dir / "bundle"

    if "portable" in formats:
        collect_portable_release(tauri_release_dir, release_root, version)
    if "installer" in formats:
        collect_installer_release(bundle_dir, release_root, version)

    write_checksums(release_root, version)


def execute_release(plan: ReleasePlan):
    if not run_preflight_checks(plan.version):
        return False

    kill_existing_processes()
    print_header(f"ATRI Chat 生产流水线启动 (版本: {plan.version})")
    start_time = time.time()

    if not build_backend():
        return False
    if plan.only_backend:
        return True
    if not build_app(formats=plan.formats):
        return False

    collect_release(formats=plan.formats, version=plan.version)
    elapsed = time.time() - start_time
    print_header(f"构建成功! 耗时: {int(elapsed//60)}分 {int(elapsed%60)}秒")
    print(f"产出目录: {RELEASE_PACKAGE_DIR.absolute()}")
    return True


def show_menu():
    print_header("ATRI Chat 构建管理中心")
    current_ver = get_project_version()

    print(f"{Colors.BOLD}1. 任务路径：{Colors.END}")
    print("   [1] 📂 完整打包 (生成全量发布包)")
    print("   [2] 🚀 仅打后端 (快速更新 Sidecar)")
    print("   [3] 🔎 发布前预检")
    print("   [4] 🧹 深度清理")
    print("   [Q] 退出")
    print()
    choice = input(f"{Colors.BOLD}请选择 (1-4/Q): {Colors.END}").strip()
    if choice.upper() == "Q":
        sys.exit(0)
    if choice == "4":
        return ["clean"]
    if choice == "3":
        return ["check"]
    if choice == "2":
        return ["backend"]

    print(f"\n{Colors.BOLD}2. 发布版本：{Colors.END}")
    ver_input = input(f"   请输入版本号 [默认 {current_ver}]: ").strip()
    ver = ver_input if ver_input else current_ver

    print(f"\n{Colors.BOLD}3. 发布计划：{Colors.END}")
    print("   [1] 🌟 全量分发 (安装包 + 便携版)")
    print("   [2] 💿 仅安装版")
    print("   [3] 📦 仅便携版")
    f_choice = input(f"{Colors.BOLD}请选择 (1-3, 默认1): {Colors.END}").strip()
    fmt = {"1": "all", "2": "installer", "3": "portable"}.get(f_choice, "all")
    return ["release", "--format", fmt, "--app-version", ver]


def build_parser():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")

    release_parser = subparsers.add_parser("release", help="构建正式发布产物")
    release_parser.add_argument(
        "--format", choices=["all", "portable", "installer"], default="all"
    )
    release_parser.add_argument("--app-version", help="指定发布版本号")

    subparsers.add_parser("backend", help="仅构建并刷新后端 sidecar")
    check_parser = subparsers.add_parser("check", help="执行发布前预检")
    check_parser.add_argument("--app-version", help="指定预检目标版本号")
    subparsers.add_parser("clean", help="清理构建产物")
    return parser


def main(argv: list[str] | None = None):
    parser = build_parser()
    args = (
        parser.parse_args(show_menu())
        if argv is None and len(sys.argv) == 1
        else parser.parse_args(argv)
    )
    command = args.command or "release"

    if command == "clean":
        kill_existing_processes()
        for directory in [
            ROOT / "build",
            ROOT / "dist",
            RELEASE_PACKAGE_DIR,
            TAURI_DIR / "target",
        ]:
            print(f"清理: {directory.relative_to(ROOT)}")
            remove_dir(directory)
        return 0

    version = getattr(args, "app_version", None) or get_project_version()
    if command == "check":
        return 0 if run_preflight_checks(version) else 1

    plan = ReleasePlan(
        version=version,
        formats=normalize_formats(getattr(args, "format", "all")),
        only_backend=(command == "backend"),
    )
    return 0 if execute_release(plan) else 1


if __name__ == "__main__":
    while True:
        try:
            raise SystemExit(main())
        except KeyboardInterrupt:
            raise SystemExit(0) from None
        except Exception as exc:
            print_error(f"发生未预料的错误: {exc}")
            input("按回车键重试...")
