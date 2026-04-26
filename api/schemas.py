"""数据模型定义"""

from typing import Any

from pydantic import BaseModel, Field


class ResponseModel(BaseModel):
    """通用响应模型"""

    code: int = Field(200, description="状态码")
    message: str = Field("success", description="消息")
    data: Any | None = Field(None, description="数据")


# ==================== 供应商相关 ====================


class ProviderConfigRequest(BaseModel):
    """供应商配置请求"""

    name: str = Field(..., description="供应商显示名称")
    config_payload: dict[str, Any] = Field(..., description="配置详情")
    provider_type: str | None = Field(
        "openai", description="供应商模板类型: openai/anthropic/google/qwen/local"
    )


class ProviderConfigUpdateRequest(BaseModel):
    """供应商配置更新请求"""

    name: str | None = Field(None, description="供应商显示名称")
    config_payload: dict[str, Any] | None = Field(None, description="配置详情")
    provider_type: str | None = Field(None, description="供应商模板类型")


# ==================== 模型相关 ====================


class ModelRequest(BaseModel):
    """模型请求"""

    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    model_id: str = Field(..., description="模型ID")
    model_type: str = Field(..., description="模型类型: chat, embedding, rerank")

    # 核心能力布尔值
    has_vision: bool = Field(default=False)
    has_audio: bool = Field(default=False)
    has_video: bool = Field(default=False)
    has_reasoning: bool = Field(default=False)
    has_tool_use: bool = Field(default=False)
    has_document: bool = Field(default=False)
    has_structured_output: bool = Field(default=False)

    context_window: int | None = Field(None, description="上下文窗口大小")
    max_output: int | None = Field(None, description="最大输出token数")
    enabled: bool = Field(True, description="是否启用")
    parameters: dict[str, Any] = Field(
        default_factory=dict, description="模型初始化默认参数"
    )


class ModelResponse(BaseModel):
    """模型响应"""

    id: int
    provider_config_id: int
    model_id: str
    model_type: str

    # 核心能力布尔值
    has_vision: bool
    has_audio: bool
    has_video: bool
    has_reasoning: bool
    has_tool_use: bool
    has_document: bool
    has_structured_output: bool

    context_window: int | None
    max_output: int | None
    enabled: bool
    parameters: dict[str, Any] | None = None
    meta: dict[str, Any] | None = None


class ModelUpdateRequest(BaseModel):
    """模型更新请求"""

    model_type: str = Field(..., description="模型类型: chat, embedding, rerank")

    # 核心能力布尔值
    has_vision: bool | None = None
    has_audio: bool | None = None
    has_video: bool | None = None
    has_reasoning: bool | None = None
    has_tool_use: bool | None = None
    has_document: bool | None = None
    has_structured_output: bool | None = None

    context_window: int | None = Field(None, description="上下文窗口大小")
    max_output: int | None = Field(None, description="最大输出token数")
    enabled: bool = Field(True, description="是否启用")
    parameters: dict[str, Any] | None = Field(None, description="模型初始化默认参数")


# ==================== TTS相关 ====================


class TTSRequest(BaseModel):
    """TTS请求"""

    tts_id: str = Field(..., description="TTS ID")
    provider_id: int = Field(..., description="供应商与配置的内部ID")
    voice_role: str = Field(..., description="语音角色")
    api_key: str | None = Field(None, description="API密钥")
    access_url: str | None = Field(None, description="访问URL")


class TTSResponse(BaseModel):
    """TTS响应"""

    tts_id: str
    provider_id: int
    voice_role: str
    api_key: str | None
    access_url: str | None


class TTSUpdateRequest(BaseModel):
    """TTS更新请求"""

    provider_id: int = Field(..., description="供应商与配置的内部ID")
    voice_role: str = Field(..., description="语音角色")
    api_key: str | None = Field(None, description="API密钥")
    access_url: str | None = Field(None, description="访问URL")


class CharacterCreate(BaseModel):
    """创建角色 (新架构)"""

    name: str = Field(..., description="角色名称")
    system_prompt: str = Field(..., description="系统提示词")
    portrait_url: str | None = Field(None, description="2D立绘/头像URL")
    avatar_id: str = Field(..., description="3D形象资产ID")
    voice_asset_id: int = Field(..., description="音色资产ID")
    voice_speaker_id: str | None = Field(None, description="音色说话人ID（可选）")
    primary_model_id: int | None = Field(None, description="主模型内部 ID（可选）")
    primary_provider_config_id: int | None = Field(
        None, description="主供应商内部 ID（可选）"
    )
    enabled: bool = Field(True, description="是否启用")


