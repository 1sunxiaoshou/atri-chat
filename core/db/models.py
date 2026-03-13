"""SQLAlchemy ORM 模型 - 完整数据库架构"""
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Column, String, Integer, Float, Text, Boolean, ForeignKey, 
    DateTime, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .base import Base


def generate_uuid() -> str:
    """生成 UUID 字符串"""
    return str(uuid.uuid4())


# ==================== 资产表 ====================

class Avatar(Base):
    """3D 形象资产表
    
    存储 VRM 格式的 3D 模型资产，可被多个角色引用
    文件路径由 ID 动态构建：/static/vrm/models/{id}.vrm
    """
    __tablename__ = "assets_avatars"
    
    # 主键（同时也是文件名）
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    
    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    has_thumbnail: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # VRM 特性
    available_expressions: Mapped[Optional[str]] = mapped_column(
        Text, 
        nullable=True,
        comment="可用表情列表（JSON 数组格式，如 [\"neutral\", \"happy\", \"angry\"]）"
    )
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 反向关系：被哪些角色引用
    characters: Mapped[List["Character"]] = relationship(
        "Character", back_populates="avatar", cascade="save-update"
    )
    
    def __repr__(self):
        return f"<Avatar(id={self.id}, name={self.name})>"
    
    @property
    def file_url(self) -> str:
        """动态构建文件URL（用于API响应）"""
        return f"/static/vrm/models/{self.id}.vrm"
    
    @property
    def thumbnail_url(self) -> Optional[str]:
        """动态构建缩略图URL（用于API响应）"""
        if self.has_thumbnail:
            return f"/static/vrm/thumbnails/{self.id}.jpg"
        return None
    
    def get_file_path(self):
        """获取文件系统路径（用于后端文件操作）"""
        from core.config import get_settings
        return get_settings().vrm_models_dir / f"{self.id}.vrm"
    
    def get_thumbnail_path(self):
        """获取缩略图文件系统路径（用于后端文件操作）"""
        from core.config import get_settings
        if self.has_thumbnail:
            return get_settings().vrm_thumbnails_dir / f"{self.id}.jpg"
        return None


class Motion(Base):
    """动作资产表
    
    存储可重用的动画文件（.vrma, .vmd, .fbx 等），可被多个角色绑定
    文件路径由 ID 动态构建：/static/vrm/motions/{id}.vrma
    ID 使用 5 位短 UUID，避免文件名过长
    """
    __tablename__ = "assets_motions"
    
    # 主键（同时也是文件名，5位短UUID）
    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    
    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    
    # 可选信息
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # JSON 数组
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 反向关系：被哪些角色绑定
    bindings: Mapped[List["CharacterMotionBinding"]] = relationship(
        "CharacterMotionBinding", back_populates="motion", cascade="save-update"
    )
    
    def __repr__(self):
        return f"<Motion(id={self.id}, name={self.name}, duration_ms={self.duration_ms})>"
    
    @property
    def file_url(self) -> str:
        """动态构建文件URL（用于API响应）"""
        return f"/static/vrm/motions/{self.id}.vrma"
    
    def get_file_path(self):
        """获取文件系统路径（用于后端文件操作）"""
        from core.config import get_settings
        return get_settings().vrm_motions_dir / f"{self.id}.vrma"


