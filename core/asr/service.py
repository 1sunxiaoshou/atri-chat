"""ASR配置管理服务"""
import json
import sqlite3
from typing import List, Dict, Optional, Any
from datetime import datetime
from pathlib import Path


class ASRConfigService:
    """ASR配置管理服务"""
    
    def __init__(self, db_path: str = "data/app.db"):
        """初始化
        
        Args:
            db_path: 数据库路径
        """
        self.db_path = db_path
        self._init_table()
    
    def _init_table(self):
        """初始化数据库表"""
        with sqlite3.connect(self.db_path) as conn:
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
    
    def provider_exists(self, provider_id: str) -> bool:
        """检查服务商是否已存在
        
        Args:
            provider_id: 服务商ID
            
        Returns:
            是否存在
        """
        with sqlite3.connect(self.db_path) as conn:
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
            config_template: 配置模板
        """
        # 直接存储JSON（不加密）
        config_json = json.dumps(config_template, ensure_ascii=False)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO asr_settings (provider_id, name, is_active, is_configured, config_data, updated_at)
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
        with sqlite3.connect(self.db_path) as conn:
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
            
            # 返回配置（已配置时脱敏，未配置时返回模板）
            if row["config_data"]:
                try:
                    config = json.loads(row["config_data"])
                    
                    if row["is_configured"]:
                        # 已配置：脱敏敏感字段
                        provider_data["config"] = self._mask_sensitive_fields(config, row["provider_id"])
                    else:
                        # 未配置：返回完整模板（供前端显示表单）
                        provider_data["config"] = config
                except Exception as e:
                    # 记录JSON解析失败的错误
                    print(f"⚠️  解析 {row['provider_id']} 配置失败: {e}")
            
            providers.append(provider_data)
            
            if row["is_active"]:
                active_provider = row["provider_id"]
        
        return {
            "active_provider": active_provider,
            "providers": providers
        }
    
    def get_provider_config(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """获取指定服务商的配置（明文）
        
        Args:
            provider_id: 服务商ID
            
        Returns:
            配置字典，不存在返回None
        """
        with sqlite3.connect(self.db_path) as conn:
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
            return json.loads(row["config_data"])
        except Exception:
            return None
    
    def save_config(self, provider_id: str, name: str, config: Dict[str, Any], set_active: bool = True) -> bool:
        """保存配置
        
        Args:
            provider_id: 服务商ID
            name: 服务商显示名称
            config: 配置字典
            set_active: 是否设置为当前生效的服务商
            
        Returns:
            是否成功
        """
        # 直接存储JSON（不加密）
        config_json = json.dumps(config, ensure_ascii=False)
        
        with sqlite3.connect(self.db_path) as conn:
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
    
    def get_active_provider(self) -> Optional[tuple[str, Dict[str, Any]]]:
        """获取当前生效的服务商配置
        
        Returns:
            (provider_id, config) 或 None
        """
        with sqlite3.connect(self.db_path) as conn:
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
            config = json.loads(row["config_data"])
            return (row["provider_id"], config)
        except Exception:
            return None
    
    def disable_asr(self) -> bool:
        """禁用ASR功能（取消所有active状态）
        
        Returns:
            是否成功
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("UPDATE asr_settings SET is_active = 0")
            conn.commit()
        return True
    
    def _mask_sensitive_fields(self, config: Dict[str, Any], provider_id: str) -> Dict[str, Any]:
        """脱敏敏感字段
        
        Args:
            config: 原始配置
            provider_id: 服务商ID
            
        Returns:
            脱敏后的配置
        """
        masked = config.copy()
        
        # 获取该服务商的敏感字段列表
        try:
            from .factory import ASRFactory
            factory = ASRFactory(self.db_path)
            provider_class = factory._get_provider_class(provider_id)
            sensitive_keys = provider_class.get_sensitive_fields()
        except Exception:
            # 如果获取失败，使用默认的敏感字段列表
            sensitive_keys = ["api_key", "secret_key", "access_key", "password", "token"]
        
        for key in sensitive_keys:
            if key in masked and masked[key]:
                value = str(masked[key])
                if len(value) > 8:
                    masked[key] = value[:4] + "******" + value[-4:]
                else:
                    masked[key] = "******"
        
        return masked
