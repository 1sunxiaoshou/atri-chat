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
    name: str = Field(..., description="供应商显示名称")
    config_payload: Dict[str, Any] = Field(..., description="配置详情")
    provider_type: Optional[str] = Field("openai", description="供应商模板类型: openai/anthropic/google/qwen/local")


class ProviderConfigUpdateRequest(BaseModel):
    """供应商配置更新请求"""
    name: Optional[str] = Field(None, description="供应商显示名称")
    config_payload: Optional[Dict[str, Any]] = Field(None, description="配置详情")
    provider_type: Optional[str] = Field(None, description="供应商模板类型")


# ==================== 模型相关 ====================

class ModelRequest(BaseModel):
    """模型请求"""
    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    model_id: str = Field(..., description="模型ID")
    model_type: str = Field(..., description="模型类型: chat, embedding, rerank")
    capabilities: List[str] = Field(default_factory=list, description="模型能力: vision, reasoning, tool_use, web_search")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    max_output: Optional[int] = Field(None, description="最大输出token数")
    enabled: bool = Field(True, description="是否启用")


class ModelResponse(BaseModel):
    """模型响应"""
    id: int
    provider_config_id: int
    model_id: str
    model_type: str
    capabilities: List[str]
    context_window: Optional[int]
    max_output: Optional[int]
    enabled: bool


class ModelUpdateRequest(BaseModel):
    """模型更新请求"""
    model_type: str = Field(..., description="模型类型: chat, embedding, rerank")
    capabilities: List[str] = Field(default_factory=list, description="模型能力: vision, reasoning, tool_use, web_search")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    max_output: Optional[int] = Field(None, description="最大输出token数")
    enabled: bool = Field(True, description="是否启用")


# ==================== TTS相关 ====================

class TTSRequest(BaseModel):
    """TTS请求"""
    tts_id: str = Field(..., description="TTS ID")
    provider_id: int = Field(..., description="供应商与配置的内部ID")
    voice_role: str = Field(..., description="语音角色")
    api_key: Optional[str] = Field(None, description="API密钥")
    access_url: Optional[str] = Field(None, description="访问URL")


class TTSResponse(BaseModel):
    """TTS响应"""
    tts_id: str
    provider_id: int
    voice_role: str
    api_key: Optional[str]
    access_url: Optional[str]


class TTSUpdateRequest(BaseModel):
    """TTS更新请求"""
    provider_id: int = Field(..., description="供应商与配置的内部ID")
    voice_role: str = Field(..., description="语音角色")
    api_key: Optional[str] = Field(None, description="API密钥")
    access_url: Optional[str] = Field(None, description="访问URL")
    enabled: bool = Field(True, description="是否启用")




class CharacterCreate(BaseModel):
    """创建角色 (新架构)"""
    name: str = Field(..., description="角色名称")
    system_prompt: str = Field(..., description="系统提示词")
    portrait_url: Optional[str] = Field(None, description="2D立绘/头像URL")
    avatar_id: str = Field(..., description="3D形象资产ID")
    voice_asset_id: int = Field(..., description="音色资产ID")
    voice_speaker_id: Optional[str] = Field(None, description="音色说话人ID（可选）")
    primary_model_id: Optional[int] = Field(None, description="主模型内部 ID（可选）")
    primary_provider_config_id: Optional[int] = Field(None, description="主供应商内部 ID（可选）")
    enabled: bool = Field(True, description="是否启用")


class CharacterUpdate(BaseModel):
    """更新角色 (新架构)"""
    name: Optional[str] = Field(None, description="角色名称")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    portrait_url: Optional[str] = Field(None, description="2D立绘/头像URL")
    avatar_id: Optional[str] = Field(None, description="3D形象资产ID")
    voice_asset_id: Optional[int] = Field(None, description="音色资产ID")
    voice_speaker_id: Optional[str] = Field(None, description="音色说话人ID")
    primary_model_id: Optional[int] = Field(None, description="主模型内部 ID")
    primary_provider_config_id: Optional[int] = Field(None, description="主供应商内部 ID")
    enabled: Optional[bool] = Field(None, description="是否启用")






# ==================== 会话相关 ====================

class ConversationRequest(BaseModel):
    """会话请求"""
    character_id: str = Field(..., description="角色ID（UUID）")
    title: Optional[str] = Field("New Chat", description="会话标题")


class ConversationResponse(BaseModel):
    """会话响应"""
    conversation_id: str
    character_id: str
    title: str
    created_at: str
    updated_at: str


class ConversationUpdateRequest(BaseModel):
    """会话更新请求"""
    title: Optional[str] = None


# ==================== 消息相关 ====================

class DisplayMode(str):
    """显示模式枚举"""
    TEXT = "text"
    VRM = "vrm"
    LIVE2D = "live2d"


class MessageRequest(BaseModel):
    """消息请求"""
    conversation_id: str = Field(..., description="会话ID（UUID）")
    character_id: str = Field(..., description="角色ID（UUID）")
    model_id: str = Field(..., description="模型ID")
    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    content: str = Field(..., description="消息内容")
    display_mode: str = Field("text", description="显示模式: text/vrm/live2d")
    temperature: Optional[float] = Field(None, description="温度参数")
    max_tokens: Optional[int] = Field(None, description="最大token数")
    top_p: Optional[float] = Field(None, description="Top-p采样参数")
    enable_thinking: Optional[bool] = Field(None, description="是否启用深度思考")
    thinking_config: Optional[Dict[str, Any]] = Field(None, description="思考配置(模型特定参数)")


class MessageResponse(BaseModel):
    """消息响应"""
    message_id: int
    conversation_id: str
    message_type: str
    content: str
    created_at: str


class ConversationHistoryResponse(BaseModel):
    """会话历史响应"""
    conversation_id: str
    messages: List[MessageResponse]


# ==================== 音频相关 ====================

class AudioMessageRequest(BaseModel):
    """音频消息请求"""
    conversation_id: str = Field(..., description="会话ID（UUID）")
    character_id: str = Field(..., description="角色ID（UUID）")
    model_id: str = Field(..., description="模型ID")
    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    asr_provider: Optional[str] = Field(None, description="ASR提供商")
    language: Optional[str] = Field(None, description="语言代码")


class TextToSpeechRequest(BaseModel):
    """文本转语音请求"""
    text: str = Field(..., description="要转换的文本")
    tts_provider: Optional[str] = Field(None, description="TTS提供商")
    language: Optional[str] = Field(None, description="语言代码")



