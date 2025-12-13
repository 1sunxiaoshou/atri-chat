"""VRM音频文件管理API"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict

from core.dependencies import get_agent_manager
from core.agent_manager import AgentManager
from core.logger import get_logger

logger = get_logger(__name__, category="API")

router = APIRouter(prefix="/vrm/audio", tags=["VRM Audio"])


@router.get("/stats", summary="获取音频文件统计信息")
async def get_audio_stats(
    agent_manager: AgentManager = Depends(get_agent_manager)
) -> Dict:
    """获取音频文件统计信息
    
    Returns:
        统计信息字典
    """
    try:
        stats = agent_manager.vrm_service.get_audio_stats()
        
        logger.info(
            "获取音频统计信息",
            extra={
                "file_count": stats.get("file_count", 0),
                "total_size_mb": stats.get("total_size_mb", 0)
            }
        )
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"获取音频统计信息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup/conversation/{conversation_id}", summary="清理指定会话的音频文件")
async def cleanup_conversation_audio(
    conversation_id: int,
    agent_manager: AgentManager = Depends(get_agent_manager)
) -> Dict:
    """清理指定会话的音频文件
    
    Args:
        conversation_id: 会话ID
        
    Returns:
        清理结果
    """
    try:
        cleaned_count = agent_manager.vrm_service.cleanup_conversation_audio(conversation_id)
        
        logger.info(
            "清理会话音频文件",
            extra={
                "conversation_id": conversation_id,
                "cleaned_count": cleaned_count
            }
        )
        
        return {
            "success": True,
            "message": f"已清理 {cleaned_count} 个音频文件",
            "cleaned_count": cleaned_count
        }
        
    except Exception as e:
        logger.error(
            f"清理会话音频文件失败: {e}",
            extra={"conversation_id": conversation_id},
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup/expired", summary="清理过期音频文件")
async def cleanup_expired_audio(
    agent_manager: AgentManager = Depends(get_agent_manager)
) -> Dict:
    """清理过期音频文件
    
    Returns:
        清理结果
    """
    try:
        cleaned_count = agent_manager.vrm_service.audio_manager.cleanup_expired()
        
        logger.info(
            "清理过期音频文件",
            extra={"cleaned_count": cleaned_count}
        )
        
        return {
            "success": True,
            "message": f"已清理 {cleaned_count} 个过期音频文件",
            "cleaned_count": cleaned_count
        }
        
    except Exception as e:
        logger.error(f"清理过期音频文件失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup/all", summary="清理所有音频文件")
async def cleanup_all_audio(
    agent_manager: AgentManager = Depends(get_agent_manager)
) -> Dict:
    """清理所有音频文件（慎用）
    
    Returns:
        清理结果
    """
    try:
        cleaned_count = agent_manager.vrm_service.audio_manager.cleanup_all()
        
        logger.warning(
            "清理所有音频文件",
            extra={"cleaned_count": cleaned_count}
        )
        
        return {
            "success": True,
            "message": f"已清理 {cleaned_count} 个音频文件",
            "cleaned_count": cleaned_count
        }
        
    except Exception as e:
        logger.error(f"清理所有音频文件失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
