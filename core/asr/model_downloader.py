"""SenseVoice 模型下载器 (稳定流式版)
支持精准进度计算，使用 ModelScope 官方推荐的下载路径
"""
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
import shutil
import httpx

from core.logger import get_logger

logger = get_logger(__name__)

# ModelScope 文件直连基础路径 (resolve 会自动处理重定向)
BASE_URL = "https://www.modelscope.cn/models/xiaowangge/sherpa-onnx-sense-voice-small/resolve/master/"

# 全局下载状态
DOWNLOAD_PROGRESS: Dict[str, Any] = {
    "is_downloading": False,
    "progress": 0.0,
    "error": None,
    "precision": None
}

async def download_sensevoice_model_async(
    target_dir: Optional[Path] = None,
    precision: str = "both"
) -> Path:
    """异步流式下载 SenseVoice 模型"""
    global DOWNLOAD_PROGRESS
    
    if target_dir is None:
        from core.config import get_settings
        target_dir = get_settings().asr_models_dir / "sensevoice"
    else:
        target_dir = Path(target_dir)

    # 1. 初始化状态
    DOWNLOAD_PROGRESS.update({
        "is_downloading": True, 
        "progress": 0.0, 
        "error": None,
        "precision": precision
    })
    
    # 确定需要下载的文件清单
    files_to_download = ["tokens.txt"]
    if precision in ("int8", "both"): files_to_download.append("model_q8.onnx")
    if precision in ("fp32", "both"): files_to_download.append("model.onnx")

    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # 模拟高权重浏览器 Header，避免被 ModelScope 拦截或返回 404
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.modelscope.cn/models/xiaowangge/sherpa-onnx-sense-voice-small/files",
        }
        
        async with httpx.AsyncClient(
            follow_redirects=True, 
            timeout=120.0, 
            headers=headers
        ) as client:

            # 第一步：获取总大小
            total_bytes = 0
            file_info = []
            
            for filename in files_to_download:
                url = BASE_URL + filename
                # 使用 GET 请求只读头部，避免部分 API 不支持 HEAD
                async with client.stream("GET", url) as resp:
                    if resp.status_code != 200:
                        raise RuntimeError(f"无法访问文件 {filename}: HTTP {resp.status_code}")
                    size = int(resp.headers.get("content-length", 0))
                    total_bytes += size
                    file_info.append({"name": filename, "size": size, "url": url})
                
            if total_bytes == 0:
                raise ValueError("读取文件总大小时出错，请检查网络")

            # 第二步：顺序下载
            downloaded_bytes = 0
            
            for item in file_info:
                filename = item["name"]
                url = item["url"]
                target_path = target_dir / filename
                
                
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    
                    with open(target_path, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=131072): # 128KB 缓冲区
                            f.write(chunk)
                            downloaded_bytes += len(chunk)
                            # 精准计算总体进度 (保留一位小数，避免前端显示过长)
                            DOWNLOAD_PROGRESS["progress"] = round(min(99.9, (downloaded_bytes / total_bytes) * 100), 1)

            # 第三步：收尾校验
            if not _check_model_exists(target_dir, precision):
                raise RuntimeError("下载完成后校验失败，部分文件可能缺失")
                
            DOWNLOAD_PROGRESS["progress"] = 100.0
            return target_dir

    except Exception as e:
        DOWNLOAD_PROGRESS["error"] = str(e)
        logger.error(f"ASR 模型下载中断: {e}")
        # 如果是中途失败，不清理目录，允许用户下次重试（简单的本地存在检查跳过下载可后续优化）
        raise RuntimeError(str(e))
        
    finally:
        DOWNLOAD_PROGRESS["is_downloading"] = False


def _check_model_exists(model_dir: Path, precision: str = "both") -> bool:
    """仅保留极简的校验逻辑"""
    if not (model_dir / "tokens.txt").exists(): return False
    if precision in ("int8", "both") and not (model_dir / "model_q8.onnx").exists(): return False
    if precision in ("fp32", "both") and not (model_dir / "model.onnx").exists(): return False
    return True

def get_model_info(model_dir: Optional[Path] = None) -> dict:
    if model_dir is None:
        from core.config import get_settings
        model_dir = get_settings().asr_models_dir / "sensevoice"
    else:
        model_dir = Path(model_dir)
        
    info = {
        "exists": _check_model_exists(model_dir, precision="int8") or _check_model_exists(model_dir, precision="fp32"),
        "int8": (model_dir / "model_q8.onnx").exists(),
        "fp32": (model_dir / "model.onnx").exists(),
        "total_size_mb": 0,
        "int8_size_mb": 0,
        "fp32_size_mb": 0
    }
    
    if model_dir.exists():
        total_size = 0
        int8_size = 0
        fp32_size = 0
        
        # 计算各个模型文件大小
        if (model_dir / "model_q8.onnx").exists():
            int8_size = (model_dir / "model_q8.onnx").stat().st_size
        if (model_dir / "model.onnx").exists():
            fp32_size = (model_dir / "model.onnx").stat().st_size
            
        # 共享文件 (tokens.txt 等) 计入总大小，但不计入单精度显示 (UI 只需要大概模型大小)
        total_size = sum(f.stat().st_size for f in model_dir.glob("*") if f.is_file())
        
        info["total_size_mb"] = round(total_size / 1024 / 1024, 1)
        info["int8_size_mb"] = round(int8_size / 1024 / 1024, 1)
        info["fp32_size_mb"] = round(fp32_size / 1024 / 1024, 1)
        
    return info

def delete_model_assets(model_dir: Optional[Path] = None, precision: str = "all"):
    if model_dir is None:
        from core.config import get_settings
        model_dir = get_settings().asr_models_dir / "sensevoice"
    else:
        model_dir = Path(model_dir)
        
    if not model_dir.exists():
        return False
        
    if precision == "all":
        shutil.rmtree(model_dir)
        return True
    
    deleted = False
    if precision == "int8":
        target = model_dir / "model_q8.onnx"
        if target.exists():
            target.unlink()
            deleted = True
    elif precision == "fp32":
        target = model_dir / "model.onnx"
        if target.exists():
            target.unlink()
            deleted = True
            
    # 如果目录空了或只剩下 vocab，考虑清理整个目录 (视需求而定，这里保留 tokens.txt 如果还有其他模型)
    if not (model_dir / "model_q8.onnx").exists() and not (model_dir / "model.onnx").exists():
        shutil.rmtree(model_dir)
            
    return deleted

def get_download_progress() -> Dict[str, Any]:
    """获取当前下载进度状态"""
    return DOWNLOAD_PROGRESS.copy()

def reset_download_progress():
    """重置下载进度状态"""
    global DOWNLOAD_PROGRESS
    DOWNLOAD_PROGRESS.update({
        "is_downloading": False,
        "progress": 0.0,
        "error": None,
        "precision": None
    })