"""动态工具过滤中间件"""
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from typing import Callable, Awaitable
from ..logger import get_logger

logger = get_logger(__name__)


@wrap_model_call
async def filter_tools_by_mode(
    request: ModelRequest,
    handler: Callable[[ModelRequest], Awaitable[ModelResponse]]
) -> ModelResponse:
    """根据模式动态过滤工具
    
    根据是否启用VRM模式，过滤可用的工具列表。
    """
    context = request.runtime.context
    enable_vrm = context.enable_vrm
    
    # 过滤工具
    filtered_tools = []
    for tool in request.tools:
        tool_name = tool.name
        
        # 基础工具（所有模式）
        if tool_name.startswith("memory_"):
            filtered_tools.append(tool)
        # VRM 工具（仅 VRM 模式）
        elif tool_name.startswith("vrm_") and enable_vrm:
            filtered_tools.append(tool)
        # 其他工具
        else:
            filtered_tools.append(tool)
    
    logger.debug(
        f"工具过滤: {len(request.tools)} -> {len(filtered_tools)}",
        extra={
            "enable_vrm": enable_vrm,
            "filtered_tools": [t.name for t in filtered_tools]
        }
    )
    
    return await handler(request.override(tools=filtered_tools))
