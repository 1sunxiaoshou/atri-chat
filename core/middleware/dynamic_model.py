"""动态模型选择中间件"""

from collections.abc import Awaitable, Callable

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call

from ..logger import get_logger

logger = get_logger(__name__)


@wrap_model_call
async def select_model_and_params(
    request: ModelRequest, handler: Callable[[ModelRequest], Awaitable[ModelResponse]]
) -> ModelResponse:
    """动态选择模型和参数

    根据运行时上下文动态创建模型实例，支持不同的供应商和模型配置。
    使用 ModelService 通过 Repository 获取配置并创建模型。
    """
    context = request.runtime.context

    # 使用 ModelService 创建模型实例
    model = context.model_service.create_model_instance(
        provider_config_id=context.provider_config_id,
        model_id=context.model_id,
        streaming=context.model_kwargs.get("streaming", True),
        **{k: v for k, v in context.model_kwargs.items() if k != "streaming"},
    )

    return await handler(request.override(model=model))
