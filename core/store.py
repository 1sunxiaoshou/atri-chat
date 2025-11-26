"""LangGraph 本地持久化 Store 实现"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Sequence, Tuple, Iterator
from langgraph.store.base import BaseStore, Item


class SqliteStore(BaseStore):
    """基于 SQLite 的本地持久化 Store 实现
    
    用于在 LangGraph 中跨线程保存和检索用户信息、偏好等业务数据。
    """
    
    def __init__(self, db_path: str = "data/store.db"):
        """初始化 SQLite Store
        
        Args:
            db_path: SQLite 数据库文件路径
        """
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """初始化数据库表"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS store_items (
                    namespace TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (namespace, key)
                )
            """)
            conn.commit()
    
    def _namespace_to_str(self, namespace: Tuple) -> str:
        """将命名空间元组转换为字符串"""
        return "/".join(str(n) for n in namespace)
    
    def _str_to_namespace(self, namespace_str: str) -> Tuple:
        """将命名空间字符串转换为元组"""
        return tuple(namespace_str.split("/"))
    
    def mget(self, keys: Sequence[str]) -> List[Optional[bytes]]:
        """获取多个键的值
        
        Args:
            keys: 键列表，格式为 "namespace/key"
            
        Returns:
            值列表，不存在的键返回 None
        """
        result = []
        with sqlite3.connect(self.db_path) as conn:
            for key in keys:
                namespace_str, item_key = self._parse_key(key)
                cursor = conn.execute(
                    "SELECT value FROM store_items WHERE namespace = ? AND key = ?",
                    (namespace_str, item_key)
                )
                row = cursor.fetchone()
                if row:
                    result.append(row[0].encode() if isinstance(row[0], str) else row[0])
                else:
                    result.append(None)
        return result
    
    def mset(self, key_value_pairs: Sequence[Tuple[str, bytes]]) -> None:
        """设置多个键值对
        
        Args:
            key_value_pairs: (key, value) 元组列表，key 格式为 "namespace/key"
        """
        now = datetime.now().isoformat()
        with sqlite3.connect(self.db_path) as conn:
            for key, value in key_value_pairs:
                namespace_str, item_key = self._parse_key(key)
                value_str = value.decode() if isinstance(value, bytes) else value
                
                # 检查是否存在
                cursor = conn.execute(
                    "SELECT 1 FROM store_items WHERE namespace = ? AND key = ?",
                    (namespace_str, item_key)
                )
                exists = cursor.fetchone() is not None
                
                if exists:
                    conn.execute(
                        "UPDATE store_items SET value = ?, updated_at = ? WHERE namespace = ? AND key = ?",
                        (value_str, now, namespace_str, item_key)
                    )
                else:
                    conn.execute(
                        "INSERT INTO store_items (namespace, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                        (namespace_str, item_key, value_str, now, now)
                    )
            conn.commit()
    
    def mdelete(self, keys: Sequence[str]) -> None:
        """删除多个键
        
        Args:
            keys: 键列表，格式为 "namespace/key"
        """
        with sqlite3.connect(self.db_path) as conn:
            for key in keys:
                namespace_str, item_key = self._parse_key(key)
                conn.execute(
                    "DELETE FROM store_items WHERE namespace = ? AND key = ?",
                    (namespace_str, item_key)
                )
            conn.commit()
    
    def yield_keys(self, prefix: Optional[str] = None) -> Iterator[str]:
        """遍历所有键
        
        Args:
            prefix: 可选的前缀过滤
            
        Yields:
            键列表，格式为 "namespace/key"
        """
        with sqlite3.connect(self.db_path) as conn:
            if prefix:
                cursor = conn.execute(
                    "SELECT namespace, key FROM store_items WHERE namespace LIKE ? OR key LIKE ?",
                    (f"{prefix}%", f"{prefix}%")
                )
            else:
                cursor = conn.execute("SELECT namespace, key FROM store_items")
            
            for row in cursor:
                yield f"{row[0]}/{row[1]}"
    
    def batch(self, *args, **kwargs):
        """批处理操作（同步）"""
        raise NotImplementedError("batch 操作不支持")
    
    async def abatch(self, *args, **kwargs):
        """批处理操作（异步）"""
        raise NotImplementedError("abatch 操作不支持")
    
    def _parse_key(self, key: str) -> Tuple[str, str]:
        """解析键为命名空间和项键
        
        Args:
            key: 格式为 "namespace/key" 的键
            
        Returns:
            (namespace_str, item_key) 元组
        """
        parts = key.rsplit("/", 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return "", key
    
    # ==================== 高级操作 ====================
    
    def put(self, namespace: Tuple, key: str, value: dict) -> None:
        """存储一个项
        
        Args:
            namespace: 命名空间元组，如 ("user_1", "memories")
            key: 项的唯一键
            value: 要存储的字典值
        """
        namespace_str = self._namespace_to_str(namespace)
        value_json = json.dumps(value)
        now = datetime.now().isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT 1 FROM store_items WHERE namespace = ? AND key = ?",
                (namespace_str, key)
            )
            exists = cursor.fetchone() is not None
            
            if exists:
                conn.execute(
                    "UPDATE store_items SET value = ?, updated_at = ? WHERE namespace = ? AND key = ?",
                    (value_json, now, namespace_str, key)
                )
            else:
                conn.execute(
                    "INSERT INTO store_items (namespace, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (namespace_str, key, value_json, now, now)
                )
            conn.commit()
    
    def search(self, namespace: Tuple, query: Optional[str] = None, limit: int = 10) -> List[Item]:
        """搜索命名空间中的项
        
        Args:
            namespace: 命名空间元组
            query: 可选的搜索查询（简单的内容匹配）
            limit: 返回的最大项数
            
        Returns:
            Item 对象列表
        """
        namespace_str = self._namespace_to_str(namespace)
        
        with sqlite3.connect(self.db_path) as conn:
            if query:
                # 简单的内容匹配搜索
                cursor = conn.execute(
                    "SELECT key, value, created_at, updated_at FROM store_items WHERE namespace = ? AND value LIKE ? ORDER BY updated_at DESC LIMIT ?",
                    (namespace_str, f"%{query}%", limit)
                )
            else:
                cursor = conn.execute(
                    "SELECT key, value, created_at, updated_at FROM store_items WHERE namespace = ? ORDER BY updated_at DESC LIMIT ?",
                    (namespace_str, limit)
                )
            
            items = []
            for row in cursor:
                try:
                    value = json.loads(row[1])
                except json.JSONDecodeError:
                    value = {"raw": row[1]}
                
                item = Item(
                    key=row[0],
                    value=value,
                    namespace=namespace,
                    created_at=row[2],
                    updated_at=row[3]
                )
                items.append(item)
            
            return items
    
    def get(self, namespace: Tuple, key: str) -> Optional[Item]:
        """获取单个项
        
        Args:
            namespace: 命名空间元组
            key: 项的键
            
        Returns:
            Item 对象或 None
        """
        namespace_str = self._namespace_to_str(namespace)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT key, value, created_at, updated_at FROM store_items WHERE namespace = ? AND key = ?",
                (namespace_str, key)
            )
            row = cursor.fetchone()
            
            if row:
                try:
                    value = json.loads(row[1])
                except json.JSONDecodeError:
                    value = {"raw": row[1]}
                
                return Item(
                    key=row[0],
                    value=value,
                    namespace=namespace,
                    created_at=row[2],
                    updated_at=row[3]
                )
        return None
    
    def delete(self, namespace: Tuple, key: str) -> bool:
        """删除单个项
        
        Args:
            namespace: 命名空间元组
            key: 项的键
            
        Returns:
            是否成功删除
        """
        namespace_str = self._namespace_to_str(namespace)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM store_items WHERE namespace = ? AND key = ?",
                (namespace_str, key)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def list_namespace(self, namespace: Tuple) -> List[Item]:
        """列出命名空间中的所有项
        
        Args:
            namespace: 命名空间元组
            
        Returns:
            Item 对象列表
        """
        namespace_str = self._namespace_to_str(namespace)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT key, value, created_at, updated_at FROM store_items WHERE namespace = ? ORDER BY updated_at DESC",
                (namespace_str,)
            )
            
            items = []
            for row in cursor:
                try:
                    value = json.loads(row[1])
                except json.JSONDecodeError:
                    value = {"raw": row[1]}
                
                item = Item(
                    key=row[0],
                    value=value,
                    namespace=namespace,
                    created_at=row[2],
                    updated_at=row[3]
                )
                items.append(item)
            
            return items
    
    def clear_namespace(self, namespace: Tuple) -> int:
        """清空命名空间中的所有项
        
        Args:
            namespace: 命名空间元组
            
        Returns:
            删除的项数
        """
        namespace_str = self._namespace_to_str(namespace)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM store_items WHERE namespace = ?",
                (namespace_str,)
            )
            conn.commit()
            return cursor.rowcount
