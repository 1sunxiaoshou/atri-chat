"""模型配置数据模型"""
from enum import Enum
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field


class ModelType(str, Enum):
    CHAT = "chat"
    EMBEDDING = "embedding"
    RERANK = "rerank"


class ModelCapability(str, Enum):
    VISION = "vision"  # 图像理解能力
    DOCUMENT = "document"  # 文档理解能力
    VIDEO = "video"  # 视频理解能力
    AUDIO = "audio"  # 音频理解能力
    REASONING = "reasoning"  # 推理能力（深度思考）
    TOOL_USE = "tool_use"  # 工具调用/函数调用能力
    WEB_SEARCH = "web_search"  # 网络搜索能力


class ProviderModelInfo(BaseModel):
    model_id: str = Field(..., description="模型ID")
    type: ModelType = Field(default=ModelType.CHAT, description="模型类型")
    nickname: Optional[str] = Field(default=None, description="模型昵称")
    capabilities: List[ModelCapability] = Field(default_factory=list, description="模型能力列表")
    context_window: Optional[int] = Field(default=None, description="上下文窗口大小")
    max_output: Optional[int] = Field(default=None, description="最大输出token数")


class ProviderConfig(BaseModel):
    """供应商配置"""
    provider_id: str = Field(..., description="供应商ID")
    config_json: Dict[str, Any] = Field(default_factory=dict, description="配置参数")


class ModelConfig(BaseModel):
    """模型配置"""
    model_id: str = Field(..., description="模型ID")
    provider_id: str = Field(..., description="供应商ID")
    model_type: ModelType = Field(..., description="模型类型: chat, embedding, rerank")
    capabilities: List[ModelCapability] = Field(default_factory=list, description="模型能力列表")
    context_window: Optional[int] = Field(default=None, description="上下文窗口大小")
    max_output: Optional[int] = Field(default=None, description="最大输出token数")
    enabled: bool = Field(default=True, description="是否启用")

    def __str__(self) -> str:
        caps = ", ".join([c.value for c in self.capabilities])
        return (
            f"ModelConfig(\n"
            f"  model_id     = {self.model_id!r},\n"
            f"  provider_id  = {self.provider_id!r},\n"
            f"  model_type   = {self.model_type.value!r},\n"
            f"  capabilities = [{caps}],\n"
            f"  context_window = {self.context_window},\n"
            f"  max_output   = {self.max_output},\n"
            f"  enabled      = {self.enabled}\n"
            f")"
        )

    def __repr__(self) -> str:
        return self.__str__()
    
    def is_reasoning_model(self) -> bool:
        """判断是否为推理模型"""
        return ModelCapability.REASONING in self.capabilities
    
    def supports_vision(self) -> bool:
        """判断是否支持视觉"""
        return ModelCapability.VISION in self.capabilities
    
    def supports_tool_use(self) -> bool:
        """判断是否支持工具调用"""
        return ModelCapability.TOOL_USE in self.capabilities


class ConfigField(BaseModel):
    """配置字段定义"""
    field_name: str = Field(..., description="字段名称")
    field_type: str = Field(..., description="字段类型: string, number, boolean")
    required: bool = Field(default=False, description="是否必填")
    default_value: Any = Field(default=None, description="默认值")
    description: str = Field(default="", description="字段描述")


class ProviderMetadata(BaseModel):
    """供应商元数据"""
    provider_id: str = Field(..., description="供应商ID")
    name: str = Field(..., description="供应商名称")
    description: str = Field(..., description="供应商描述")
    logo: str = Field(..., description="Logo 路径或 URL")
    config_fields: List[ConfigField] = Field(default_factory=list, description="可配置字段列表")
    provider_options_schema: Optional[Dict[str, Any]] = Field(default=None, description="供应商特定参数的 Schema")