"""数据模型定义"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ResponseModel(BaseModel):
    """通用响应模型"""
    code: int = Field(200, description="状态码")
    message: str = Field("success", description="消息")
    data: Optional[Any] = Field(None, description="数据")


# ==================== 供应商相关 ====================

class ProviderConfigRequest(BaseModel):
    """供应商配置请求"""
    provider_id: str = Field(..., description="供应商ID")
    config_json: Dict[str, Any] = Field(..., description="配置JSON")


class ProviderConfigResponse(BaseModel):
    """供应商配置响应"""
    provider_id: str
    config_json: Dict[str, Any]


class ProviderConfigUpdateRequest(BaseModel):
    """供应商配置更新请求"""
    config_json: Dict[str, Any] = Field(..., description="配置JSON")


# ==================== 模型相关 ====================

class ModelRequest(BaseModel):
    """模型请求"""
    provider_id: str = Field(..., description="供应商ID")
    model_id: str = Field(..., description="模型ID")
    model_type: str = Field(..., description="模型类型,见ModelType类")
    capabilities: List[str] = Field(default=["base"], description="模型能力,见Capability类")
    enabled: bool = Field(True, description="是否启用")


class ModelResponse(BaseModel):
    """模型响应"""
    provider_id: str
    model_id: str
    model_type: str
    capabilities: List[str]
    enabled: bool


class ModelUpdateRequest(BaseModel):
    """模型更新请求"""
    model_type: str = Field(..., description="模型类型,见ModelType类")
    capabilities: List[str] = Field(default=["base"], description="模型能力,见Capability类")
    enabled: bool = Field(True, description="是否启用")


# ==================== TTS相关 ====================

class TTSRequest(BaseModel):
    """TTS请求"""
    tts_id: str = Field(..., description="TTS ID")
    provider_id: str = Field(..., description="供应商ID")
    voice_role: str = Field(..., description="语音角色")
    api_key: Optional[str] = Field(None, description="API密钥")
    access_url: Optional[str] = Field(None, description="访问URL")
    enabled: bool = Field(True, description="是否启用")


class TTSResponse(BaseModel):
    """TTS响应"""
    tts_id: str
    provider_id: str
    voice_role: str
    api_key: Optional[str]
    access_url: Optional[str]
    enabled: bool


class TTSUpdateRequest(BaseModel):
    """TTS更新请求"""
    provider_id: str = Field(..., description="供应商ID")
    voice_role: str = Field(..., description="语音角色")
    api_key: Optional[str] = Field(None, description="API密钥")
    access_url: Optional[str] = Field(None, description="访问URL")
    enabled: bool = Field(True, description="是否启用")


# ==================== 角色相关 ====================

class CharacterRequest(BaseModel):
    """角色请求"""
    name: str = Field(..., description="角色名称")
    description: str = Field(..., description="角色描述")
    system_prompt: str = Field(..., description="系统提示词")
    primary_model_id: str = Field(..., description="主模型ID")
    primary_provider_id: str = Field(..., description="主供应商ID")
    tts_id: str = Field(..., description="TTS ID")
    enabled: bool = Field(True, description="是否启用")


class CharacterResponse(BaseModel):
    """角色响应"""
    character_id: int
    name: str
    description: str
    system_prompt: str
    primary_model_id: str
    primary_provider_id: str
    tts_id: str
    enabled: bool


class CharacterUpdateRequest(BaseModel):
    """角色更新请求"""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    primary_model_id: Optional[str] = None
    primary_provider_id: Optional[str] = None
    tts_id: Optional[str] = None
    enabled: Optional[bool] = None


# ==================== 会话相关 ====================

class ConversationRequest(BaseModel):
    """会话请求"""
    character_id: int = Field(..., description="角色ID")
    title: str = Field(..., description="会话标题")


class ConversationResponse(BaseModel):
    """会话响应"""
    conversation_id: int
    character_id: int
    title: str
    created_at: str
    updated_at: str


class ConversationUpdateRequest(BaseModel):
    """会话更新请求"""
    title: Optional[str] = None


# ==================== 消息相关 ====================

class MessageRequest(BaseModel):
    """消息请求"""
    conversation_id: int = Field(..., description="会话ID")
    character_id: int = Field(..., description="角色ID")
    model_id: str = Field(..., description="模型ID")
    provider_id: str = Field(..., description="供应商ID")
    content: str = Field(..., description="消息内容")


class MessageResponse(BaseModel):
    """消息响应"""
    message_id: int
    conversation_id: int
    message_type: str
    content: str
    created_at: str


class ConversationHistoryResponse(BaseModel):
    """会话历史响应"""
    conversation_id: int
    messages: List[MessageResponse]


# ==================== 音频相关 ====================

class AudioMessageRequest(BaseModel):
    """音频消息请求"""
    conversation_id: int = Field(..., description="会话ID")
    character_id: int = Field(..., description="角色ID")
    model_id: str = Field(..., description="模型ID")
    provider_id: str = Field(..., description="供应商ID")
    asr_provider: Optional[str] = Field(None, description="ASR提供商")
    language: Optional[str] = Field(None, description="语言代码")


class TextToSpeechRequest(BaseModel):
    """文本转语音请求"""
    text: str = Field(..., description="要转换的文本")
    tts_provider: Optional[str] = Field(None, description="TTS提供商")
    language: Optional[str] = Field(None, description="语言代码")


# ==================== 缓存相关 ====================

class CacheInfoResponse(BaseModel):
    """缓存信息响应"""
    cached_agents: int
    cache_keys: List[Dict[str, Any]]


class ClearCacheRequest(BaseModel):
    """清空缓存请求"""
    character_id: Optional[int] = Field(None, description="角色ID（可选）")


# ==================== 供应商支持相关 ====================

class SupportedProviderResponse(BaseModel):
    """支持的供应商响应"""
    provider_id: str
    name: str
    description: str
    available_models: List[str]
