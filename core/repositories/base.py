"""基础 Repository 接口"""

from abc import ABC, abstractmethod
from typing import TypeVar

from sqlalchemy.orm import Session

T = TypeVar("T")


class BaseRepository[T](ABC):
    """基础仓储接口

    提供通用的 CRUD 操作接口，具体实现由子类完成。
    """

    def __init__(self, db: Session):
        """初始化 Repository

        Args:
            db: SQLAlchemy Session（请求级别）
        """
        self.db = db

    @abstractmethod
    def get(self, id: str) -> T | None:
        """根据 ID 获取实体

        Args:
            id: 实体 ID

        Returns:
            实体对象，不存在则返回 None
        """
        pass

    @abstractmethod
    def list(self, skip: int = 0, limit: int = 100, **filters) -> list[T]:
        """列出实体

        Args:
            skip: 跳过记录数
            limit: 返回记录数
            **filters: 过滤条件

        Returns:
            实体列表
        """
        pass

    @abstractmethod
    def create(self, **data) -> T:
        """创建实体

        Args:
            **data: 实体数据

        Returns:
            创建的实体
        """
        pass

    @abstractmethod
    def update(self, id: str, **data) -> T | None:
        """更新实体

        Args:
            id: 实体 ID
            **data: 更新数据

        Returns:
            更新后的实体，不存在则返回 None
        """
        pass

    @abstractmethod
    def delete(self, id: str) -> bool:
        """删除实体

        Args:
            id: 实体 ID

        Returns:
            是否删除成功
        """
        pass

    def count(self, **filters) -> int:
        """统计实体数量

        Args:
            **filters: 过滤条件

        Returns:
            实体数量
        """
        return len(self.list(**filters))
