"""模型配置数据模型"""
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ModelType(str, Enum):
    """模型类型"""
    TEXT = "text"
    EMBEDDING = "embedding"
    RERANK = "rerank"


class TextMode(str, Enum):
    """文本模型模式"""
    LLM = "llm"
    CHAT = "chat"
    VISION = "vision"


class EmbeddingMode(str, Enum):
    """嵌入模型模式"""
    DENSE = "dense"


class ProviderConfig(BaseModel):
    """供应商配置"""
    provider_id: str = Field(..., description="供应商ID")
    config_json: Dict[str, Any] = Field(default_factory=dict, description="配置参数")


class ModelConfig(BaseModel):
    """模型配置"""
    model_id: str = Field(..., description="模型ID")
    provider_id: str = Field(..., description="供应商ID")
    model_type: ModelType = Field(..., description="模型类型")
    mode: str = Field(..., description="模型模式")
    enabled: bool = Field(default=True, description="是否启用")

    def __str__(self) -> str:
        return (
            f"ModelConfig(\n"
            f"  model_id   = {self.model_id!r},\n"
            f"  provider_id= {self.provider_id!r},\n"
            f"  model_type = {self.model_type.value!r},\n"
            f"  mode       = {self.mode!r},\n"
            f"  enabled    = {self.enabled}\n"
            f")"
        )

    def __repr__(self) -> str:
        return self.__str__()