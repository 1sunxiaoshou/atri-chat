"""统一路径管理模块

提供项目中所有路径的集中管理，支持：
- 自动创建目录
- 路径规范化
- 环境变量配置
- 跨平台兼容
"""
import os
from pathlib import Path
from typing import Optional
from functools import lru_cache

from core.logger import get_logger

logger = get_logger(__name__)


class PathManager:
    """路径管理器"""
    
    def __init__(self, base_dir: Optional[Path] = None):
        """初始化路径管理器
        
        Args:
            base_dir: 项目根目录，默认为当前文件的父目录的父目录
        """
        if base_dir is None:
            # 获取项目根目录（core的父目录）
            self.base_dir = Path(__file__).parent.parent.resolve()
        else:
            self.base_dir = Path(base_dir).resolve()
        
        # 从环境变量读取配置（如果存在）
        self._load_from_env()
    
    def _load_from_env(self):
        """从环境变量加载路径配置"""
        # 数据目录
        self._data_dir = os.getenv("DATA_DIR", "data")
        # 日志目录
        self._logs_dir = os.getenv("LOGS_DIR", "logs")
        # 静态文件目录
        self._static_dir = os.getenv("STATIC_DIR", "static")
        # 上传文件目录
        self._uploads_dir = os.getenv("UPLOADS_DIR", "data/uploads")
        # ASR模型目录
        self._asr_models_dir = os.getenv("ASR_MODELS_DIR", "asr_models")
    
    def _resolve_path(self, path: str) -> Path:
        """解析路径（支持相对路径和绝对路径）
        
        Args:
            path: 路径字符串
            
        Returns:
            解析后的Path对象
        """
        p = Path(path)
        if p.is_absolute():
            return p.resolve()
        return (self.base_dir / p).resolve()
    
    def _ensure_dir(self, path: Path, description: str = "") -> Path:
        """确保目录存在
        
        Args:
            path: 目录路径
            description: 目录描述（用于日志）
            
        Returns:
            目录路径
        """
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
        return path
    
    # ==================== 核心目录 ====================
    
    @property
    def root(self) -> Path:
        """项目根目录"""
        return self.base_dir
    
    @property
    def data_dir(self) -> Path:
        """数据目录"""
        return self._ensure_dir(self._resolve_path(self._data_dir), "数据目录")
    
    @property
    def logs_dir(self) -> Path:
        """日志目录"""
        return self._ensure_dir(self._resolve_path(self._logs_dir), "日志目录")
    
    @property
    def static_dir(self) -> Path:
        """静态文件目录"""
        return self._ensure_dir(self._resolve_path(self._static_dir), "静态文件目录")
    
    @property
    def uploads_dir(self) -> Path:
        """上传文件目录"""
        return self._ensure_dir(self._resolve_path(self._uploads_dir), "上传文件目录")
    
    @property
    def avatars_dir(self) -> Path:
        """头像目录"""
        return self._ensure_dir(self.uploads_dir / "avatars", "头像目录")
    
    @property
    def asr_models_dir(self) -> Path:
        """ASR模型目录"""
        return self._ensure_dir(self._resolve_path(self._asr_models_dir), "ASR模型目录")
    
    @property
    def frontend_dist(self) -> Path:
        """前端构建目录"""
        return self.base_dir / "frontend" / "dist"
    
    # ==================== VRM 相关目录 ====================
    
    @property
    def vrm_models_dir(self) -> Path:
        """VRM 模型目录"""
        return self._ensure_dir(self.uploads_dir / "vrm_models", "VRM模型目录")
    
    @property
    def vrm_animations_dir(self) -> Path:
        """VRM 动作目录"""
        return self._ensure_dir(self.uploads_dir / "vrm_animations", "VRM动作目录")
    
    @property
    def vrm_thumbnails_dir(self) -> Path:
        """VRM 缩略图目录"""
        return self._ensure_dir(self.uploads_dir / "vrm_thumbnails", "VRM缩略图目录")
    
    # ==================== 数据库文件 ====================
    
    @property
    def app_db(self) -> Path:
        """应用数据库文件路径"""
        return self.data_dir / "app.db"
    
    @property
    def store_db(self) -> Path:
        """Store数据库文件路径"""
        return self.data_dir / "store.db"
    
    @property
    def checkpoints_db(self) -> Path:
        """Checkpoints数据库文件路径"""
        return self.data_dir / "checkpoints.db"
    
    # ==================== 配置文件 ====================
    
    @property
    def config_dir(self) -> Path:
        """配置文件目录"""
        return self.base_dir / "config"
    
    def get_config_file(self, name: str) -> Path:
        """获取配置文件路径
        
        Args:
            name: 配置文件名（如 "asr.yaml"）
            
        Returns:
            配置文件路径
        """
        return self.config_dir / name
    
    # ==================== 工具方法 ====================
    
    def normalize_path(self, path: str) -> str:
        """规范化路径（处理Windows反斜杠）
        
        Args:
            path: 原始路径字符串
            
        Returns:
            规范化后的路径字符串
        """
        # 统一使用单个反斜杠（Windows）或正斜杠（Unix）
        normalized = path.replace("\\\\", "\\")
        return str(Path(normalized))
    
    def resolve_model_path(self, path: str) -> Path:
        """解析模型路径（支持相对于asr_models_dir的路径）
        
        Args:
            path: 模型路径（可以是相对路径或绝对路径）
            
        Returns:
            解析后的绝对路径
        """
        p = Path(path)
        
        # 如果是绝对路径，直接返回
        if p.is_absolute():
            return p.resolve()
        
        # 如果路径以 ./asr_models 开头，转换为相对于项目根目录
        if path.startswith("./asr_models") or path.startswith(".\\asr_models"):
            return (self.base_dir / path.lstrip("./").lstrip(".\\")).resolve()
        
        # 否则相对于 asr_models_dir
        return (self.asr_models_dir / path).resolve()
    
    def get_relative_path(self, path: Path) -> str:
        """获取相对于项目根目录的路径
        
        Args:
            path: 绝对路径
            
        Returns:
            相对路径字符串
        """
        try:
            return str(path.relative_to(self.base_dir))
        except ValueError:
            # 如果不在项目目录下，返回绝对路径
            return str(path)
    
    # ==================== VRM URL 构建 ====================
    
    def build_vrm_model_url(self, filename: str) -> str:
        """构建 VRM 模型的 URL 路径
        
        Args:
            filename: 文件名（如 "model_abc123.vrm"）
            
        Returns:
            URL 路径（如 "/uploads/vrm_models/model_abc123.vrm"）
        """
        return f"/uploads/vrm_models/{filename}"
    
    def build_vrm_animation_url(self, filename: str) -> str:
        """构建 VRM 动作的 URL 路径
        
        Args:
            filename: 文件名（如 "wave_abc123.vrma"）
            
        Returns:
            URL 路径（如 "/uploads/vrm_animations/wave_abc123.vrma"）
        """
        return f"/uploads/vrm_animations/{filename}"
    
    def build_vrm_thumbnail_url(self, filename: Optional[str]) -> Optional[str]:
        """构建 VRM 缩略图的 URL 路径
        
        Args:
            filename: 文件名（如 "model_abc123.jpg"），可为 None
            
        Returns:
            URL 路径（如 "/uploads/vrm_thumbnails/model_abc123.jpg"），或 None
        """
        if not filename:
            return None
        return f"/uploads/vrm_thumbnails/{filename}"
    
    def get_vrm_model_path(self, filename: str) -> Path:
        """获取 VRM 模型的文件系统路径
        
        Args:
            filename: 文件名
            
        Returns:
            文件系统路径
        """
        return self.vrm_models_dir / filename
    
    def get_vrm_animation_path(self, filename: str) -> Path:
        """获取 VRM 动作的文件系统路径
        
        Args:
            filename: 文件名
            
        Returns:
            文件系统路径
        """
        return self.vrm_animations_dir / filename
    
    def get_vrm_thumbnail_path(self, filename: str) -> Path:
        """获取 VRM 缩略图的文件系统路径
        
        Args:
            filename: 文件名
            
        Returns:
            文件系统路径
        """
        return self.vrm_thumbnails_dir / filename


# ==================== 全局单例 ====================

@lru_cache()
def get_path_manager() -> PathManager:
    """获取路径管理器单例"""
    return PathManager()


# ==================== 便捷访问 ====================

def get_data_dir() -> Path:
    """获取数据目录"""
    return get_path_manager().data_dir


def get_logs_dir() -> Path:
    """获取日志目录"""
    return get_path_manager().logs_dir


def get_uploads_dir() -> Path:
    """获取上传文件目录"""
    return get_path_manager().uploads_dir


def get_app_db_path() -> str:
    """获取应用数据库路径（字符串格式）"""
    return str(get_path_manager().app_db)


def get_store_db_path() -> str:
    """获取Store数据库路径（字符串格式）"""
    return str(get_path_manager().store_db)


def get_checkpoints_db_path() -> str:
    """获取Checkpoints数据库路径（字符串格式）"""
    return str(get_path_manager().checkpoints_db)