class TTSProvider(Base):
    """TTS 供应商配置表
    
    存储供应商级别的配置（API Key、服务地址等）
    一个供应商可以有多个音色
    """
    __tablename__ = "tts_providers"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 基本信息
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # openai/gpt_sovits/azure
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    config_payload: Mapped[dict] = mapped_column(JSON, nullable=False)  # 供应商级别配置
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 关系：该供应商下的音色列表
    voices: Mapped[List["VoiceAsset"]] = relationship(
        "VoiceAsset", back_populates="provider", cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<TTSProvider(id={self.id}, type={self.provider_type}, name={self.name})>"


class VoiceAsset(Base):
    """音色资产表（最小单位）
    
    存储具体的音色配置（voice_id、参考音频等）
    可被多个角色引用
    """
    __tablename__ = "assets_voices_v2"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 外键
    provider_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tts_providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    voice_config: Mapped[dict] = mapped_column(JSON, nullable=False)  # 音色级别配置
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 关系
    provider: Mapped["TTSProvider"] = relationship("TTSProvider", back_populates="voices")
    characters: Mapped[List["Character"]] = relationship(
        "Character", 
        foreign_keys="Character.voice_asset_id",
        back_populates="voice_asset"
    )
    
    def __repr__(self):
        return f"<VoiceAsset(id={self.id}, name={self.name}, provider={self.provider_id})>"


# ==================== 模型配置表 ====================

class ProviderConfig(Base):
    """模型供应商配置表"""
    __tablename__ = "provider_configs"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 供应商显示名称
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    # 供应商类型（驱动类型，如 openai, anthropic）
    provider_type: Mapped[str] = mapped_column(String(50), default="openai")
    
    # 配置信息
    config_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 关系
    models: Mapped[List["Model"]] = relationship(
        "Model", back_populates="provider", cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<ProviderConfig(id={self.id}, name={self.name})>"


class Model(Base):
    """模型配置表"""
    __tablename__ = "models"
    
    # 主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # 外键
    provider_config_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("provider_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # 模型信息
    model_id: Mapped[str] = mapped_column(String(255), nullable=False)
    model_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # chat/embedding/rerank
    capabilities: Mapped[dict] = mapped_column(JSON, nullable=False)  # JSON 数组
    context_window: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_output: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 关系
    provider: Mapped["ProviderConfig"] = relationship("ProviderConfig", back_populates="models")
    characters: Mapped[List["Character"]] = relationship(
        "Character", back_populates="primary_model", cascade="save-update"
    )
    
    # 唯一约束
    __table_args__ = (
        UniqueConstraint("provider_config_id", "model_id", name="uq_provider_model"),
    )
    
    def __repr__(self):
        return f"<Model(id={self.id}, provider_config_id={self.provider_config_id}, model_id={self.model_id})>"


# ==================== 角色表 ====================

class Character(Base):
    """角色表
    
    组合视觉、语音和行为的 AI 智能体实体
    """
    __tablename__ = "characters"
    
    # 主键
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    
    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    portrait_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, comment="2D立绘/头像URL")
    
    # 外键引用（可选，使用 RESTRICT 防止删除被引用的资产）
    avatar_id: Mapped[Optional[str]] = mapped_column(
        String(36), 
        ForeignKey("assets_avatars.id", ondelete="RESTRICT"), 
        nullable=True,
        index=True,
        comment="3D形象资产ID（可选）"
    )
    
    # 语音配置：引用音色资产（可选）
    voice_asset_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("assets_voices_v2.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    voice_speaker_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # 主模型（可选）
    primary_model_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="关联的模型内部 ID"
    )
    primary_provider_config_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("provider_configs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="关联的供应商内部 ID"
    )
    
    # 状态
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # 关系
    avatar: Mapped[Optional["Avatar"]] = relationship("Avatar", back_populates="characters")
    voice_asset: Mapped[Optional["VoiceAsset"]] = relationship("VoiceAsset", back_populates="characters")
    primary_model: Mapped[Optional["Model"]] = relationship("Model", back_populates="characters")
    motion_bindings: Mapped[List["CharacterMotionBinding"]] = relationship(
        "CharacterMotionBinding", 
        back_populates="character", 
        cascade="all, delete-orphan"  # 删除角色时级联删除绑定
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="character",
        cascade="all, delete-orphan"  # 删除角色时级联删除会话
    )
    
    def __repr__(self):
        return f"<Character(id={self.id}, name={self.name})>"


class CharacterMotionBinding(Base):
    """角色-动作绑定表

    多对多关系，支持分类
    """
    __tablename__ = "character_motion_bindings"

    # 主键
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)

    # 外键
    character_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("characters.id", ondelete="CASCADE"),  # 删除角色时级联删除
        nullable=False,
        index=True
    )
    motion_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets_motions.id", ondelete="RESTRICT"),  # 防止删除被绑定的动作
        nullable=False,
        index=True
    )

    # 分类
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )  # 'idle', 'thinking', 'reply'

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # 关系
    character: Mapped["Character"] = relationship("Character", back_populates="motion_bindings")
    motion: Mapped["Motion"] = relationship("Motion", back_populates="bindings")

    # 唯一约束：同一角色不能在同一分类下重复绑定同一动作
    __table_args__ = (
        UniqueConstraint("character_id", "motion_id", "category", name="uq_character_motion_category"),
        Index("idx_bindings_character_category", "character_id", "category"),
    )

    def __repr__(self):
        return f"<CharacterMotionBinding(character_id={self.character_id}, motion_id={self.motion_id}, category={self.category})>"




# ==================== 会话表 ====================

class Conversation(Base):
    """会话表"""
    __tablename__ = "conversations"
    
    # 主键
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    
    # 外键
    character_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # 基本信息
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True
    )
    
    # 关系
    character: Mapped["Character"] = relationship("Character", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",  # 删除会话时级联删除消息
        order_by="Message.created_at"
    )
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, title={self.title})>"


class Message(Base):
    """消息表"""
    __tablename__ = "messages"
    
    # 主键
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    
    # 外键
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # 消息内容
    message_type: Mapped[str] = mapped_column(String(50), nullable=False)  # user/assistant/system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    # 关系
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    
    def __repr__(self):
        return f"<Message(id={self.id}, type={self.message_type})>"
