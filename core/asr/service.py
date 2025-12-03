"""ASR配置管理服务"""
import json
import sqlite3
from typing import List, Dict, Optional, Any, Callable
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager

from core.logger import get_logger
from core.paths import get_app_db_path

logger = get_logger(__name__)


class ASRConfigService:
    """ASR配置管理服务"""
    
    def __init__(self, db_path: Optional[str] = None, template_loader: Optional[Callable[[str], Dict[str, Any]]] = None):
        """初始化
        
        Args:
            db_path: 数据库路径
            template_loader: 模板加载器函数，用于获取provider的配置模板（避免循环导入）
        """
        self.db_path = db_path or get_app_db_path()
        self.template_loader = template_loader
        self._init_table()
    
    @contextmanager
    def _get_connection(self):
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_table(self):
        """初始化数据库表"""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS asr_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider_id VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    is_active BOOLEAN DEFAULT 0,
                    is_configured BOOLEAN DEFAULT 0,
                    config_data TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    
    def init_provider(self, provider_id: str, name: str, config_template: Dict[str, Any]):
        """检查服务商是否已存在
        
        Args:
            provider_id: 服务商ID
            
        Returns:
            是否存在
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT 1 FROM asr_settings WHERE provider_id = ?",
                (provider_id,)
            )
            return cursor.fetchone() is not None
    
    def init_provider(self, provider_id: str, name: str, config_template: Dict[str, Any]):
        """初始化服务商（创建未配置的初始记录）
        
        Args:
            provider_id: 服务商ID
            name: 服务商显示名称
            config_template: 配置模板（带UI元数据）
        """
        # 存储模板（不包含value，前端用于渲染表单）
        config_json = json.dumps(config_template, ensure_ascii=False)
        
        with self._get_connection() as conn:
            # 使用 INSERT OR IGNORE 避免重复插入错误
            conn.execute("""
                INSERT OR IGNORE INTO asr_settings (provider_id, name, is_active, is_configured, config_data, updated_at)
                VALUES (?, ?, 0, 0, ?, ?)
            """, (provider_id, name, config_json, datetime.now().isoformat()))
            conn.commit()
    
    def get_all_providers(self) -> Dict[str, Any]:
        """获取所有服务商配置列表
        
        Returns:
            {
                "active_provider": "openai" or None,
                "providers": [...]
            }
        """
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT provider_id, name, is_active, is_configured, config_data
                FROM asr_settings
                ORDER BY id
            """)
            rows = cursor.fetchall()
        
        active_provider = None
        providers = []
        
        for row in rows:
            provider_data = {
                "id": row["provider_id"],
                "name": row["name"],
                "is_configured": bool(row["is_configured"]),
                "config": None
            }
            
            # 返回配置（不脱敏）
            if row["config_data"]:
                try:
                    config = json.loads(row["config_data"])
                    provider_data["config"] = config
                except json.JSONDecodeError as e:
                    logger.error(f"解析 {row['provider_id']} 配置失败: {e}")
            
            providers.append(provider_data)
            
            if row["is_active"]:
                active_provider = row["provider_id"]
        
        return {
            "active_provider": active_provider,
            "providers": providers
        }
    
    def get_provider_config(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """获取指定服务商的配置（明文，仅返回值）
        
        Args:
            provider_id: 服务商ID
            
        Returns:
            配置字典（仅包含字段名和值），不存在返回None
        """
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT config_data, is_configured
                FROM asr_settings
                WHERE provider_id = ?
            """, (provider_id,))
            row = cursor.fetchone()
        
        if not row or not row["is_configured"]:
            return None
        
        try:
            full_config = json.loads(row["config_data"])
            # 提取实际值（去掉元数据）
            return self._extract_values(full_config)
        except json.JSONDecodeError as e:
            logger.error(f"解析 {provider_id} 配置失败: {e}")
            return None
    
    def _extract_values(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """从配置中提取实际值
        
        Args:
            config: 完整配置（带元数据）
            
        Returns:
            仅包含字段名和值的字典
        """
        values = {}
        for key, field_config in config.items():
            if isinstance(field_config, dict) and "type" in field_config:
                # 从value字段提取，如果没有则使用default
                values[key] = field_config.get("value", field_config.get("default"))
            else:
                # 不应该出现这种情况，但为了安全还是处理一下
                logger.warning(f"配置字段 {key} 格式异常，应为元数据格式")
                values[key] = field_config
        return values
    
    def save_config(self, provider_id: str, name: str, config: Dict[str, Any], set_active: bool = True) -> bool:
        """保存配置
        
        Args:
            provider_id: 服务商ID
            name: 服务商显示名称
            config: 配置字典（前端传来的 {field_name: value} 格式）
            set_active: 是否设置为当前生效的服务商
            
        Returns:
            是否成功
        """
        # 获取模板
        template = self._get_template(provider_id)
        if not template:
            raise ValueError(f"无法获取服务商 {provider_id} 的配置模板")
        
        # 验证配置
        self._validate_config(template, config)
        
        # 将用户提交的值合并到模板中
        full_config = self._merge_values(template, config)
        config_json = json.dumps(full_config, ensure_ascii=False)
        
        with self._get_connection() as conn:
            # 如果设置为active，先取消其他的active状态
            if set_active:
                conn.execute("UPDATE asr_settings SET is_active = 0")
            
            # 插入或更新配置
            conn.execute("""
                INSERT INTO asr_settings (provider_id, name, is_active, is_configured, config_data, updated_at)
                VALUES (?, ?, ?, 1, ?, ?)
                ON CONFLICT(provider_id) DO UPDATE SET
                    name = excluded.name,
                    is_active = excluded.is_active,
                    is_configured = 1,
                    config_data = excluded.config_data,
                    updated_at = excluded.updated_at
            """, (provider_id, name, int(set_active), config_json, datetime.now().isoformat()))
            conn.commit()
        
        return True
    
    def _validate_config(self, template: Dict[str, Any], config: Dict[str, Any]):
        """验证配置
        
        Args:
            template: 配置模板
            config: 用户提交的配置
            
        Raises:
            ValueError: 配置验证失败
        """
        for key, field_meta in template.items():
            if not isinstance(field_meta, dict) or "type" not in field_meta:
                logger.error(f"配置模板字段 {key} 格式错误")
                continue
            
            # 检查必填字段
            if field_meta.get("required", False):
                value = config.get(key)
                if value is None or value == "":
                    raise ValueError(f"字段 '{field_meta.get('label', key)}' 是必填项")
            
            # 检查数字类型的范围
            if field_meta.get("type") == "number" and key in config:
                value = config[key]
                if value is not None:
                    min_val = field_meta.get("min")
                    max_val = field_meta.get("max")
                    if min_val is not None and value < min_val:
                        raise ValueError(f"字段 '{field_meta.get('label', key)}' 的值不能小于 {min_val}")
                    if max_val is not None and value > max_val:
                        raise ValueError(f"字段 '{field_meta.get('label', key)}' 的值不能大于 {max_val}")
            
            # 检查选项类型的值
            if field_meta.get("type") == "select" and key in config:
                value = config[key]
                options = field_meta.get("options", [])
                if value is not None and options and value not in options:
                    raise ValueError(f"字段 '{field_meta.get('label', key)}' 的值必须是以下之一: {', '.join(options)}")
    
    def _get_template(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """获取服务商的配置模板
        
        Args:
            provider_id: 服务商ID
            
        Returns:
            配置模板，失败返回None
        """
        # 先从数据库读取
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT config_data FROM asr_settings WHERE provider_id = ?",
                (provider_id,)
            )
            row = cursor.fetchone()
        
        if row and row["config_data"]:
            try:
                return json.loads(row["config_data"])
            except json.JSONDecodeError as e:
                logger.error(f"解析 {provider_id} 配置模板失败: {e}")
        
        # 数据库中没有，使用template_loader获取
        if self.template_loader:
            try:
                return self.template_loader(provider_id)
            except Exception as e:
                logger.error(f"加载 {provider_id} 配置模板失败: {e}")
        
        return None
    
    def _merge_values(self, template: Dict[str, Any], values: Dict[str, Any]) -> Dict[str, Any]:
        """将用户值合并到模板中
        
        Args:
            template: 配置模板（带元数据）
            values: 用户提交的值
            
        Returns:
            合并后的完整配置
        """
        merged = {}
        for key, field_config in template.items():
            if not isinstance(field_config, dict) or "type" not in field_config:
                logger.error(f"配置模板字段 {key} 格式错误，应为元数据格式")
                continue
            
            # 保留元数据，添加value
            merged[key] = field_config.copy()
            merged[key]["value"] = values.get(key, field_config.get("default"))
        return merged
    
    def get_active_provider(self) -> Optional[tuple[str, Dict[str, Any]]]:
        """获取当前生效的服务商配置（仅返回值）
        
        Returns:
            (provider_id, config) 或 None，config仅包含字段名和值
        """
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT provider_id, config_data
                FROM asr_settings
                WHERE is_active = 1 AND is_configured = 1
                LIMIT 1
            """)
            row = cursor.fetchone()
        
        if not row:
            return None
        
        try:
            full_config = json.loads(row["config_data"])
            # 提取实际值
            config = self._extract_values(full_config)
            return (row["provider_id"], config)
        except json.JSONDecodeError as e:
            logger.error(f"解析活动服务商配置失败: {e}")
            return None
    
    def disable_asr(self) -> bool:
        """禁用ASR功能（取消所有active状态）
        
        Returns:
            是否成功
        """
        with self._get_connection() as conn:
            conn.execute("UPDATE asr_settings SET is_active = 0")
            conn.commit()
        return True
