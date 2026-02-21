#!/usr/bin/env python3
"""下载 SenseVoice ASR 模型

使用方法:
    python scripts/download_asr_model.py
    或
    uv run python scripts/download_asr_model.py
"""
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.asr.model_downloader import download_sensevoice_model, get_model_info


def main():
    """主函数"""
    print("=" * 60)
    print("SenseVoice ASR 模型下载工具")
    print("=" * 60)
    print()
    
    # 检查是否已存在
    model_dir = Path("data/models/sensevoice")
    info = get_model_info(model_dir)
    
    if info.get("exists"):
        print(f"✓ 模型已存在: {model_dir}")
        print(f"  - INT8: {'✓' if info['int8'] else '✗'}")
        print(f"  - FP32: {'✓' if info['fp32'] else '✗'}")
        print(f"  - 总大小: {info.get('total_size_mb', 0)} MB")
        print()
        
        response = input("是否重新下载? (y/N): ").strip().lower()
        if response != 'y':
            print("跳过下载")
            return
        print()
    
    # 下载模型
    print("开始下载 SenseVoice-Small 模型 (INT8 量化版本)...")
    print("模型大小: ~200MB")
    print("来源: ModelScope")
    print()
    print("提示: ModelScope 会显示下载进度条")
    print()
    
    try:
        # snapshot_download 自带进度条
        model_dir = download_sensevoice_model(
            model_type="int8",
            force=True
        )
        
        print()
        print("=" * 60)
        print("✓ 下载完成！")
        print("=" * 60)
        print(f"模型位置: {model_dir}")
        
        # 显示最终信息
        info = get_model_info(model_dir)
        print(f"模型大小: {info.get('total_size_mb', 0)} MB")
        print()
        print("现在可以启动应用使用 ASR 功能了")
        
    except Exception as e:
        print()
        print("=" * 60)
        print("✗ 下载失败")
        print("=" * 60)
        print(f"错误: {e}")
        print()
        print("请检查:")
        print("  1. 网络连接是否正常")
        print("  2. ModelScope 服务是否可访问")
        print("  3. 磁盘空间是否充足 (需要约 200MB)")
        sys.exit(1)


if __name__ == "__main__":
    main()