class CharacterUpdate(BaseModel):
    """更新角色 (新架构)"""

    name: str | None = Field(None, description="角色名称")
    system_prompt: str | None = Field(None, description="系统提示词")
    portrait_url: str | None = Field(None, description="2D立绘/头像URL")
    avatar_id: str | None = Field(None, description="3D形象资产ID")
    voice_asset_id: int | None = Field(None, description="音色资产ID")
    voice_speaker_id: str | None = Field(None, description="音色说话人ID")
    primary_model_id: int | None = Field(None, description="主模型内部 ID")
    primary_provider_config_id: int | None = Field(None, description="主供应商内部 ID")
    enabled: bool | None = Field(None, description="是否启用")


# ==================== 会话相关 ====================


class ConversationRequest(BaseModel):
    """会话请求"""

    character_id: str = Field(..., description="角色ID（UUID）")
    title: str | None = Field("New Chat", description="会话标题")


class ConversationResponse(BaseModel):
    """会话响应"""

    conversation_id: str
    character_id: str
    title: str
    created_at: str
    updated_at: str


class ConversationUpdateRequest(BaseModel):
    """会话更新请求"""

    title: str | None = None


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
    temperature: float | None = Field(None, description="温度参数")
    max_tokens: int | None = Field(None, description="最大token数")
    top_p: float | None = Field(None, description="Top-p采样参数")
    enable_thinking: bool | None = Field(None, description="是否启用深度思考")
    thinking_config: dict[str, Any] | None = Field(
        None, description="思考配置(模型特定参数)"
    )


class AgentStreamContext(BaseModel):
    """前端 useStream 自定义 transport 的上下文。"""

    conversation_id: str = Field(..., description="会话ID（UUID）")
    turn_id: str | None = Field(None, description="本轮对话ID（UUID）")
    user_message_id: str | None = Field(None, description="用户消息ID（UUID）")
    character_id: str = Field(..., description="角色ID（UUID）")
    model_id: str = Field(..., description="模型ID")
    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    display_mode: str = Field("text", description="显示模式: text/vrm/live2d")
    temperature: float | None = Field(None, description="温度参数")
    max_tokens: int | None = Field(None, description="最大token数")
    top_p: float | None = Field(None, description="Top-p采样参数")
    enable_thinking: bool | None = Field(None, description="是否启用深度思考")
    thinking_config: dict[str, Any] | None = Field(
        None, description="思考配置(模型特定参数)"
    )


class AgentStreamRequest(BaseModel):
    """useStream 自定义 transport 请求。"""

    input: dict[str, Any] | None = Field(default=None, description="LangGraph 输入")
    context: AgentStreamContext = Field(..., description="运行时上下文")
    command: dict[str, Any] | None = Field(default=None, description="LangGraph 命令")
    config: dict[str, Any] | None = Field(default=None, description="LangGraph 配置")
    streamSubgraphs: bool | None = Field(default=False, description="是否流式子图")


class MessageResponse(BaseModel):
    """消息响应"""

    message_id: str
    conversation_id: str
    turn_id: str | None = None
    lc_message_id: str | None = None
    message_type: str
    content: str
    tool_call_id: str | None = None
    tool_name: str | None = None
    created_at: str


class ConversationHistoryResponse(BaseModel):
    """会话历史响应"""

    conversation_id: str
    messages: list[MessageResponse]


class RuntimeVRMFeedbackRequest(BaseModel):
    """前端 VRM 执行回报。"""

    conversation_id: str = Field(..., description="会话ID（UUID）")
    kind: str = Field(..., description="反馈类型")
    ok: bool = Field(..., description="执行是否成功")
    error: str | None = Field(None, description="错误信息")
    state: dict[str, Any] | None = Field(None, description="当前前端状态快照")


# ==================== 音频相关 ====================


class AudioMessageRequest(BaseModel):
    """音频消息请求"""

    conversation_id: str = Field(..., description="会话ID（UUID）")
    character_id: str = Field(..., description="角色ID（UUID）")
    model_id: str = Field(..., description="模型ID")
    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    asr_provider: str | None = Field(None, description="ASR提供商")
    language: str | None = Field(None, description="语言代码")


class TextToSpeechRequest(BaseModel):
    """文本转语音请求"""

    text: str = Field(..., description="要转换的文本")
    tts_provider: str | None = Field(None, description="TTS提供商")
    language: str | None = Field(None, description="语言代码")
