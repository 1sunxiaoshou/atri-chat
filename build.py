import zipfile
import argparse
import time
import subprocess
import shutil
import os
import sys
import stat
from pathlib import Path

# 检查是否安装了 psutil 用于清理进程
try:
    import psutil
except ImportError:
    psutil = None

# 设置 UTF-8 输出
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def get_project_version():
    """从 pyproject.toml 获取版本号"""
    try:
        with open("pyproject.toml", "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("version ="):
                    return line.split("=")[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return "1.0.0"

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

def remove_dir(path):
    """强力删除目录，处理只读文件锁"""
    p = Path(path)
    if not p.exists():
        return

    def on_error(func, path, exc_info):
        os.chmod(path, stat.S_IWRITE)
        func(path)

    for i in range(3):
        try:
            shutil.rmtree(p, onerror=on_error)
            return
        except Exception:
            time.sleep(0.5)

def kill_existing_processes():
    """清理正在运行的相关进程，避免文件锁"""
    if not psutil: return
    targets = ["ATRI Chat.exe", "atri-chat", "atri-backend"]
    for proc in psutil.process_iter(['name']):
        try:
            if any(t.lower() in proc.info['name'].lower() for t in targets):
                if proc.pid != os.getpid(): proc.kill()
        except Exception: continue
    time.sleep(0.5)

def run_command(cmd, cwd=None, env=None):
    """运行命令并实时输出"""
    current_env = os.environ.copy()
    if env: current_env.update(env)
    
    try:
        process = subprocess.Popen(
            cmd, cwd=cwd, env=current_env, shell=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace'
        )
        for line in process.stdout:
            print(line, end='')
        process.wait()
        return process.returncode == 0
    except Exception as e:
        print_error(f"执行出错: {e}")
        return False

def build_backend():
    """打包后端 (固定为 Onefile + UPX)"""
    print_step(1, "打包后端 (极致压缩单文件模式)")
    
    # 检查并安装 PyInstaller
    result = subprocess.run(["uv", "pip", "show", "pyinstaller"], capture_output=True)
    if result.returncode != 0:
        print("环境缺失 PyInstaller，正在自动安装...")
        run_command(["uv", "pip", "install", "pyinstaller"])
            
    # 执行打包
    if not run_command(["uv", "run", "pyinstaller", "atri-backend.spec", "--noconfirm"]):
        print_error("PyInstaller 打包失败")
        return False
    
    # Sidecar 处理
    binaries_dir = Path("frontend/src-tauri/binaries")
    binaries_dir.mkdir(parents=True, exist_ok=True)
    
    # 清理旧的 binaries 内容，保证纯粹性
    for item in binaries_dir.iterdir():
        if item.is_file(): item.unlink()
        elif item.is_dir(): remove_dir(item)
    
    target_name = "atri-backend-x86_64-pc-windows-msvc.exe"
    source = Path("dist/atri-backend.exe")
    
    if not source.exists():
        print_error("未找到打包后的后端文件")
        return False
    
    shutil.copy2(source, binaries_dir / target_name)
    print_success("后端 Sidecar 就绪")
    return True

def build_app(formats=None):
    """构建前端和 Tauri"""
    print_step(2, "构建应用全量资源")
    if not run_command(["npm", "run", "build"], cwd="frontend"): return False
    
    print("开始编译 Tauri...")
    bundles = []
    if formats and "installer" in formats: bundles.append("nsis")
    
    cmd = ["npm", "run", "tauri", "build"]
    if bundles: cmd.extend(["--", "--bundles", ",".join(bundles)])
    
    if not run_command(cmd, cwd="frontend"): return False
    return True

def collect_release(formats, version):
    """整理发布包"""
    print_step(3, "整理发布包")
    release_root = Path("release_package")
    remove_dir(release_root)
    release_root.mkdir(parents=True, exist_ok=True)
    
    tauri_release_dir = Path("frontend/src-tauri/target/release")
    bundle_dir = tauri_release_dir / "bundle"
    
    if "portable" in formats:
        print("正在创建便携版...")
        portable_dir = release_root / f"AtriChat_{version}_Portable_Folder"
        portable_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(tauri_release_dir / "atri-chat.exe", portable_dir / "ATRI Chat.exe")
        
        # 便携版只需要那个唯一的 sidecar exe
        bin_dir = portable_dir / "binaries"
        bin_dir.mkdir()
        shutil.copy2(Path("frontend/src-tauri/binaries/atri-backend-x86_64-pc-windows-msvc.exe"), 
                     bin_dir / "atri-backend-x86_64-pc-windows-msvc.exe")
        
        (portable_dir / "README.txt").write_text("ATRI Chat 便携版\n单文件绿色启动，数据保存在同级 data 目录。", encoding="utf-8")
        
        zip_name = f"AtriChat_{version}_Portable.zip"
        zip_path = release_root / zip_name
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in portable_dir.rglob("*"):
                zf.write(f, f.relative_to(portable_dir.parent))
        remove_dir(portable_dir) # 清理临时目录
        print_success(f"便携版 ZIP 已生成: {zip_name}")

    if "installer" in formats:
        print("正在搜寻安装程序...")
        setup_files = list((bundle_dir / "nsis").glob("*.exe")) + list((bundle_dir / "msi").glob("*.msi"))
        if not setup_files:
            print_warning("未发现安装程序")
        else:
            for setup in setup_files:
                ext = setup.suffix
                target_name = f"AtriChat_{version}_Setup{ext}"
                shutil.copy2(setup, release_root / target_name)
                print_success(f"安装程序已就绪: {target_name}")

def show_menu():
    print_header("ATRI Chat 构建管理中心")
    current_ver = get_project_version()

    print(f"{Colors.BOLD}1. 任务路径：{Colors.END}")
    print("   [1] 📂 完整打包 (生成全量发布包)")
    print("   [2] 🚀 仅打后端 (快速更新 Sidecar)")
    print("   [3] 🧹 深度清理")
    print("   [Q] 退出")
    print()
    choice = input(f"{Colors.BOLD}请选择 (1-3/Q): {Colors.END}").strip()
    if choice.upper() == 'Q': sys.exit(0)
    if choice == '3': return ["--clean"]
    if choice == '2': return ["--only-backend"]
    
    print(f"\n{Colors.BOLD}2. 发布版本：{Colors.END}")
    ver_input = input(f"   请输入版本号 [默认 {current_ver}]: ").strip()
    ver = ver_input if ver_input else current_ver

    print(f"\n{Colors.BOLD}3. 发布计划：{Colors.END}")
    print("   [1] 🌟 全量分发 (安装包 + 便携版)")
    print("   [2] 💿 仅安装版")
    print("   [3] 📦 仅便携版")
    f_choice = input(f"{Colors.BOLD}请选择 (1-3, 默认1): {Colors.END}").strip()
    fmt = {"1": "all", "2": "installer", "3": "portable"}.get(f_choice, "all")
    return ["--format", fmt, "--app-version", ver]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["all", "portable", "installer"], default="all")
    parser.add_argument("--only-backend", action="store_true")
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--app-version", help="指定发布版本号")
    
    args = parser.parse_args(show_menu()) if len(sys.argv) == 1 else parser.parse_args()
    
    if args.clean:
        kill_existing_processes()
        for d in ["build", "dist", "release_package", "frontend/src-tauri/target"]:
            print(f"清理: {d}")
            remove_dir(d)
        return

    # 确定版本号
    version = args.app_version if args.app_version else get_project_version()

    kill_existing_processes()
    print_header(f"ATRI Chat 生产流水线启动 (版本: {version})")
    start_time = time.time()
    
    if not build_backend(): sys.exit(1)
    if args.only_backend: return

    target_formats = ["portable", "installer"] if args.format == "all" else [args.format]
    if not build_app(formats=target_formats): sys.exit(1)
    collect_release(formats=target_formats, version=version)
    
    elapsed = time.time() - start_time
    print_header(f"构建成功! 耗时: {int(elapsed//60)}分 {int(elapsed%60)}秒")
    print(f"产出目录: {Path('release_package').absolute()}")
    input("\n按回车键回到菜单...")

if __name__ == "__main__":
    while True:
        try:
            main()
            if len(sys.argv) > 1: break # 命令行模式只跑一次
        except KeyboardInterrupt:
            sys.exit(0)
        except Exception as e:
            print_error(f"发生未预料的错误: {e}")
            input("按回车键重试...")
