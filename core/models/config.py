"""模型配置数据模型"""
from enum import Enum
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field


class ModelType(str, Enum):
    """模型类型 - 按功能分类"""
    TEXT = "text"
    EMBEDDING = "embedding"
    RERANK = "rerank"


class Capability(str, Enum):
    """模型能力 - 按能力分类"""
    BASE = "base"  # 基础能力
    CHAT = "chat"  # 对话能力
    VISION = "vision"  # 视觉能力
    FUNCTION_CALLING = "function_calling"  # 函数调用能力
    REASONING = "reasoning"  # 推理能力（模型自动返回思维链）


class ProviderConfig(BaseModel):
    """供应商配置"""
    provider_id: str = Field(..., description="供应商ID")
    config_json: Dict[str, Any] = Field(default_factory=dict, description="配置参数")


class ModelConfig(BaseModel):
    """模型配置"""
    model_id: str = Field(..., description="模型ID")
    provider_id: str = Field(..., description="供应商ID")
    model_type: ModelType = Field(..., description="模型类型: text, embedding, rerank")
    capabilities: List[Capability] = Field(default_factory=lambda: [Capability.BASE], description="模型能力列表")
    enabled: bool = Field(default=True, description="是否启用")

    def __str__(self) -> str:
        caps = ", ".join([c.value for c in self.capabilities])
        return (
            f"ModelConfig(\n"
            f"  model_id     = {self.model_id!r},\n"
            f"  provider_id  = {self.provider_id!r},\n"
            f"  model_type   = {self.model_type.value!r},\n"
            f"  capabilities = [{caps}],\n"
            f"  enabled      = {self.enabled}\n"
            f")"
        )

    def __repr__(self) -> str:
        return self.__str__()
    
    def is_reasoning_model(self) -> bool:
        """判断是否为推理模型"""
        return Capability.REASONING in self.capabilities


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