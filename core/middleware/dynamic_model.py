"""动态模型选择中间件"""
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from typing import Callable, Awaitable
from ..logger import get_logger

logger = get_logger(__name__)


@wrap_model_call
async def select_model_and_params(
    request: ModelRequest,
    handler: Callable[[ModelRequest], Awaitable[ModelResponse]]
) -> ModelResponse:
    """动态选择模型和参数
    
    根据运行时上下文动态创建模型实例，支持不同的供应商和模型配置。
    """
    context = request.runtime.context
    
    # 创建模型实例
    model = context.model_factory.create_model(
        context.provider_id,
        context.model_id,
        streaming=context.model_kwargs.get("streaming", True),
        **{k: v for k, v in context.model_kwargs.items() if k != "streaming"}
    )
    
    logger.debug(
        f"动态模型: {context.provider_id}/{context.model_id}",
        extra={"model_kwargs": context.model_kwargs}
    )
    
    return await handler(request.override(model=model))
