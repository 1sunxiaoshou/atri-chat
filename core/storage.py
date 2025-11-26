"""统一存储层"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from .models.config import ProviderConfig, ModelConfig, ModelType


class AppStorage:
    """应用统一存储"""
    
    def __init__(self, db_path: str = "data/app.db"):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """初始化数据库"""
        with sqlite3.connect(self.db_path) as conn:
            # 模型供应商配置表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS provider_config (
                    provider_id TEXT PRIMARY KEY,
                    config_json TEXT NOT NULL
                )
            """)
            
            # 模型表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS models (
                    provider_id TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    model_type TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    enabled BOOLEAN DEFAULT 1,
                    PRIMARY KEY (provider_id, model_id),
                    FOREIGN KEY (provider_id) REFERENCES provider_config(provider_id)
                )
            """)
            
            # TTS 表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tts_models (
                    tts_id TEXT PRIMARY KEY,
                    provider_id TEXT NOT NULL,
                    voice_role TEXT NOT NULL,
                    api_key TEXT,
                    access_url TEXT,
                    enabled BOOLEAN DEFAULT 1
                )
            """)
            
            # 角色表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS characters (
                    character_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    primary_model_id TEXT NOT NULL,
                    primary_provider_id TEXT NOT NULL,
                    tts_id TEXT NOT NULL,
                    enabled BOOLEAN DEFAULT 1,
                    FOREIGN KEY (primary_provider_id, primary_model_id) REFERENCES models(provider_id, model_id),
                    FOREIGN KEY (tts_id) REFERENCES tts_models(tts_id)
                )
            """)
            
            # 角色工具配置表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS character_tools (
                    character_id INTEGER NOT NULL,
                    tool_name TEXT NOT NULL,
                    enabled BOOLEAN DEFAULT 1,
                    PRIMARY KEY (character_id, tool_name),
                    FOREIGN KEY (character_id) REFERENCES characters(character_id)
                )
            """)
            
            # 角色中间件配置表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS character_middleware (
                    character_id INTEGER PRIMARY KEY,
                    config_json TEXT NOT NULL,
                    FOREIGN KEY (character_id) REFERENCES characters(character_id)
                )
            """)
            
            # 会话表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    character_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (character_id) REFERENCES characters(character_id)
                )
            """)
            
            # 消息表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER NOT NULL,
                    message_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
                )
            """)
            
            conn.commit()
    
    # ==================== 模型供应商配置 ====================
    
    def add_provider(self, config: ProviderConfig) -> bool:
        """添加供应商配置"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO provider_config VALUES (?, ?)",
                    (config.provider_id, json.dumps(config.config_json))
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def get_provider(self, provider_id: str) -> Optional[ProviderConfig]:
        """获取供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT provider_id, config_json FROM provider_config WHERE provider_id = ?",
                (provider_id,)
            )
            row = cursor.fetchone()
            if row:
                return ProviderConfig(
                    provider_id=row[0],
                    config_json=json.loads(row[1])
                )
        return None
    
    def list_providers(self) -> List[ProviderConfig]:
        """列出所有供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT provider_id, config_json FROM provider_config")
            return [
                ProviderConfig(
                    provider_id=row[0],
                    config_json=json.loads(row[1])
                )
                for row in cursor.fetchall()
            ]
    
    def update_provider(self, config: ProviderConfig) -> bool:
        """更新供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "UPDATE provider_config SET config_json = ? WHERE provider_id = ?",
                (json.dumps(config.config_json), config.provider_id)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_provider(self, provider_id: str) -> bool:
        """删除供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM provider_config WHERE provider_id = ?", (provider_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 模型管理 ====================
    
    def add_model(self, model: ModelConfig) -> bool:
        """添加模型"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO models VALUES (?, ?, ?, ?, ?)",
                    (model.provider_id, model.model_id,
                     model.model_type.value, model.mode, model.enabled)
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def get_model(self, provider_id: str, model_id: str) -> Optional[ModelConfig]:
        """获取模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT provider_id, model_id, model_type, mode, enabled FROM models WHERE provider_id = ? AND model_id = ?",
                (provider_id, model_id)
            )
            row = cursor.fetchone()
            if row:
                return ModelConfig(
                    provider_id=row[0],
                    model_id=row[1],
                    model_type=ModelType(row[2]),
                    mode=row[3],
                    enabled=bool(row[4])
                )
        return None
    
    def list_models(self, provider_id: Optional[str] = None, model_type: Optional[ModelType] = None, enabled_only: bool = True) -> List[ModelConfig]:
        """列出模型"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT provider_id, model_id, model_type, mode, enabled FROM models WHERE 1=1"
            params = []
            
            if provider_id:
                query += " AND provider_id = ?"
                params.append(provider_id)
            
            if model_type:
                query += " AND model_type = ?"
                params.append(model_type.value)
            
            if enabled_only:
                query += " AND enabled = 1"
            
            cursor = conn.execute(query, params)
            return [
                ModelConfig(
                    provider_id=row[0],
                    model_id=row[1],
                    model_type=ModelType(row[2]),
                    mode=row[3],
                    enabled=bool(row[4])
                )
                for row in cursor.fetchall()
            ]
    
    def update_model(self, model: ModelConfig) -> bool:
        """更新模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "UPDATE models SET model_type = ?, mode = ?, enabled = ? WHERE provider_id = ? AND model_id = ?",
                (model.model_type.value, model.mode, model.enabled, model.provider_id, model.model_id)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_model(self, provider_id: str, model_id: str) -> bool:
        """删除模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM models WHERE provider_id = ? AND model_id = ?", (provider_id, model_id))
            conn.commit()
            return cursor.rowcount > 0

    # ==================== TTS 管理 ====================
    
    def add_tts(self, tts_id: str, provider_id: str, voice_role: str, 
                api_key: Optional[str] = None, access_url: Optional[str] = None, 
                enabled: bool = True) -> bool:
        """添加 TTS 模型"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO tts_models VALUES (?, ?, ?, ?, ?, ?)",
                    (tts_id, provider_id, voice_role, api_key, access_url, enabled)
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def get_tts(self, tts_id: str) -> Optional[Dict[str, Any]]:
        """获取 TTS 模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT tts_id, provider_id, voice_role, api_key, access_url, enabled FROM tts_models WHERE tts_id = ?",
                (tts_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "tts_id": row[0],
                    "provider_id": row[1],
                    "voice_role": row[2],
                    "api_key": row[3],
                    "access_url": row[4],
                    "enabled": bool(row[5])
                }
        return None
    
    def list_tts(self, provider_id: Optional[str] = None, enabled_only: bool = True) -> List[Dict[str, Any]]:
        """列出 TTS 模型"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT tts_id, provider_id, voice_role, api_key, access_url, enabled FROM tts_models WHERE 1=1"
            params = []
            
            if provider_id:
                query += " AND provider_id = ?"
                params.append(provider_id)
            
            if enabled_only:
                query += " AND enabled = 1"
            
            cursor = conn.execute(query, params)
            return [
                {
                    "tts_id": row[0],
                    "provider_id": row[1],
                    "voice_role": row[2],
                    "api_key": row[3],
                    "access_url": row[4],
                    "enabled": bool(row[5])
                }
                for row in cursor.fetchall()
            ]
    
    def update_tts(self, tts_id: str, provider_id: Optional[str] = None, 
                   voice_role: Optional[str] = None, api_key: Optional[str] = None,
                   access_url: Optional[str] = None, enabled: Optional[bool] = None) -> bool:
        """更新 TTS 模型"""
        with sqlite3.connect(self.db_path) as conn:
            updates = []
            params = []
            
            if provider_id is not None:
                updates.append("provider_id = ?")
                params.append(provider_id)
            if voice_role is not None:
                updates.append("voice_role = ?")
                params.append(voice_role)
            if api_key is not None:
                updates.append("api_key = ?")
                params.append(api_key)
            if access_url is not None:
                updates.append("access_url = ?")
                params.append(access_url)
            if enabled is not None:
                updates.append("enabled = ?")
                params.append(enabled)
            
            if not updates:
                return False
            
            params.append(tts_id)
            query = f"UPDATE tts_models SET {', '.join(updates)} WHERE tts_id = ?"
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_tts(self, tts_id: str) -> bool:
        """删除 TTS 模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM tts_models WHERE tts_id = ?", (tts_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 角色管理 ====================
    
    def add_character(self, name: str, description: str, system_prompt: str,
                     primary_model_id: str, primary_provider_id: str, tts_id: str,
                     enabled: bool = True) -> Optional[int]:
        """添加角色，返回角色ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "INSERT INTO characters (name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, enabled)
                )
                conn.commit()
                return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    
    def get_character(self, character_id: int) -> Optional[Dict[str, Any]]:
        """获取角色"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT character_id, name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, enabled FROM characters WHERE character_id = ?",
                (character_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "character_id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "system_prompt": row[3],
                    "primary_model_id": row[4],
                    "primary_provider_id": row[5],
                    "tts_id": row[6],
                    "enabled": bool(row[7])
                }
        return None
    
    def list_characters(self, enabled_only: bool = True) -> List[Dict[str, Any]]:
        """列出角色"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT character_id, name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, enabled FROM characters"
            if enabled_only:
                query += " WHERE enabled = 1"
            
            cursor = conn.execute(query)
            return [
                {
                    "character_id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "system_prompt": row[3],
                    "primary_model_id": row[4],
                    "primary_provider_id": row[5],
                    "tts_id": row[6],
                    "enabled": bool(row[7])
                }
                for row in cursor.fetchall()
            ]
    
    def update_character(self, character_id: int, name: Optional[str] = None,
                        description: Optional[str] = None, system_prompt: Optional[str] = None,
                        primary_model_id: Optional[str] = None, primary_provider_id: Optional[str] = None,
                        tts_id: Optional[str] = None, enabled: Optional[bool] = None) -> bool:
        """更新角色"""
        with sqlite3.connect(self.db_path) as conn:
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if description is not None:
                updates.append("description = ?")
                params.append(description)
            if system_prompt is not None:
                updates.append("system_prompt = ?")
                params.append(system_prompt)
            if primary_model_id is not None:
                updates.append("primary_model_id = ?")
                params.append(primary_model_id)
            if primary_provider_id is not None:
                updates.append("primary_provider_id = ?")
                params.append(primary_provider_id)
            if tts_id is not None:
                updates.append("tts_id = ?")
                params.append(tts_id)
            if enabled is not None:
                updates.append("enabled = ?")
                params.append(enabled)
            
            if not updates:
                return False
            
            params.append(character_id)
            query = f"UPDATE characters SET {', '.join(updates)} WHERE character_id = ?"
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_character(self, character_id: int) -> bool:
        """删除角色"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM characters WHERE character_id = ?", (character_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 会话管理 ====================
    
    def create_conversation(self, character_id: int, title: str) -> Optional[int]:
        """创建会话，返回会话ID"""
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "INSERT INTO conversations (character_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (character_id, title, now, now)
                )
                conn.commit()
                return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    
    def get_conversation(self, conversation_id: int) -> Optional[Dict[str, Any]]:
        """获取会话"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT conversation_id, character_id, title, created_at, updated_at FROM conversations WHERE conversation_id = ?",
                (conversation_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "conversation_id": row[0],
                    "character_id": row[1],
                    "title": row[2],
                    "created_at": row[3],
                    "updated_at": row[4]
                }
        return None
    
    def list_conversations(self, character_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """列出会话"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT conversation_id, character_id, title, created_at, updated_at FROM conversations"
            params = []
            
            if character_id is not None:
                query += " WHERE character_id = ?"
                params.append(character_id)
            
            query += " ORDER BY updated_at DESC"
            
            cursor = conn.execute(query, params)
            return [
                {
                    "conversation_id": row[0],
                    "character_id": row[1],
                    "title": row[2],
                    "created_at": row[3],
                    "updated_at": row[4]
                }
                for row in cursor.fetchall()
            ]
    
    def update_conversation(self, conversation_id: int, title: Optional[str] = None) -> bool:
        """更新会话"""
        with sqlite3.connect(self.db_path) as conn:
            now = datetime.now().isoformat()
            updates = ["updated_at = ?"]
            params = [now]
            
            if title is not None:
                updates.append("title = ?")
                params.append(title)
            
            params.append(conversation_id)
            query = f"UPDATE conversations SET {', '.join(updates)} WHERE conversation_id = ?"
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_conversation(self, conversation_id: int) -> bool:
        """删除会话（同时删除关联的消息）"""
        with sqlite3.connect(self.db_path) as conn:
            # 先删除消息
            conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
            # 再删除会话
            cursor = conn.execute("DELETE FROM conversations WHERE conversation_id = ?", (conversation_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 消息管理 ====================
    
    def add_message(self, conversation_id: int, message_type: str, content: str) -> Optional[int]:
        """添加消息，返回消息ID"""
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "INSERT INTO messages (conversation_id, message_type, content, created_at) VALUES (?, ?, ?, ?)",
                    (conversation_id, message_type, content, now)
                )
                # 更新会话的 updated_at
                conn.execute(
                    "UPDATE conversations SET updated_at = ? WHERE conversation_id = ?",
                    (now, conversation_id)
                )
                conn.commit()
                return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    
    def get_message(self, message_id: int) -> Optional[Dict[str, Any]]:
        """获取消息"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT message_id, conversation_id, message_type, content, created_at FROM messages WHERE message_id = ?",
                (message_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "message_id": row[0],
                    "conversation_id": row[1],
                    "message_type": row[2],
                    "content": row[3],
                    "created_at": row[4]
                }
        return None
    
    def list_messages(self, conversation_id: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """列出会话的消息"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT message_id, conversation_id, message_type, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
            params = [conversation_id]
            
            if limit is not None:
                query += " LIMIT ?"
                params.append(limit)
            
            cursor = conn.execute(query, params)
            return [
                {
                    "message_id": row[0],
                    "conversation_id": row[1],
                    "message_type": row[2],
                    "content": row[3],
                    "created_at": row[4]
                }
                for row in cursor.fetchall()
            ]
    
    def delete_message(self, message_id: int) -> bool:
        """删除消息"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM messages WHERE message_id = ?", (message_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_messages_by_conversation(self, conversation_id: int) -> int:
        """删除会话的所有消息，返回删除数量"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
            conn.commit()
            return cursor.rowcount
    
    # ==================== 角色工具配置 ====================
    
    def add_character_tool(self, character_id: int, tool_name: str, enabled: bool = True) -> bool:
        """为角色添加工具"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO character_tools VALUES (?, ?, ?)",
                    (character_id, tool_name, enabled)
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def list_character_tools(self, character_id: int) -> List[Dict[str, Any]]:
        """列出角色的工具配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT character_id, tool_name, enabled FROM character_tools WHERE character_id = ?",
                (character_id,)
            )
            return [
                {
                    "character_id": row[0],
                    "tool_name": row[1],
                    "enabled": bool(row[2])
                }
                for row in cursor.fetchall()
            ]
    
    def update_character_tool(self, character_id: int, tool_name: str, enabled: bool) -> bool:
        """更新角色工具的启用状态"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "UPDATE character_tools SET enabled = ? WHERE character_id = ? AND tool_name = ?",
                (enabled, character_id, tool_name)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_character_tool(self, character_id: int, tool_name: str) -> bool:
        """删除角色的工具配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM character_tools WHERE character_id = ? AND tool_name = ?",
                (character_id, tool_name)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 角色中间件配置 ====================
    
    def save_middleware_config(self, character_id: int, config: Dict[str, Any]) -> bool:
        """保存角色的中间件配置"""
        config_json = json.dumps(config)
        with sqlite3.connect(self.db_path) as conn:
            # 检查是否存在
            cursor = conn.execute(
                "SELECT 1 FROM character_middleware WHERE character_id = ?",
                (character_id,)
            )
            exists = cursor.fetchone() is not None
            
            if exists:
                conn.execute(
                    "UPDATE character_middleware SET config_json = ? WHERE character_id = ?",
                    (config_json, character_id)
                )
            else:
                conn.execute(
                    "INSERT INTO character_middleware VALUES (?, ?)",
                    (character_id, config_json)
                )
            conn.commit()
        return True
    
    def get_middleware_config(self, character_id: int) -> Optional[Dict[str, Any]]:
        """获取角色的中间件配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT config_json FROM character_middleware WHERE character_id = ?",
                (character_id,)
            )
            row = cursor.fetchone()
            if row:
                return json.loads(row[0])
        return None
    
    def delete_middleware_config(self, character_id: int) -> bool:
        """删除角色的中间件配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM character_middleware WHERE character_id = ?",
                (character_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
