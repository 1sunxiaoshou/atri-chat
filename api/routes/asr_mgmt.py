"""ASR 管理路由 - 模型状态与下载控制"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Literal
from api.schemas import ResponseModel
from core.asr import SenseVoiceASR
from core.asr.model_downloader import get_model_info, delete_model_assets, get_download_progress, download_sensevoice_model_async, reset_download_progress
from core.dependencies import get_asr
from core.logger import get_logger
from core.config import get_settings, AppSettings

router = APIRouter()
logger = get_logger(__name__)

class DownloadRequest(BaseModel):
    """模型下载请求"""
    precision: Literal["int8", "fp32", "both"] = Field(
        default="int8", 
        description="下载精度: int8 (极速), fp32 (高精度), both (全部)"
    )

@router.get("/status", response_model=ResponseModel)
async def get_asr_status(settings: AppSettings = Depends(get_settings)):
    """获取 ASR 模型状态"""
    try:
        model_dir = settings.asr_models_dir / "sensevoice"
        info = get_model_info(model_dir)
        
        # 获取全局下载进度状态
        progress_info = get_download_progress()
        
        return ResponseModel(
            code=200,
            message="获取成功",
            data={
                "exists": info["exists"],
                "int8_ready": info["int8"],
                "fp32_ready": info["fp32"],
                "total_size_mb": info["total_size_mb"],
                "int8_size_mb": info["int8_size_mb"],
                "fp32_size_mb": info["fp32_size_mb"],
                "is_downloading": progress_info["is_downloading"],
                "progress": progress_info["progress"],
                "download_error": progress_info["error"],
                "download_precision": progress_info["precision"]
            }
        )
    except Exception:
        logger.exception("获取 ASR 状态失败")
        raise HTTPException(status_code=500, detail="获取状态异常")

@router.post("/download", response_model=ResponseModel)
async def trigger_download(
    req: DownloadRequest,
    background_tasks: BackgroundTasks,
    settings: AppSettings = Depends(get_settings)
):
    """触发模型下载"""
    try:
        # 检查是否正在下载
        progress_info = get_download_progress()
        if progress_info["is_downloading"]:
            return ResponseModel(code=400, message="模型正在下载中，请勿重复触发")
        
        model_dir = settings.asr_models_dir / "sensevoice"
        
        # 使用 FastAPI BackgroundTasks 触发异步下载
        background_tasks.add_task(
            download_sensevoice_model_async,
            target_dir=model_dir,
            precision=req.precision,
        )
        
        return ResponseModel(
            code=200,
            message="下载任务已启动",
            data={"precision": req.precision}
        )
    except Exception:
        logger.exception("触发 ASR 下载失败")
        raise HTTPException(status_code=500, detail="任务触发失败")

@router.delete("/clear", response_model=ResponseModel)
async def clear_asr_models(
    precision: str = "all",
    settings: AppSettings = Depends(get_settings),
    asr: SenseVoiceASR = Depends(get_asr)
):
    """清理 ASR 模型资源"""
    try:
        model_dir = settings.asr_models_dir / "sensevoice"
        success = delete_model_assets(model_dir, precision=precision)
        
        # 强制重置 ASR 单例状态（防止野指针）
        asr._recognizer = None
        asr._current_use_int8 = None
        asr._current_language = None
        
        # 重置全局下载进度状态
        reset_download_progress()
        
        return ResponseModel(
            code=200,
            message="资源清理成功" if success else "资源目录不存在或已清理",
            data={"success": success}
        )
    except Exception:
        logger.exception("清理 ASR 资源失败")
        raise HTTPException(status_code=500, detail="清理失败")
