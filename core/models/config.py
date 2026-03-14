"""模型配置数据模型"""
from enum import Enum
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field


class ModelType(str, Enum):
    CHAT = "chat"
    EMBEDDING = "embedding"
    RERANK = "rerank"


class ProviderModelInfo(BaseModel):
    model_id: str = Field(..., description="模型ID")
    type: ModelType = Field(default=ModelType.CHAT, description="模型类型")
    nickname: Optional[str] = Field(default=None, description="模型昵称")
    
    # 核心能力布尔值
    has_vision: bool = Field(default=False, description="是否支持视觉/图像输入")
    has_audio: bool = Field(default=False, description="是否支持音频输入")
    has_video: bool = Field(default=False, description="是否支持视频输入")
    has_reasoning: bool = Field(default=False, description="是否支持深度推理 (Reasoning)")
    has_tool_use: bool = Field(default=False, description="是否支持工具/函数调用")
    has_document: bool = Field(default=False, description="是否支持文档分析")
    has_structured_output: bool = Field(default=False, description="是否支持结构化输出")
    
    context_window: Optional[int] = Field(default=None, description="上下文窗口大小")
    max_output: Optional[int] = Field(default=None, description="最大输出token数")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="模型默认初始化参数")
    meta: Dict[str, Any] = Field(default_factory=dict, description="存储模型完整的元数据 (Profile)")


class ProviderConfig(BaseModel):
    """供应商配置"""
    provider_id: int = Field(..., description="供应商配置数据库 ID")
    config_payload: Dict[str, Any] = Field(default_factory=dict, description="配置参数")


class ModelConfig(BaseModel):
    """模型配置"""
    model_id: str = Field(..., description="模型内部 UUID")
    provider_config_id: int = Field(..., description="供应商配置内部 ID")
    model_type: ModelType = Field(..., description="模型类型: chat, embedding, rerank")
    
    # 核心能力布尔值
    has_vision: bool = Field(default=False)
    has_audio: bool = Field(default=False)
    has_video: bool = Field(default=False)
    has_reasoning: bool = Field(default=False)
    has_tool_use: bool = Field(default=False)
    has_document: bool = Field(default=False)
    has_structured_output: bool = Field(default=False)
    
    context_window: Optional[int] = Field(default=None, description="上下文窗口大小")
    max_output: Optional[int] = Field(default=None, description="最大输出token数")
    enabled: bool = Field(default=True, description="是否启用")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="模型默认初始化参数")
    meta: Dict[str, Any] = Field(default_factory=dict, description="存储模型完整的元数据 (Profile)")

    def __str__(self) -> str:
        return (
            f"ModelConfig(model_id={self.model_id}, "
            f"type={self.model_type}, enabled={self.enabled})"
        )

    def __repr__(self) -> str:
        return self.__str__()
    
    def is_reasoning_model(self) -> bool:
        """判断是否为推理模型"""
        return self.has_reasoning
    
    def supports_vision(self) -> bool:
        """判断是否支持视觉"""
        return self.has_vision
    
    def supports_tool_use(self) -> bool:
        """判断是否支持工具调用"""
        return self.has_tool_use


class ConfigField(BaseModel):
    """配置字段定义"""
    field_name: str = Field(..., description="字段名称")
    field_type: str = Field(..., description="字段类型: string, number, boolean")
    required: bool = Field(default=False, description="是否必填")
    sensitive: bool = Field(default=False, description="是否为敏感字段（如密码、API密钥）")
    default_value: Any = Field(default=None, description="默认值")
    description: str = Field(default="", description="字段描述")


class ProviderMetadata(BaseModel):
    """供应商元数据"""
    provider_id: str = Field(..., description="供应商ID")
    name: str = Field(..., description="供应商名称")
    description: str = Field(..., description="供应商描述")
    lc_id: str = Field(default="openai", description="LangChain model_provider 标识")
    discovery: str = Field(default="openai", description="发现协议: openai, ollama, google, none")
    config_fields: List[ConfigField] = Field(default_factory=list, description="可配置字段列表")
    provider_options_schema: Optional[Dict[str, Any]] = Field(default=None, description="供应商特定参数的 Schema")
    common_parameters_schema: Optional[Dict[str, Any]] = Field(default=None, description="通用模型参数的 Schema")

    @classmethod
    def get_default_common_params(cls) -> Dict[str, Any]:
        """获取默认的通用参数 Schema"""
        return {
            "temperature": {
                "type": "slider",
                "label": "温度",
                "description": "控制输出的随机性。较低的值使输出更确定，较高的值使输出更有创造性",
                "min": 0, "max": 2, "step": 0.1, "default": 0.7,
                "applicable_model_types": ["chat"],
                "order": 1
            },
            "max_tokens": {
                "type": "slider",
                "label": "最大输出",
                "description": "生成的最大 token 数量",
                "min": 1, "max": 128000, "step": 1, "default": 4096,
                "applicable_model_types": ["chat"],
                "order": 2
            },
            "top_p": {
                "type": "slider",
                "label": "Top P",
                "description": "核采样参数",
                "min": 0, "max": 1, "step": 0.01, "default": 1.0,
                "applicable_model_types": ["chat"],
                "order": 3
            }
        }