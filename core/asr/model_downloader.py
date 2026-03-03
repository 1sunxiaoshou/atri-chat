"""SenseVoice 模型下载器

从 ModelScope 下载 SenseVoice-Small 模型
"""
from pathlib import Path
from typing import Optional
import shutil

try:
    from modelscope.hub.snapshot_download import snapshot_download
except ImportError:
    raise ImportError(
        "modelscope 未安装。请运行: uv pip install modelscope"
    )

from core.logger import get_logger

logger = get_logger(__name__)

# 模型 ID
MODEL_ID = "xiaowangge/sherpa-onnx-sense-voice-small"

# 必需文件列表
REQUIRED_FILES = [
    "model_q8.onnx",  # INT8 量化模型
    "model.onnx",     # FP32 全精度模型
    "tokens.txt",     # 词表
]


def download_sensevoice_model(
    target_dir: Optional[Path] = None,
    force: bool = False
) -> Path:
    """从 ModelScope 下载 SenseVoice 模型（包含 INT8 和 FP32 两个版本）
    
    Args:
        target_dir: 目标目录（默认为 data/models/sensevoice）
        force: 是否强制重新下载
        
    Returns:
        模型目录路径
    """
    # 设置目标目录
    if target_dir is None:
        target_dir = Path("data/models/sensevoice")
    else:
        target_dir = Path(target_dir)
    
    # 检查是否已存在
    if not force and _check_model_exists(target_dir):
        logger.info(f"模型已存在，跳过下载: {target_dir}")
        return target_dir
    
    logger.info("开始下载 SenseVoice 模型（包含 INT8 和 FP32 版本）")
    logger.info(f"模型 ID: {MODEL_ID}")
    logger.info(f"目标目录: {target_dir}")
    
    try:
        # 创建目标目录
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # 直接下载到目标目录（不使用缓存）
        logger.info("正在从 ModelScope 下载模型...")
        snapshot_download(
            MODEL_ID,
            cache_dir=str(target_dir)
        )
        
        logger.info(f"✓ SenseVoice 模型下载完成: {target_dir}")
        
        # 验证文件完整性
        if not _check_model_exists(target_dir):
            raise RuntimeError("模型文件不完整")
        
        return target_dir
        
    except Exception as e:
        logger.error(f"下载模型失败: {e}", exc_info=True)
        
        # 清理不完整的文件
        if target_dir.exists():
            for f in target_dir.glob("*"):
                if f.is_file():
                    f.unlink()
        
        raise RuntimeError(f"下载模型失败: {e}")


def _check_model_exists(model_dir: Path) -> bool:
    """检查模型文件是否完整"""
    if not model_dir.exists():
        return False
    
    for filename in REQUIRED_FILES:
        if not (model_dir / filename).exists():
            return False
    
    return True


def get_model_info(model_dir: Optional[Path] = None) -> dict:
    """获取已下载模型的信息"""
    if model_dir is None:
        model_dir = Path("data/models/sensevoice")
    else:
        model_dir = Path(model_dir)
    
    if not model_dir.exists():
        return {
            "exists": False,
            "path": str(model_dir)
        }
    
    # 检查模型文件
    has_int8 = (model_dir / "model_q8.onnx").exists()
    has_fp32 = (model_dir / "model.onnx").exists()
    has_tokens = (model_dir / "tokens.txt").exists()
    
    info = {
        "exists": has_int8 and has_fp32 and has_tokens,
        "path": str(model_dir),
        "int8": has_int8,
        "fp32": has_fp32,
        "tokens": has_tokens,
    }
    
    # 获取文件大小（只统计必需文件）
    if model_dir.exists():
        total_size = 0
        for filename in REQUIRED_FILES:
            file_path = model_dir / filename
            if file_path.exists():
                total_size += file_path.stat().st_size
        info["total_size_mb"] = round(total_size / 1024 / 1024, 2)
    
    return info


if __name__ == "__main__":
    print("下载 SenseVoice 模型（INT8 + FP32）...")
    model_dir = download_sensevoice_model()
    
    print(f"\n模型已下载到: {model_dir}")
    
    info = get_model_info(model_dir)
    print("\n模型信息:")
    print(f"  - INT8 模型: {'✓' if info['int8'] else '✗'}")
    print(f"  - FP32 模型: {'✓' if info['fp32'] else '✗'}")
    print(f"  - 词表文件: {'✓' if info['tokens'] else '✗'}")
    print(f"  - 总大小: {info.get('total_size_mb', 0)} MB")
