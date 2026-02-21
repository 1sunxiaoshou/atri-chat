"""统一路径管理"""
import os
from pathlib import Path
from functools import lru_cache


class PathManager:
    """路径管理器"""
    
    def __init__(self):
        # 项目根目录
        self.root = Path(__file__).parent.parent.resolve()
        
        # 核心目录（从环境变量读取，支持自定义）
        self.data_dir = self._ensure_dir(self.root / os.getenv("DATA_DIR", "data"))
        self.logs_dir = self._ensure_dir(self.root / os.getenv("LOGS_DIR", "logs"))
        self.uploads_dir = self._ensure_dir(self.data_dir / "uploads")
        
        # 静态文件目录
        self.static_dir = self.root / "static"
        if not self.static_dir.exists():
            self.static_dir.mkdir(parents=True, exist_ok=True)
        
        # 上传子目录
        self.avatars_dir = self._ensure_dir(self.uploads_dir / "avatars")
        self.vrm_models_dir = self._ensure_dir(self.uploads_dir / "vrm_models")
        self.vrm_animations_dir = self._ensure_dir(self.uploads_dir / "vrm_animations")
        self.vrm_thumbnails_dir = self._ensure_dir(self.uploads_dir / "vrm_thumbnails")
        
        # ASR 模型目录
        self.asr_models_dir = self._ensure_dir(
            self.root / os.getenv("ASR_MODELS_DIR", "data/models")
        )
    
    def _ensure_dir(self, path: Path) -> Path:
        """确保目录存在"""
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    # 数据库路径
    @property
    def app_db(self) -> Path:
        return self.data_dir / "app.db"
    
    @property
    def store_db(self) -> Path:
        return self.data_dir / "store.db"
    
    @property
    def checkpoints_db(self) -> Path:
        return self.data_dir / "checkpoints.db"
    
    # 文件系统路径（用于读写文件）
    def get_vrm_model_path(self, filename: str) -> Path:
        return self.vrm_models_dir / filename
    
    def get_vrm_animation_path(self, filename: str) -> Path:
        return self.vrm_animations_dir / filename
    
    def get_vrm_thumbnail_path(self, filename: str) -> Path:
        return self.vrm_thumbnails_dir / filename
    
    # URL 构建（用于 API 响应）
    def build_url(self, relative_path: str) -> str:
        """构建完整 URL（添加域名前缀等）"""
        # 简单实现：直接返回相对路径
        # 如需要完整 URL，可在这里添加域名
        return relative_path


@lru_cache()
def get_path_manager() -> PathManager:
    """获取路径管理器单例"""
    return PathManager()


# 便捷函数
def get_app_db_path() -> str:
    return str(get_path_manager().app_db)


def get_store_db_path() -> str:
    return str(get_path_manager().store_db)


def get_checkpoints_db_path() -> str:
    return str(get_path_manager().checkpoints_db)
