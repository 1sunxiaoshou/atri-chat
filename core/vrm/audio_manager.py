"""VRM音频文件生命周期管理器

负责管理TTS生成的临时音频文件：
1. 自动过期清理
2. 会话级别管理
3. 磁盘空间监控
4. 手动清理接口
"""
import os
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from threading import Lock

from ..logger import get_logger

logger = get_logger(__name__, category="VRM")


@dataclass
class AudioFile:
    """音频文件信息"""
    path: Path
    conversation_id: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    size_bytes: int = 0
    accessed_at: float = field(default_factory=time.time)
    
    def is_expired(self, ttl_seconds: int) -> bool:
        """检查是否过期"""
        return (time.time() - self.created_at) > ttl_seconds
    
    def age_seconds(self) -> float:
        """获取文件年龄（秒）"""
        return time.time() - self.created_at


class AudioFileManager:
    """音频文件管理器
    
    管理策略：
    1. 时间过期：默认1小时后自动删除
    2. 会话管理：会话结束时清理相关音频
    3. 空间限制：超过限制时清理最旧的文件
    4. 定期清理：后台任务定期扫描清理
    """
    
    def __init__(
        self,
        audio_dir: Path,
        ttl_seconds: int = 3600,  # 默认1小时
        max_size_mb: int = 500,   # 默认最大500MB
        cleanup_interval: int = 300  # 默认5分钟清理一次
    ):
        """初始化音频文件管理器
        
        Args:
            audio_dir: 音频文件目录
            ttl_seconds: 文件生存时间（秒）
            max_size_mb: 最大磁盘占用（MB）
            cleanup_interval: 清理间隔（秒）
        """
        self.audio_dir = audio_dir
        self.ttl_seconds = ttl_seconds
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.cleanup_interval = cleanup_interval
        
        # 文件追踪
        self._files: Dict[str, AudioFile] = {}  # filename -> AudioFile
        self._conversation_files: Dict[int, Set[str]] = {}  # conversation_id -> filenames
        self._lock = Lock()
        
        # 后台清理任务
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
        
        # 确保目录存在
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        
        # 扫描现有文件
        self._scan_existing_files()
        
        logger.info(
            "音频文件管理器初始化完成",
            extra={
                "audio_dir": str(audio_dir),
                "ttl_seconds": ttl_seconds,
                "max_size_mb": max_size_mb,
                "existing_files": len(self._files)
            }
        )
    
    def register_file(
        self,
        file_path: Path,
        conversation_id: Optional[int] = None
    ) -> str:
        """注册新的音频文件
        
        Args:
            file_path: 音频文件路径
            conversation_id: 关联的会话ID
            
        Returns:
            文件名
        """
        filename = file_path.name
        
        with self._lock:
            # 获取文件大小
            size_bytes = file_path.stat().st_size if file_path.exists() else 0
            
            # 创建文件记录
            audio_file = AudioFile(
                path=file_path,
                conversation_id=conversation_id,
                size_bytes=size_bytes
            )
            
            self._files[filename] = audio_file
            
            # 关联到会话
            if conversation_id is not None:
                if conversation_id not in self._conversation_files:
                    self._conversation_files[conversation_id] = set()
                self._conversation_files[conversation_id].add(filename)
            
            logger.debug(
                "音频文件已注册",
                extra={
                    "filename": filename,
                    "conversation_id": conversation_id,
                    "size_bytes": size_bytes
                }
            )
        
        return filename
    
    def get_total_size(self) -> int:
        """获取总占用空间（字节）"""
        with self._lock:
            return sum(f.size_bytes for f in self._files.values())
    
    def get_file_count(self) -> int:
        """获取文件数量"""
        with self._lock:
            return len(self._files)
    
    def cleanup_conversation(self, conversation_id: int) -> int:
        """清理指定会话的所有音频文件
        
        Args:
            conversation_id: 会话ID
            
        Returns:
            清理的文件数量
        """
        with self._lock:
            filenames = self._conversation_files.get(conversation_id, set()).copy()
            
            if not filenames:
                return 0
            
            cleaned = 0
            for filename in filenames:
                if self._delete_file(filename):
                    cleaned += 1
            
            # 移除会话记录
            if conversation_id in self._conversation_files:
                del self._conversation_files[conversation_id]
            
            logger.info(
                "会话音频文件已清理",
                extra={
                    "conversation_id": conversation_id,
                    "cleaned_count": cleaned
                }
            )
            
            return cleaned
    
    def cleanup_expired(self) -> int:
        """清理过期文件
        
        Returns:
            清理的文件数量
        """
        with self._lock:
            expired_files = [
                filename
                for filename, audio_file in self._files.items()
                if audio_file.is_expired(self.ttl_seconds)
            ]
            
            cleaned = 0
            for filename in expired_files:
                if self._delete_file(filename):
                    cleaned += 1
            
            if cleaned > 0:
                logger.info(
                    "过期音频文件已清理",
                    extra={
                        "cleaned_count": cleaned,
                        "ttl_seconds": self.ttl_seconds
                    }
                )
            
            return cleaned
    
    def cleanup_by_size(self) -> int:
        """按大小清理（删除最旧的文件直到低于限制）
        
        Returns:
            清理的文件数量
        """
        with self._lock:
            total_size = self.get_total_size()
            
            if total_size <= self.max_size_bytes:
                return 0
            
            # 按创建时间排序（最旧的优先）
            sorted_files = sorted(
                self._files.items(),
                key=lambda x: x[1].created_at
            )
            
            cleaned = 0
            for filename, audio_file in sorted_files:
                if total_size <= self.max_size_bytes:
                    break
                
                if self._delete_file(filename):
                    total_size -= audio_file.size_bytes
                    cleaned += 1
            
            if cleaned > 0:
                logger.info(
                    "超限音频文件已清理",
                    extra={
                        "cleaned_count": cleaned,
                        "max_size_mb": self.max_size_bytes / 1024 / 1024,
                        "current_size_mb": total_size / 1024 / 1024
                    }
                )
            
            return cleaned
    
    def cleanup_all(self) -> int:
        """清理所有音频文件
        
        Returns:
            清理的文件数量
        """
        with self._lock:
            filenames = list(self._files.keys())
            
            cleaned = 0
            for filename in filenames:
                if self._delete_file(filename):
                    cleaned += 1
            
            self._conversation_files.clear()
            
            logger.info(
                "所有音频文件已清理",
                extra={"cleaned_count": cleaned}
            )
            
            return cleaned
    
    def _delete_file(self, filename: str) -> bool:
        """删除文件（内部方法，需要持有锁）
        
        Args:
            filename: 文件名
            
        Returns:
            是否成功删除
        """
        if filename not in self._files:
            return False
        
        audio_file = self._files[filename]
        
        try:
            # 删除物理文件
            if audio_file.path.exists():
                audio_file.path.unlink()
            
            # 从追踪中移除
            del self._files[filename]
            
            # 从会话关联中移除
            if audio_file.conversation_id is not None:
                conv_files = self._conversation_files.get(audio_file.conversation_id)
                if conv_files and filename in conv_files:
                    conv_files.remove(filename)
            
            logger.debug(
                "音频文件已删除",
                extra={
                    "filename": filename,
                    "age_seconds": audio_file.age_seconds()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(
                "删除音频文件失败",
                extra={
                    "filename": filename,
                    "error": str(e)
                },
                exc_info=True
            )
            return False
    
    def _scan_existing_files(self):
        """扫描现有文件"""
        if not self.audio_dir.exists():
            return
        
        count = 0
        for file_path in self.audio_dir.glob("*.wav"):
            try:
                size_bytes = file_path.stat().st_size
                created_at = file_path.stat().st_ctime
                
                audio_file = AudioFile(
                    path=file_path,
                    created_at=created_at,
                    size_bytes=size_bytes
                )
                
                self._files[file_path.name] = audio_file
                count += 1
                
            except Exception as e:
                logger.warning(
                    f"扫描音频文件失败: {file_path.name}",
                    extra={"error": str(e)}
                )
        
        if count > 0:
            logger.info(
                "扫描到现有音频文件",
                extra={
                    "count": count,
                    "total_size_mb": self.get_total_size() / 1024 / 1024
                }
            )
    
    async def start_background_cleanup(self):
        """启动后台清理任务"""
        if self._running:
            logger.warning("后台清理任务已在运行")
            return
        
        self._running = True
        self._cleanup_task = asyncio.create_task(self._background_cleanup_loop())
        
        logger.info(
            "后台清理任务已启动",
            extra={"cleanup_interval": self.cleanup_interval}
        )
    
    async def stop_background_cleanup(self):
        """停止后台清理任务"""
        if not self._running:
            return
        
        self._running = False
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        logger.info("后台清理任务已停止")
    
    async def _background_cleanup_loop(self):
        """后台清理循环"""
        logger.debug("后台清理循环开始")
        
        try:
            while self._running:
                await asyncio.sleep(self.cleanup_interval)
                
                # 清理过期文件
                expired_count = self.cleanup_expired()
                
                # 检查空间限制
                size_count = self.cleanup_by_size()
                
                if expired_count > 0 or size_count > 0:
                    logger.debug(
                        "后台清理完成",
                        extra={
                            "expired_count": expired_count,
                            "size_count": size_count,
                            "remaining_files": self.get_file_count(),
                            "total_size_mb": self.get_total_size() / 1024 / 1024
                        }
                    )
                    
        except asyncio.CancelledError:
            logger.debug("后台清理循环被取消")
            raise
        except Exception as e:
            logger.error(
                "后台清理循环异常",
                extra={"error": str(e)},
                exc_info=True
            )
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        with self._lock:
            total_size = self.get_total_size()
            file_count = self.get_file_count()
            
            # 计算过期文件数
            expired_count = sum(
                1 for f in self._files.values()
                if f.is_expired(self.ttl_seconds)
            )
            
            return {
                "file_count": file_count,
                "total_size_bytes": total_size,
                "total_size_mb": total_size / 1024 / 1024,
                "expired_count": expired_count,
                "conversation_count": len(self._conversation_files),
                "max_size_mb": self.max_size_bytes / 1024 / 1024,
                "ttl_seconds": self.ttl_seconds,
                "usage_percent": (total_size / self.max_size_bytes * 100) if self.max_size_bytes > 0 else 0
            }
    
    def __del__(self):
        """析构函数"""
        if self._running:
            logger.warning("AudioFileManager被销毁但后台任务仍在运行")
