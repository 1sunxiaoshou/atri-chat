"""
ATRI Chat 统一打包工具
提供交互式命令行界面，支持多种打包选项
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
        "portable_release",
        "frontend/src-tauri/target/release/bundle",
    ]
    
    files_to_clean = [
        "ATRI_Chat_v1.0.0_Portable.zip",
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
    
    # 检查 PyInstaller
    print("检查 PyInstaller...")
    result = subprocess.run(
        ["uv", "pip", "show", "pyinstaller"],
        capture_output=True
    )
    
    if result.returncode != 0:
        print("安装 PyInstaller...")
        if not run_command(["uv", "pip", "install", "pyinstaller"]):
            return False
    
    # 使用 spec 文件打包
    print("\n开始打包后端...")
    if not run_command(["uv", "run", "pyinstaller", "atri-backend.spec"]):
        return False
    
    # 复制到 Tauri binaries 目录
    backend_file = Path("dist/atri-backend.exe")
    if not backend_file.exists():
        print_error("后端文件未找到")
        return False
    
    # 确定目标文件名
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
    
    # 检查依赖
    if not (frontend_dir / "node_modules").exists():
        print("安装前端依赖...")
        if not run_command("npm install", cwd=frontend_dir):
            return False
    
    # 构建前端
    print("\n构建前端...")
    if not run_command("npm run build", cwd=frontend_dir):
        return False
    
    print_success("前端构建完成")
    return True


def build_tauri_installer():
    """构建 Tauri 安装包（标准版）"""
    print_step(3, "构建 Tauri 安装包（标准版）")
    
    frontend_dir = Path("frontend")
    
    print("开始构建 Tauri 应用...")
    print_warning("这可能需要 5-10 分钟，请耐心等待...")
    
    if not run_command("npm run tauri:build", cwd=frontend_dir):
        return False
    
    # 检查生成的文件
    nsis_dir = Path("frontend/src-tauri/target/release/bundle/nsis")
    if nsis_dir.exists():
        for file in nsis_dir.glob("*.exe"):
            size_mb = file.stat().st_size / (1024 * 1024)
            print_success(f"安装包生成: {file.name} ({size_mb:.2f} MB)")
    
    return True


def create_portable_package():
    """创建便携版"""
    print_step(4, "创建便携版")
    
    # 源文件路径
    exe_path = Path("frontend/src-tauri/target/release/atri-chat.exe")
    backend_path = Path("frontend/src-tauri/binaries/atri-backend-x86_64-pc-windows-msvc.exe")
    
    if not exe_path.exists():
        print_error(f"前端可执行文件不存在: {exe_path}")
        return False
    
    if not backend_path.exists():
        print_error(f"后端可执行文件不存在: {backend_path}")
        return False
    
    # 创建便携版目录
    portable_dir = Path("portable_release")
    if portable_dir.exists():
        shutil.rmtree(portable_dir)
    portable_dir.mkdir()
    
    print("复制文件...")
    
    # 复制主程序
    shutil.copy2(exe_path, portable_dir / "ATRI Chat.exe")
    print_success("复制主程序")
    
    # 复制后端
    binaries_dir = portable_dir / "binaries"
    binaries_dir.mkdir()
    shutil.copy2(backend_path, binaries_dir / "atri-backend-x86_64-pc-windows-msvc.exe")
    print_success("复制后端")
    
    # 创建便携模式标记文件
    portable_marker = portable_dir / "portable.txt"
    portable_marker.write_text("""ATRI Chat Portable Mode
=======================

This file marks the application as running in portable mode.

In portable mode:
- All data is stored in the application directory
- No files are written to system directories (AppData, etc.)
- The application can be run from a USB drive or moved freely

Data locations:
- Database: ./data/app.db
- Uploads: ./data/uploads/
- Logs: ./logs/

To switch to standard mode, delete this file.
""", encoding='utf-8')
    print_success("创建便携模式标记")
    
    # 创建 README
    readme = portable_dir / "README.txt"
    readme.write_text("""ATRI Chat 便携版
