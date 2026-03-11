"""
ATRI Chat 统一打包工具
提供交互式命令行界面，支持一键构建前端、后端、Tauri 客户端，并生成免安装发行版压缩包。
"""
import subprocess
import sys
import shutil
import zipfile
from pathlib import Path
import time
import argparse

# 设置 UTF-8 输出
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


class Colors:
    """终端颜色"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'


def print_header(text):
    """打印标题"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'=' * 70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text:^70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'=' * 70}{Colors.END}\n")


def print_step(step, message):
    """打印步骤"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}[步骤 {step}] {message}{Colors.END}")
    print(f"{Colors.BLUE}{'-' * 70}{Colors.END}\n")


def print_success(message):
    """打印成功消息"""
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")


def print_error(message):
    """打印错误消息"""
    print(f"{Colors.RED}✗ {message}{Colors.END}")


def print_warning(message):
    """打印警告消息"""
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")


def run_command(cmd, cwd=None, shell=True, silent=False):
    """运行命令"""
    try:
        if silent:
            result = subprocess.run(
                cmd,
                shell=shell,
                cwd=cwd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            return result.returncode == 0
        else:
            process = subprocess.Popen(
                cmd,
                shell=shell,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            
            for line in process.stdout:
                print(line, end='')
            
            process.wait()
            return process.returncode == 0
    except Exception as e:
        print_error(f"执行出错: {e}")
        return False


def check_environment():
    """检查环境"""
    print_step(0, "检查环境")
    
    checks = {
        "Python": ["python", "--version"],
        "uv": ["uv", "--version"],
        "Node.js": ["node", "--version"],
        "npm": ["npm", "--version"],
        "Rust": ["cargo", "--version"],
    }
    
    all_ok = True
    for name, cmd in checks.items():
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if result.returncode == 0:
                version = result.stdout.strip().split('\n')[0]
                print_success(f"{name}: {version}")
            else:
                print_error(f"{name}: 未安装")
                all_ok = False
        except:
            print_error(f"{name}: 未安装")
            all_ok = False
    
    return all_ok


def clean_build():
    """清理构建文件"""
    print_step("Clean", "清理构建文件")
    
    dirs_to_clean = [
        "build",
        "dist",
        "release_package",
        "frontend/src-tauri/target",
    ]
    
    files_to_clean = [
        "ATRI_Chat_v1.0.0_Release.zip",
    ]
    
    for dir_path in dirs_to_clean:
        path = Path(dir_path)
        if path.exists():
            print(f"删除目录: {dir_path}")
            shutil.rmtree(path)
    
    for file_path in files_to_clean:
        path = Path(file_path)
        if path.exists():
            print(f"删除文件: {file_path}")
            path.unlink()
    
    print_success("清理完成")


def build_backend():
    """打包后端"""
    print_step(1, "打包后端")
    
    print("检查 PyInstaller...")
    result = subprocess.run(
        ["uv", "pip", "show", "pyinstaller"],
        capture_output=True
    )
    
    if result.returncode != 0:
        print("安装 PyInstaller...")
        if not run_command(["uv", "pip", "install", "pyinstaller"]):
            return False
    
    print("\n开始打包后端...")
    if not run_command(["uv", "run", "pyinstaller", "atri-backend.spec"]):
        return False
    
    backend_file = Path("dist/atri-backend.exe")
    if not backend_file.exists():
        print_error("后端文件未找到")
        return False
    
    target_name = "atri-backend-x86_64-pc-windows-msvc.exe"
    binaries_dir = Path("frontend/src-tauri/binaries")
    binaries_dir.mkdir(parents=True, exist_ok=True)
    target = binaries_dir / target_name
    
    shutil.copy2(backend_file, target)
    size_mb = backend_file.stat().st_size / (1024 * 1024)
    print_success(f"后端打包完成: {size_mb:.2f} MB")
    print_success(f"已复制到: {target}")
    
    return True


def build_frontend():
    """构建前端"""
    print_step(2, "构建前端")
    
    frontend_dir = Path("frontend")
    
    if not (frontend_dir / "node_modules").exists():
        print("安装前端依赖...")
        if not run_command("npm install", cwd=frontend_dir):
            return False
    
    print("\n构建前端...")
    if not run_command("npm run build", cwd=frontend_dir):
        return False
    
    print_success("前端构建完成")
    return True


def build_tauri_app():
    """构建 Tauri 客户端主程序"""
    print_step(3, "构建 Tauri 客户端")
    
    frontend_dir = Path("frontend")
    
    print("开始编译 Rust 后端代码并打包客户端...")
    print_warning("这可能需要几分钟，请耐心等待...")
    
    # 因为我们在 tauri.conf.json 移除了 nsis 目标，所以这里只会编译可执行文件
    if not run_command("npm run tauri:build", cwd=frontend_dir):
        return False
        
    exe_path = Path("frontend/src-tauri/target/release/atri-chat.exe")
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print_success(f"Tauri 客户端生成: {exe_path.name} ({size_mb:.2f} MB)")
    else:
        print_error("找不到客户端可执行文件")
        return False
        
    return True


def create_release_package():
    """创建免安装发行包"""
    print_step(4, "创建免安装发布 ZIP 与目录")
    
    exe_path = Path("frontend/src-tauri/target/release/atri-chat.exe")
    backend_path = Path("frontend/src-tauri/binaries/atri-backend-x86_64-pc-windows-msvc.exe")
    
    if not exe_path.exists():
        print_error(f"前端可执行文件不存在: {exe_path}")
        return False
    
    if not backend_path.exists():
        print_error(f"后端可执行文件不存在: {backend_path}")
        return False
    
    release_dir = Path("release_package/ATRI Chat")
    if release_dir.parent.exists():
        shutil.rmtree(release_dir.parent)
    release_dir.mkdir(parents=True)
    
    print("复制程序及其副作用文件...")
    shutil.copy2(exe_path, release_dir / "ATRI Chat.exe")
    print_success("复制主程序完毕")
    
    binaries_dir = release_dir / "binaries"
    binaries_dir.mkdir()
    shutil.copy2(backend_path, binaries_dir / "atri-backend-x86_64-pc-windows-msvc.exe")
    print_success("复制后端完毕")
    
    readme = release_dir / "README.txt"
    readme.write_text("""ATRI Chat (便携版)
