"""统一存储层"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from .models.config import ProviderConfig, ModelConfig, ModelType, Capability
from .logger import get_logger
from .paths import get_app_db_path

logger = get_logger(__name__, category="DATABASE")


class AppStorage:
    """应用统一存储"""
    
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or get_app_db_path()
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"初始化 AppStorage", extra={"db_path": self.db_path})
        self._init_db()
    
    def _init_db(self):
        """初始化数据库"""
        with sqlite3.connect(self.db_path) as conn:
            # 模型供应商配置表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS provider_config (
                    provider_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    config_json TEXT NOT NULL,
                    logo TEXT,
                    template_type TEXT DEFAULT 'openai'
                )
            """)
            
            # 模型表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS models (
                    provider_id TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    model_type TEXT NOT NULL,
                    capabilities TEXT NOT NULL,
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
            
            # VRM模型表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS vrm_models (
                    vrm_model_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    model_path TEXT NOT NULL,
                    thumbnail_path TEXT,
                    description TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            
            # VRM动作表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS vrm_animations (
                    animation_id TEXT PRIMARY KEY,
                    vrm_model_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    name_cn TEXT NOT NULL,
                    animation_path TEXT NOT NULL,
                    duration REAL,
                    type TEXT DEFAULT 'short',
                    FOREIGN KEY (vrm_model_id) REFERENCES vrm_models(vrm_model_id)
                )
            """)
            
            # 角色表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS characters (
                    character_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    primary_model_id TEXT,
                    primary_provider_id TEXT,
                    tts_id TEXT NOT NULL,
                    avatar TEXT,
                    avatar_position TEXT DEFAULT 'center',
                    vrm_model_id TEXT,
                    enabled BOOLEAN DEFAULT 1,
                    FOREIGN KEY (vrm_model_id) REFERENCES vrm_models(vrm_model_id)
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
    
    def add_provider(self, config: ProviderConfig, name: str = None, logo: str = None, template_type: str = "openai") -> bool:
        """添加供应商配置"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                provider_name = name or config.provider_id
                conn.execute(
                    "INSERT INTO provider_config VALUES (?, ?, ?, ?, ?)",
                    (config.provider_id, provider_name, json.dumps(config.config_json), logo, template_type)
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def get_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """获取供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT provider_id, name, config_json, logo, template_type FROM provider_config WHERE provider_id = ?",
                (provider_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "provider_id": row[0],
                    "name": row[1],
                    "config_json": json.loads(row[2]),
                    "logo": row[3],
                    "template_type": row[4] if len(row) > 4 else "openai"
                }
        return None
    
    def list_providers(self) -> List[Dict[str, Any]]:
        """列出所有供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT provider_id, name, config_json, logo, template_type FROM provider_config")
            return [
                {
                    "provider_id": row[0],
                    "name": row[1],
                    "config_json": json.loads(row[2]),
                    "logo": row[3],
                    "template_type": row[4] if len(row) > 4 else "openai"
                }
                for row in cursor.fetchall()
            ]
    
    def update_provider(self, provider_id: str, name: str = None, config_json: Dict[str, Any] = None, logo: str = None, template_type: str = None) -> bool:
        """更新供应商配置"""
        with sqlite3.connect(self.db_path) as conn:
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if config_json is not None:
                updates.append("config_json = ?")
                params.append(json.dumps(config_json))
            if logo is not None:
                updates.append("logo = ?")
                params.append(logo)
            if template_type is not None:
                updates.append("template_type = ?")
                params.append(template_type)
            
            if not updates:
                return False
            
            params.append(provider_id)
            query = f"UPDATE provider_config SET {', '.join(updates)} WHERE provider_id = ?"
            cursor = conn.execute(query, params)
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
                capabilities_json = json.dumps([c.value for c in model.capabilities])
                conn.execute(
                    "INSERT INTO models VALUES (?, ?, ?, ?, ?)",
                    (model.provider_id, model.model_id,
                     model.model_type.value, capabilities_json, model.enabled)
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
    
    def get_model(self, provider_id: str, model_id: str) -> Optional[ModelConfig]:
        """获取模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT provider_id, model_id, model_type, capabilities, enabled FROM models WHERE provider_id = ? AND model_id = ?",
                (provider_id, model_id)
            )
            row = cursor.fetchone()
            if row:
                capabilities = [Capability(c) for c in json.loads(row[3])]
                return ModelConfig(
                    provider_id=row[0],
                    model_id=row[1],
                    model_type=ModelType(row[2]),
                    capabilities=capabilities,
                    enabled=bool(row[4])
                )
        return None
    
    def list_models(self, provider_id: Optional[str] = None, model_type: Optional[ModelType] = None, enabled_only: bool = True) -> List[ModelConfig]:
        """列出模型"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT provider_id, model_id, model_type, capabilities, enabled FROM models WHERE 1=1"
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
                    capabilities=[Capability(c) for c in json.loads(row[3])],
                    enabled=bool(row[4])
                )
                for row in cursor.fetchall()
            ]
    
    def update_model(self, model: ModelConfig) -> bool:
        """更新模型"""
        with sqlite3.connect(self.db_path) as conn:
            capabilities_json = json.dumps([c.value for c in model.capabilities])
            cursor = conn.execute(
                "UPDATE models SET model_type = ?, capabilities = ?, enabled = ? WHERE provider_id = ? AND model_id = ?",
                (model.model_type.value, capabilities_json, model.enabled, model.provider_id, model.model_id)
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
                     primary_model_id: Optional[str] = None, primary_provider_id: Optional[str] = None, 
                     tts_id: str = "default", avatar: str = None, avatar_position: str = "center", vrm_model_id: str = None, 
                     enabled: bool = True) -> Optional[int]:
        """添加角色，返回角色ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "INSERT INTO characters (name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, avatar, avatar_position, vrm_model_id, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, avatar, avatar_position, vrm_model_id, enabled)
                )
                conn.commit()
                character_id = cursor.lastrowid
                logger.info(f"添加角色成功", extra={"character_id": character_id, "name": name})
                return character_id
        except sqlite3.IntegrityError as e:
            logger.error(f"添加角色失败", extra={"name": name, "error": str(e)})
            return None
    
    def get_character(self, character_id: int) -> Optional[Dict[str, Any]]:
        """获取角色"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT character_id, name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, avatar, avatar_position, enabled, vrm_model_id FROM characters WHERE character_id = ?",
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
                    "avatar": row[7],
                    "avatar_position": row[8],
                    "enabled": bool(row[9]),
                    "vrm_model_id": row[10] if len(row) > 10 else None
                }
        return None
    
    def list_characters(self, enabled_only: bool = True) -> List[Dict[str, Any]]:
        """列出角色"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT character_id, name, description, system_prompt, primary_model_id, primary_provider_id, tts_id, avatar, avatar_position, enabled, vrm_model_id FROM characters"
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
                    "avatar": row[7],
                    "avatar_position": row[8],
                    "enabled": bool(row[9]),
                    "vrm_model_id": row[10] if len(row) > 10 else None
                }
                for row in cursor.fetchall()
            ]
    
    def update_character(self, character_id: int, **updates) -> bool:
        """更新角色，支持部分字段更新，允许显式设为 NULL"""
        allowed_fields = {
            "name", "description", "system_prompt",
            "primary_model_id", "primary_provider_id",
            "tts_id", "avatar", "avatar_position", "vrm_model_id", "enabled"
        }

        # 过滤非法字段（安全）
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}

        if not filtered_updates:
            return False

        set_clause = ", ".join(f"{key} = ?" for key in filtered_updates)
        params = list(filtered_updates.values()) + [character_id]

        query = f"UPDATE characters SET {set_clause} WHERE character_id = ?"

        with sqlite3.connect(self.db_path) as conn:
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
                conversation_id = cursor.lastrowid
                logger.info(f"创建会话成功", extra={"conversation_id": conversation_id, "character_id": character_id, "title": title})
                return conversation_id
        except sqlite3.IntegrityError as e:
            logger.error(f"创建会话失败", extra={"character_id": character_id, "error": str(e)})
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
                message_id = cursor.lastrowid
                logger.debug(
                    f"添加消息成功",
                    extra={
                        "message_id": message_id,
                        "conversation_id": conversation_id,
                        "message_type": message_type,
                        "content_length": len(content)
                    }
                )
                return message_id
        except sqlite3.IntegrityError as e:
            logger.error(f"添加消息失败", extra={"conversation_id": conversation_id, "error": str(e)})
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
    
    # ==================== VRM模型管理 ====================
    
    def add_vrm_model(self, vrm_model_id: str, name: str, model_path: str,
                     thumbnail_path: Optional[str] = None, description: Optional[str] = None) -> bool:
        """添加VRM模型"""
        try:
            from datetime import datetime
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO vrm_models VALUES (?, ?, ?, ?, ?, ?)",
                    (vrm_model_id, name, model_path, thumbnail_path, description, now)
                )
                conn.commit()
                logger.info(f"添加VRM模型成功", extra={"vrm_model_id": vrm_model_id, "name": name})
            return True
        except sqlite3.IntegrityError as e:
            logger.error(f"添加VRM模型失败", extra={"vrm_model_id": vrm_model_id, "error": str(e)})
            return False
    
    def get_vrm_model(self, vrm_model_id: str) -> Optional[Dict[str, Any]]:
        """获取VRM模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT vrm_model_id, name, model_path, thumbnail_path, description, created_at FROM vrm_models WHERE vrm_model_id = ?",
                (vrm_model_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "vrm_model_id": row[0],
                    "name": row[1],
                    "model_path": row[2],
                    "thumbnail_path": row[3],
                    "description": row[4],
                    "created_at": row[5]
                }
        return None
    
    def list_vrm_models(self) -> List[Dict[str, Any]]:
        """列出所有VRM模型"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT vrm_model_id, name, model_path, thumbnail_path, description, created_at FROM vrm_models ORDER BY created_at DESC"
            )
            return [
                {
                    "vrm_model_id": row[0],
                    "name": row[1],
                    "model_path": row[2],
                    "thumbnail_path": row[3],
                    "description": row[4],
                    "created_at": row[5]
                }
                for row in cursor.fetchall()
            ]
    
    def update_vrm_model(self, vrm_model_id: str, **updates) -> bool:
        """更新VRM模型"""
        allowed_fields = {"name", "model_path", "thumbnail_path", "description"}
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            return False
        
        set_clause = ", ".join(f"{key} = ?" for key in filtered_updates)
        params = list(filtered_updates.values()) + [vrm_model_id]
        query = f"UPDATE vrm_models SET {set_clause} WHERE vrm_model_id = ?"
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_vrm_model(self, vrm_model_id: str) -> bool:
        """删除VRM模型（同时删除关联的动作）"""
        with sqlite3.connect(self.db_path) as conn:
            # 先删除动作
            conn.execute("DELETE FROM vrm_animations WHERE vrm_model_id = ?", (vrm_model_id,))
            # 再删除模型
            cursor = conn.execute("DELETE FROM vrm_models WHERE vrm_model_id = ?", (vrm_model_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== VRM动作管理 ====================
    
    def add_vrm_animation(self, animation_id: str, vrm_model_id: str, name: str, name_cn: str,
                         animation_path: str, duration: Optional[float] = None, 
                         anim_type: str = "short") -> bool:
        """添加VRM动作"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO vrm_animations VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (animation_id, vrm_model_id, name, name_cn, animation_path, duration, anim_type)
                )
                conn.commit()
                logger.info(f"添加VRM动作成功", extra={"animation_id": animation_id, "name": name})
            return True
        except sqlite3.IntegrityError as e:
            logger.error(f"添加VRM动作失败", extra={"animation_id": animation_id, "error": str(e)})
            return False
    
    def get_vrm_animation(self, animation_id: str) -> Optional[Dict[str, Any]]:
        """获取VRM动作"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT animation_id, vrm_model_id, name, name_cn, animation_path, duration, type FROM vrm_animations WHERE animation_id = ?",
                (animation_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "animation_id": row[0],
                    "vrm_model_id": row[1],
                    "name": row[2],
                    "name_cn": row[3],
                    "animation_path": row[4],
                    "duration": row[5],
                    "type": row[6]
                }
        return None
    
    def list_vrm_animations(self, vrm_model_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出VRM动作"""
        with sqlite3.connect(self.db_path) as conn:
            if vrm_model_id:
                cursor = conn.execute(
                    "SELECT animation_id, vrm_model_id, name, name_cn, animation_path, duration, type FROM vrm_animations WHERE vrm_model_id = ?",
                    (vrm_model_id,)
                )
            else:
                cursor = conn.execute(
                    "SELECT animation_id, vrm_model_id, name, name_cn, animation_path, duration, type FROM vrm_animations"
                )
            
            return [
                {
                    "animation_id": row[0],
                    "vrm_model_id": row[1],
                    "name": row[2],
                    "name_cn": row[3],
                    "animation_path": row[4],
                    "duration": row[5],
                    "type": row[6]
                }
                for row in cursor.fetchall()
            ]
    
    def update_vrm_animation(self, animation_id: str, **updates) -> bool:
        """更新VRM动作"""
        allowed_fields = {"name", "name_cn", "animation_path", "duration", "type"}
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            return False
        
        set_clause = ", ".join(f"{key} = ?" for key in filtered_updates)
        params = list(filtered_updates.values()) + [animation_id]
        query = f"UPDATE vrm_animations SET {set_clause} WHERE animation_id = ?"
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_vrm_animation(self, animation_id: str) -> bool:
        """删除VRM动作"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM vrm_animations WHERE animation_id = ?", (animation_id,))
            conn.commit()
            return cursor.rowcount > 0

