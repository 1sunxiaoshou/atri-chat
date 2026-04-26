"""Agent 业务协调器。

重构重点：
1. 重型 Agent 实例改为惰性创建
2. 复用全局 ModelFactory / PromptService 单例，避免重复初始化
3. 将 LangChain 相关导入下沉到真正需要创建 Agent 的时刻
"""

from __future__ import annotations

from collections.abc import AsyncGenerator, Sequence
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy.orm import Session

from ..logger import get_logger

if TYPE_CHECKING:
    from ..models.factory import ModelFactory
    from ..prompts.service import PromptService

logger = get_logger(__name__)


class AgentCoordinator:
    """业务协调器。

    采用单 Agent 实例 + 动态中间件 + 输出策略的架构：
    - 通过 thread_id 实现会话隔离
    - 通过中间件实现模型、提示词、工具的动态配置
    - 通过策略模式处理不同输出模式
    - 使用 Repository 模式进行数据访问
    """

    def __init__(
        self,
        store,
        checkpointer,
        model_factory: ModelFactory,
        prompt_manager: PromptService,
    ):
        """初始化协调器。

        Args:
            store: SqliteStore 实例
            checkpointer: AsyncSqliteSaver 实例
            model_factory: 共享模型工厂单例
            prompt_manager: 共享提示词服务单例
        """
        self.checkpointer = checkpointer
        self.store = store
        self.model_factory = model_factory
        self.prompt_manager = prompt_manager

        from .factory import AgentRuntimeFactory
        from .runtime import AgentRuntime

        self.runtime = AgentRuntime(
            AgentRuntimeFactory(
                store=self.store,
                checkpointer=self.checkpointer,
            )
        )

    def _create_agent(self):
        """创建 Agent（使用动态中间件）。

        注意：
        1. 使用占位模型，实际模型会在运行时通过中间件动态替换
        2. callbacks 在运行时通过 config 传递，而不是在创建时固定
        """
        return self.runtime.create_agent()

    def _get_or_create_agent(self):
        """线程安全地获取 Agent 单例。"""
        return self.runtime.get_or_create_agent_sync()

    async def warm_up(self):
        """在后台预热 Agent。"""
        await self.runtime.warm_up()

    async def stream_runtime_events(
        self,
        *,
        user_message: str,
        conversation_id: str,
        turn_id: str | None = None,
        user_message_id: str | None = None,
        character_id: str,
        model_id: str,
        provider_config_id: int,
        db_session: Session,
        output_mode: str = "text",
        config: dict[str, Any] | None = None,
        stream_modes: Sequence[str] | None = None,
        **model_kwargs,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """暴露给 useStream 端点的原始 LangGraph 流式事件。"""
        from langchain_core.messages import AIMessageChunk, HumanMessage

        from ..callbacks import LLMCallLogger, TokenUsageCallback
        from ..config import get_settings
        from ..services import ConversationService
        from ..services.model_service import ModelService
        from ..tools import get_action_tools
        from ..tools.memory_tools_v3 import get_memory_tools_v3
        from .context import AgentContext

        enable_vrm = output_mode == "vrm"
        conversation_service = ConversationService(db_session)
        model_service = ModelService(db_session, self.model_factory)

        conversation_service.validate_conversation(conversation_id)
        turn_id = turn_id or str(uuid4())
        user_message_id = user_message_id or str(uuid4())

        agent = await self.runtime.get_or_create_agent()
        runtime_config: dict[str, Any] = {
            **(config or {}),
            "configurable": {
                "thread_id": str(conversation_id),
                **((config or {}).get("configurable") or {}),
            },
        }

        pre_run_message_ids: set[str] = set()
        try:
            state = await agent.aget_state(runtime_config)
            messages = (state.values or {}).get("messages", [])
            pre_run_message_ids = {
                str(message_id)
                for message in messages
                if (message_id := getattr(message, "id", None))
            }
        except Exception as e:
            logger.debug(f"读取运行前消息状态失败，将跳过预过滤: {e}")

        context = AgentContext(
            character_id=character_id,
            conversation_id=conversation_id,
            turn_id=turn_id,
            user_message_id=user_message_id,
            pre_run_message_ids=pre_run_message_ids,
            enable_vrm=enable_vrm,
            model_id=model_id,
            provider_config_id=provider_config_id,
            model_kwargs={**model_kwargs, "streaming": True},
            db_session=db_session,
            model_service=model_service,
            prompt_manager=self.prompt_manager,
        )

        all_tools = [
            *get_memory_tools_v3(),
            *get_action_tools(),
        ]
        if enable_vrm:
            tool_count = len(all_tools)
        else:
            tool_count = len([t for t in all_tools if t.name.startswith("memory_")])
        mode_label = "vrm" if enable_vrm else "text"
        logger.info(
            (
                f"Agent Stream配置: 模型={provider_config_id}/{model_id}, "
                f"模式={mode_label}, 工具数={tool_count}"
            ),
            extra={
                "character_id": character_id,
                "conversation_id": conversation_id,
                "model_kwargs": model_kwargs,
            },
        )

        token_callback = TokenUsageCallback()
        runtime_config["callbacks"] = [token_callback]

        settings = get_settings()
        if settings.enable_llm_call_logger:
            llm_logger = LLMCallLogger()
            runtime_config["callbacks"].append(llm_logger)
            logger.debug("LLM 调用日志记录器已启用")

        try:
            conversation_service.save_message(
                conversation_id=conversation_id,
                role="user",
                content=user_message,
                turn_id=turn_id,
                lc_message_id=user_message_id,
                raw_json={
                    "type": "human",
                    "data": {
                        "id": user_message_id,
                        "content": user_message,
                    },
                },
            )
            new_title = conversation_service.auto_title(conversation_id, user_message)
            if new_title:
                yield {
                    "type": "custom",
                    "data": {"type": "title_update", "title": new_title},
                }
        except Exception as e:
            logger.error(f"前期消息处理失败: {e}")

        try:
            async for part in agent.astream(
                {"messages": [HumanMessage(id=user_message_id, content=user_message)]},
                config=runtime_config,
                context=context,
                stream_mode=list(stream_modes or ["messages", "updates", "custom"]),
                version="v2",
            ):
                if not isinstance(part, dict):
                    logger.warning(f"收到未知 stream part: {part!r}")
                    continue

                part_type = part.get("type")
                payload = part.get("data")
                namespace = part.get("ns")

                if (
                    part_type == "messages"
                    and isinstance(payload, tuple)
                    and len(payload) == 2
                ):
                    token, metadata = payload
                    node = (
                        metadata.get("langgraph_node")
                        if isinstance(metadata, dict)
                        else None
                    )
                    if node == "model" and isinstance(token, AIMessageChunk):
                        additional_kwargs = (
                            getattr(token, "additional_kwargs", {}) or {}
                        )
                        reasoning = (
                            additional_kwargs.get("reasoning_content")
                            or additional_kwargs.get("thought")
                            or additional_kwargs.get("thinking")
                        )
                        if reasoning:
                            yield {
                                "type": "custom",
                                "data": {
                                    "type": "reasoning",
                                    "content": reasoning,
                                },
                            }
                normalized_part = {
                    "type": part_type,
                    "data": payload,
                }
                if namespace:
                    normalized_part["ns"] = namespace
                yield normalized_part

            yield {
                "type": "metadata",
                "data": {
                    "conversation_id": conversation_id,
                    "turn_id": turn_id,
                    "thread_id": str(runtime_config["configurable"]["thread_id"]),
                    "usage": token_callback.get_summary(),
                },
            }

        except Exception as e:
            logger.error(f"Agent Stream处理失败: {e}")
            raise

    async def start_services(self):
        """启动后台服务。"""
        pass

    async def stop_services(self):
        """停止后台服务。"""
        pass
