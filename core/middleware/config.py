"""中间件配置数据模型"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class SummarizationConfig(BaseModel):
    """摘要中间件配置"""
    enabled: bool = Field(default=True, description="是否启用")
    model: str = Field(default="gpt-4o-mini", description="用于摘要的模型")
    trigger_tokens: Optional[int] = Field(default=4000, description="触发摘要的 token 数")
    trigger_messages: Optional[int] = Field(default=None, description="触发摘要的消息数")
    keep_messages: int = Field(default=20, description="保留的最近消息数")


class MiddlewareConfig(BaseModel):
    """中间件配置集合"""
    character_id: int = Field(..., description="角色ID")
    summarization: Optional[SummarizationConfig] = Field(
        default=None,
        description="摘要中间件配置"
    )
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "character_id": self.character_id,
            "summarization": self.summarization.model_dump() if self.summarization else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MiddlewareConfig":
        """从字典创建"""
        summarization_data = data.get("summarization")
        return cls(
            character_id=data["character_id"],
            summarization=SummarizationConfig(**summarization_data) if summarization_data else None
        )