================

使用说明：
1. 双击 "ATRI Chat.exe" 启动程序
2. 所有数据将保存在当前目录下的 data 文件夹
3. 可以将整个文件夹复制到 U 盘或其他位置使用

文件说明：
- ATRI Chat.exe      主程序
- binaries/          后端服务
- portable.txt       便携模式标记（请勿删除）
- data/              数据目录（首次运行后自动创建）
- logs/              日志目录（首次运行后自动创建）

注意事项：
- 首次启动可能需要几秒钟初始化
- 请确保有网络连接以使用 AI 功能
- 如需卸载，直接删除整个文件夹即可

版本：1.0.0
""", encoding='utf-8')
    print_success("创建 README")
    
    # 打包成 ZIP
    zip_name = "ATRI_Chat_v1.0.0_Portable.zip"
    zip_path = Path(zip_name)
    
    print(f"\n创建压缩包: {zip_name}")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in portable_dir.rglob('*'):
            if file.is_file():
                arcname = file.relative_to(portable_dir.parent)
                zipf.write(file, arcname)
    
    zip_size_mb = zip_path.stat().st_size / (1024 * 1024)
    print_success(f"便携版创建完成: {zip_name} ({zip_size_mb:.2f} MB)")
    
    return True


def show_results():
    """显示构建结果"""
    print_header("构建完成")
    
    results = []
    
    # 标准版安装包
    nsis_dir = Path("frontend/src-tauri/target/release/bundle/nsis")
    if nsis_dir.exists():
        for file in nsis_dir.glob("*.exe"):
            size_mb = file.stat().st_size / (1024 * 1024)
            results.append({
                "type": "标准版安装包",
                "file": str(file),
                "size": f"{size_mb:.2f} MB",
                "desc": "NSIS 安装程序，数据存储在 %APPDATA%"
            })
    
    # 便携版
    portable_zip = Path("ATRI_Chat_v1.0.0_Portable.zip")
    if portable_zip.exists():
        size_mb = portable_zip.stat().st_size / (1024 * 1024)
        results.append({
            "type": "便携版压缩包",
            "file": str(portable_zip),
            "size": f"{size_mb:.2f} MB",
            "desc": "解压即用，数据存储在应用程序目录"
        })
    
    portable_dir = Path("portable_release")
    if portable_dir.exists():
        results.append({
            "type": "便携版文件夹",
            "file": str(portable_dir) + "/",
            "size": "-",
            "desc": "可直接运行，无需解压"
        })
    
    if results:
        print(f"{Colors.BOLD}生成的文件：{Colors.END}\n")
        for i, result in enumerate(results, 1):
            print(f"{Colors.BOLD}{i}. {result['type']}{Colors.END}")
            print(f"   文件: {Colors.CYAN}{result['file']}{Colors.END}")
            print(f"   大小: {result['size']}")
            print(f"   说明: {result['desc']}\n")
    else:
        print_warning("未找到生成的文件")
    
    print(f"\n{Colors.BOLD}版本说明：{Colors.END}")
    print("• 标准版: 通过安装程序安装，数据存储在系统 AppData 目录")
    print("• 便携版: 解压即用，数据存储在应用程序目录，可从 U 盘运行")


def show_menu():
    """显示菜单"""
    print_header("ATRI Chat 统一打包工具")
    
    print(f"{Colors.BOLD}请选择打包选项：{Colors.END}\n")
    print(f"  {Colors.CYAN}1.{Colors.END} 只打包后端")
    print(f"  {Colors.CYAN}2.{Colors.END} 只构建前端")
    print(f"  {Colors.CYAN}3.{Colors.END} 打包标准版（安装包）")
    print(f"  {Colors.CYAN}4.{Colors.END} 打包便携版")
    print(f"  {Colors.CYAN}5.{Colors.END} 打包完整版（标准版 + 便携版）")
    print(f"  {Colors.CYAN}6.{Colors.END} 清理构建文件")
    print(f"  {Colors.CYAN}7.{Colors.END} 检查环境")
    print(f"  {Colors.CYAN}0.{Colors.END} 退出")
    print()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='ATRI Chat 统一打包工具')
    parser.add_argument('--backend', action='store_true', help='只打包后端')
    parser.add_argument('--frontend', action='store_true', help='只构建前端')
    parser.add_argument('--installer', action='store_true', help='打包标准版（安装包）')
    parser.add_argument('--portable', action='store_true', help='打包便携版')
    parser.add_argument('--all', action='store_true', help='打包完整版（标准版 + 便携版）')
    parser.add_argument('--clean', action='store_true', help='清理构建文件')
    parser.add_argument('--check', action='store_true', help='检查环境')
    
    args = parser.parse_args()
    
    start_time = time.time()
    
    # 命令行模式
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
        elif args.installer:
            if not check_environment():
                sys.exit(1)
            if not build_backend():
                sys.exit(1)
            if not build_frontend():
                sys.exit(1)
            if not build_tauri_installer():
                sys.exit(1)
            show_results()
        elif args.portable:
            if not check_environment():
                sys.exit(1)
            if not build_backend():
                sys.exit(1)
            if not build_frontend():
                sys.exit(1)
            if not build_tauri_installer():
                sys.exit(1)
            if not create_portable_package():
                sys.exit(1)
            show_results()
        elif args.all:
            if not check_environment():
                sys.exit(1)
            if not build_backend():
                sys.exit(1)
            if not build_frontend():
                sys.exit(1)
            if not build_tauri_installer():
                sys.exit(1)
            if not create_portable_package():
                sys.exit(1)
            show_results()
    else:
        # 交互模式
        while True:
            show_menu()
            
            try:
                choice = input(f"{Colors.BOLD}请输入选项 (0-7): {Colors.END}").strip()
                
                if choice == '0':
                    print("\n再见！")
                    break
                elif choice == '1':
                    if not build_backend():
                        print_error("后端打包失败")
                elif choice == '2':
                    if not build_frontend():
                        print_error("前端构建失败")
                elif choice == '3':
                    if not check_environment():
                        continue
                    if not build_backend():
                        print_error("后端打包失败")
                        continue
                    if not build_frontend():
                        print_error("前端构建失败")
                        continue
                    if not build_tauri_installer():
                        print_error("Tauri 构建失败")
                        continue
                    show_results()
                elif choice == '4':
                    if not check_environment():
                        continue
                    if not build_backend():
                        print_error("后端打包失败")
                        continue
                    if not build_frontend():
                        print_error("前端构建失败")
                        continue
                    if not build_tauri_installer():
                        print_error("Tauri 构建失败")
                        continue
                    if not create_portable_package():
                        print_error("便携版打包失败")
                        continue
                    show_results()
                elif choice == '5':
                    if not check_environment():
                        continue
                    if not build_backend():
                        print_error("后端打包失败")
                        continue
                    if not build_frontend():
                        print_error("前端构建失败")
                        continue
                    if not build_tauri_installer():
                        print_error("Tauri 构建失败")
                        continue
                    if not create_portable_package():
                        print_error("便携版打包失败")
                        continue
                    show_results()
                elif choice == '6':
                    clean_build()
                elif choice == '7':
                    check_environment()
                else:
                    print_warning("无效选项，请重新输入")
                
                if choice != '0':
                    input(f"\n{Colors.BOLD}按 Enter 继续...{Colors.END}")
                    
            except KeyboardInterrupt:
                print("\n\n用户中断")
                break
            except Exception as e:
                print_error(f"发生错误: {e}")
                import traceback
                traceback.print_exc()
    
    # 显示耗时
    elapsed = time.time() - start_time
    if elapsed > 1:
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        print(f"\n{Colors.BOLD}总耗时: {minutes} 分 {seconds} 秒{Colors.END}")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n用户中断")
        sys.exit(1)
    except Exception as e:
        print_error(f"发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