================

使用说明：
1. 这是一个绿色免安装软件，你可以将它解压到磁盘任何你喜欢的位置（甚至U盘内）。
2. 请直接双击 "ATRI Chat.exe" 启动程序。
3. 软件运行产生的所有数据 (包含了您拉取的模型、应用数据库、配置文件和错误日志），
   都只会被局限保存在这个执行文件同级的 [data] 与 [logs] 文件夹下。

如何卸载/迁移：
- 卸载：什么都不用考虑，直接把这个文件夹整个删除 (Shift + Delete) 即可，绝不留系统残留。
- 迁移：直接将整个文件夹打包复制到另外一台电脑上，即可完整恢复你的所有记录与模型。

文件说明：
- ATRI Chat.exe      主程序
- binaries/          内置随附智能后端组件
- data/              [启动后生成] 个人资料夹
- logs/              [启动后生成] 运行排查日志

版本：1.0.0
""", encoding='utf-8')
    print_success("生成 README 说明")
    
    zip_name = "ATRI_Chat_v1.0.0_Release.zip"
    zip_path = Path(zip_name)
    
    print(f"\n正在创建压缩包: {zip_name}")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 我们打包最外层的 "ATRI Chat" 这个包裹文件夹，令用户解压得到的不会是散乱文件
        for file in release_dir.parent.rglob('*'):
            if file.is_file():
                arcname = file.relative_to(release_dir.parent)
                zipf.write(file, arcname)
    
    zip_size_mb = zip_path.stat().st_size / (1024 * 1024)
    print_success(f"发布版 ZIP 创建成功: {zip_name} ({zip_size_mb:.2f} MB)")
    
    return True


def show_results():
    """显示构建结果"""
    print_header("构建完成")
    
    results = []
    
    release_zip = Path("ATRI_Chat_v1.0.0_Release.zip")
    if release_zip.exists():
        size_mb = release_zip.stat().st_size / (1024 * 1024)
        results.append({
            "type": "免安装发行压缩包",
            "file": str(release_zip),
            "size": f"{size_mb:.2f} MB",
            "desc": "推荐发放给用户的压缩包，解压即用，100%纯净沙盒隔离。"
        })
    
    release_dir = Path("release_package/ATRI Chat")
    if release_dir.exists():
        results.append({
            "type": "发行文件夹",
            "file": str(release_dir) + "/",
            "size": "-",
            "desc": "你可以在此直接双击 ATRI Chat.exe 本地测试打包成效。"
        })
    
    if results:
        print(f"{Colors.BOLD}最终产出清单：{Colors.END}\n")
        for i, result in enumerate(results, 1):
            print(f"{Colors.BOLD}{i}. {result['type']}{Colors.END}")
            print(f"   路役: {Colors.CYAN}{result['file']}{Colors.END}")
            print(f"   体积: {result['size']}")
            print(f"   说明: {result['desc']}\n")
    else:
        print_warning("未找到最终产出文件")
    
    print(f"\n{Colors.BOLD}版本哲学与声明：{Colors.END}")
    print("本程序采用 强便携 原则打造，任何时候本客户端都不会污染系统 AppData、ProgramFiles 和注册表。")


def show_menu():
    """显示菜单"""
    print_header("ATRI Chat 统一构建与发布打包流程")
    
    print(f"{Colors.BOLD}请选择您要执行的工序：{Colors.END}\n")
    print(f"  {Colors.CYAN}1.{Colors.END} 仅重构引擎后端 (构建 Python PyInstaller 实体)")
    print(f"  {Colors.CYAN}2.{Colors.END} 仅构建网页前端 (构建 Vite ESBuild 静态块)")
    print(f"  {Colors.CYAN}3.{Colors.END} 完整走一遍流水线 (构建全部组件并组装产生发布级别 ZIP)")
    print(f"  {Colors.CYAN}4.{Colors.END} 清理历史构建垃圾")
    print(f"  {Colors.CYAN}5.{Colors.END} 查验编译器和语言环境依赖")
    print(f"  {Colors.CYAN}0.{Colors.END} 退出")
    print()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='ATRI Chat 构建工具')
    parser.add_argument('--backend', action='store_true', help='只打包后端')
    parser.add_argument('--frontend', action='store_true', help='只构建前端')
    parser.add_argument('--all', action='store_true', help='执行完整打包并生成发布ZIP')
    parser.add_argument('--clean', action='store_true', help='清理构建文件')
    parser.add_argument('--check', action='store_true', help='检查环境')
    
    args = parser.parse_args()
    
    start_time = time.time()
    
    if any(vars(args).values()):
        if args.check:
            check_environment()
        elif args.clean:
            clean_build()
        elif args.backend:
            if not build_backend():
                sys.exit(1)
        elif args.frontend:
            if not build_frontend():
                sys.exit(1)
        elif args.all:
            if not check_environment():
                sys.exit(1)
            if not build_backend() or not build_frontend() or not build_tauri_app() or not create_release_package():
                sys.exit(1)
            show_results()
    else:
        while True:
            show_menu()
            try:
                choice = input(f"{Colors.BOLD}请输入您的选择 (0-5): {Colors.END}").strip()
                
                if choice == '0':
                    print("\n正在登出...")
                    break
                elif choice == '1':
                    if not build_backend():
                        print_error("后端编译失败")
                elif choice == '2':
                    if not build_frontend():
                        print_error("前端构建失误")
                elif choice == '3':
                    if not check_environment():
                        continue
                    if not build_backend() or not build_frontend() or not build_tauri_app() or not create_release_package():
                        continue
                    show_results()
                elif choice == '4':
                    clean_build()
                elif choice == '5':
                    check_environment()
                else:
                    print_warning("无效敲击指令")
                
                if choice != '0':
                    input(f"\n{Colors.BOLD}按敲回车 (Enter) 退回主菜单...{Colors.END}")
                    
            except KeyboardInterrupt:
                print("\n\n已强制截断")
                break
            except Exception as e:
                print_error(f"意外崩溃: {e}")
                import traceback
                traceback.print_exc()
    
    elapsed = time.time() - start_time
    if elapsed > 1:
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        print(f"\n{Colors.BOLD}作业结束于 {minutes}分钟 {seconds}秒。{Colors.END}")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception as e:
        print_error(f"全局致命异常: {e}")
        sys.exit(1)
