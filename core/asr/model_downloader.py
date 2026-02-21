"""SenseVoice 模型下载器

从 ModelScope 下载 SenseVoice-Small 模型
"""
from pathlib import Path
from typing import Literal, Optional
import shutil

try:
    from modelscope.hub.snapshot_download import snapshot_download
except ImportError:
    raise ImportError(
        "modelscope 未安装。请运行: pip install modelscope"
    )

from core.logger import get_logger

logger = get_logger(__name__)


# 模型 ID
MODEL_ID = "xiaowangge/sherpa-onnx-sense-voice-small"

# 必需文件列表
REQUIRED_FILES = {
    "int8": [
        "model_q8.onnx",         # INT8 量化模型
        "tokens.txt",            # 词表
    ],
    "fp32": [
        "model.onnx",            # FP32 全精度模型
        "tokens.txt",            # 词表
    ]
}


def download_sensevoice_model(
    model_type: Literal["int8", "fp32"] = "int8",
    target_dir: Optional[Path] = None,
    force: bool = False
) -> Path:
    """从 ModelScope 下载 SenseVoice 模型
    
    Args:
        model_type: 模型类型
                   - "int8": INT8 量化版本（推荐，体积小速度快）
                   - "fp32": FP32 全精度版本（精度略高）
        target_dir: 目标目录（默认为 data/models/sensevoice）
        force: 是否强制重新下载
        
    Returns:
        模型目录路径
        
    Raises:
        ValueError: 参数错误
        RuntimeError: 下载失败
    """
    if model_type not in REQUIRED_FILES:
        raise ValueError(f"不支持的模型类型: {model_type}，仅支持 'int8' 或 'fp32'")
    
    # 设置目标目录
    if target_dir is None:
        target_dir = Path("data/models/sensevoice")
    else:
        target_dir = Path(target_dir)
    
    # 检查是否已存在
    if not force and _check_model_exists(target_dir, model_type):
        logger.info(f"模型已存在，跳过下载: {target_dir}")
        return target_dir
    
    logger.info(f"开始下载 SenseVoice 模型 ({model_type})")
    logger.info(f"模型 ID: {MODEL_ID}")
    logger.info(f"目标目录: {target_dir}")
    
    try:
        # 创建目标目录
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # 从 ModelScope 下载模型（自带进度条）
        logger.info("正在从 ModelScope 下载模型...")
        cache_dir = snapshot_download(
            MODEL_ID,
            cache_dir=str(target_dir.parent / ".cache")
        )
        cache_path = Path(cache_dir)
        
        logger.info(f"模型已下载到缓存: {cache_path}")
        
        # 复制必需文件到目标目录
        required_files = REQUIRED_FILES[model_type]
        logger.info(f"复制必需文件到目标目录...")
        
        for filename in required_files:
            src = cache_path / filename
            dst = target_dir / filename
            
            if not src.exists():
                raise FileNotFoundError(f"缺少必需文件: {filename}")
            
            shutil.copy2(src, dst)
            logger.debug(f"已复制: {filename}")
        
        # 验证文件完整性
        if not _check_model_exists(target_dir, model_type):
            raise RuntimeError("模型文件不完整")
        
        logger.info(f"✓ SenseVoice 模型下载完成: {target_dir}")
        
        return target_dir
        
    except Exception as e:
        error_msg = f"下载模型失败: {e}"
        logger.error(error_msg, exc_info=True)
        
        # 清理不完整的文件
        if target_dir.exists():
            for f in target_dir.glob("*"):
                if f.is_file():
                    f.unlink()
        
        raise RuntimeError(error_msg)


def _check_model_exists(model_dir: Path, model_type: str) -> bool:
    """检查模型文件是否完整
    
    Args:
        model_dir: 模型目录
        model_type: 模型类型
        
    Returns:
        是否完整
    """
    if not model_dir.exists():
        return False
    
    required_files = REQUIRED_FILES[model_type]
    for filename in required_files:
        if not (model_dir / filename).exists():
            return False
    
    return True


def get_model_info(model_dir: Path = None) -> dict:
    """获取已下载模型的信息
    
    Args:
        model_dir: 模型目录（默认为 data/models/sensevoice）
        
    Returns:
        模型信息字典
    """
    if model_dir is None:
        model_dir = Path("data/models/sensevoice")
    else:
        model_dir = Path(model_dir)
    
    if not model_dir.exists():
        return {
            "exists": False,
            "path": str(model_dir)
        }
    
    # 检查模型类型
    has_int8 = _check_model_exists(model_dir, "int8")
    has_fp32 = _check_model_exists(model_dir, "fp32")
    
    info = {
        "exists": has_int8 or has_fp32,
        "path": str(model_dir),
        "int8": has_int8,
        "fp32": has_fp32,
    }
    
    # 获取文件大小
    if model_dir.exists():
        total_size = sum(f.stat().st_size for f in model_dir.glob("*") if f.is_file())
        info["total_size_mb"] = round(total_size / 1024 / 1024, 2)
    
    return info


if __name__ == "__main__":
    # 测试下载
    import sys
    
    model_type = sys.argv[1] if len(sys.argv) > 1 else "int8"
    
    print(f"下载 SenseVoice 模型 ({model_type})...")
    model_dir = download_sensevoice_model(model_type=model_type)
    
    print(f"\n模型已下载到: {model_dir}")
    
    info = get_model_info(model_dir)
    print(f"\n模型信息:")
    print(f"  - INT8: {'✓' if info['int8'] else '✗'}")
    print(f"  - FP32: {'✓' if info['fp32'] else '✗'}")
    print(f"  - 总大小: {info.get('total_size_mb', 0)} MB")
