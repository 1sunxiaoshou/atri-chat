"""Agent 业务协调器。

重构重点：
1. 重型 Agent 实例改为惰性创建
2. 复用全局 ModelFactory / PromptService 单例，避免重复初始化
3. 将 LangChain 相关导入下沉到真正需要创建 Agent 的时刻
"""

from __future__ import annotations

import asyncio
import json
import threading
from typing import TYPE_CHECKING, Any, AsyncGenerator, Sequence

from sqlalchemy.orm import Session

from .logger import get_logger

if TYPE_CHECKING:
    from .models.factory import ModelFactory
    from .prompts.service import PromptService

logger = get_logger(__name__)


class AgentCoordinator:
    """业务协调器。

    采用单 Agent 实例 + 动态中间件 + 输出策略的架构：
    - 通过 thread_id 实现会话隔离
    - 通过中间件实现模型、提示词、工具的动态配置
    - 通过策略模式处理不同输出模式
    - 使用 Repository 模式进行数据访问
    """

    def __init__(self, store, checkpointer, model_factory: "ModelFactory", prompt_manager: "PromptService"):
        """初始化协调器。

        Args:
            store: SqliteStore 实例
            checkpointer: AsyncSqliteSaver 实例
            model_factory: 共享模型工厂单例
            prompt_manager: 共享提示词服务单例
        """
        from .services import MessageService

        self.checkpointer = checkpointer
        self.store = store
        self.model_factory = model_factory
        self.prompt_manager = prompt_manager

        self.message_service = MessageService()

        self._agent = None
        self._agent_lock = threading.Lock()

    def _create_agent(self):
        """创建 Agent（使用动态中间件）。

        注意：
        1. 使用占位模型，实际模型会在运行时通过中间件动态替换
        2. callbacks 在运行时通过 config 传递，而不是在创建时固定
        """
        from langchain.agents import create_agent
        from langchain_openai import ChatOpenAI

        from .middleware import (
            AgentContext,
            build_character_prompt,
            filter_tools_by_mode,
            select_model_and_params,
        )
        from .tools import get_action_tools
        from .tools.memory_tools_v3 import get_memory_tools_v3

        all_tools = [
            *get_memory_tools_v3(),
            *get_action_tools(),
        ]

        placeholder_model = ChatOpenAI(model="gpt-4o", api_key="placeholder")

        return create_agent(
            model=placeholder_model,
            tools=all_tools,
            middleware=[
                select_model_and_params,
                build_character_prompt,
                filter_tools_by_mode,
            ],
            context_schema=AgentContext,
            checkpointer=self.checkpointer,
            store=self.store,
        )

    def _get_or_create_agent(self):
        """线程安全地获取 Agent 单例。"""
        if self._agent is not None:
            return self._agent

        with self._agent_lock:
            if self._agent is None:
                self._agent = self._create_agent()
        return self._agent

    async def warm_up(self):
        """在后台预热 Agent。"""
        await asyncio.to_thread(self._get_or_create_agent)

    async def send_message(
        self,
        user_message: str,
        conversation_id: str,
        character_id: str,
        model_id: str,
        provider_config_id: int,
        db_session: Session,
        output_mode: str = "text",
        **model_kwargs,
    ) -> AsyncGenerator[str, None]:
        """统一的消息发送接口。"""
        from .callbacks import LLMCallLogger, TokenUsageCallback
        from .config import get_settings
        from .middleware import AgentContext
        from .repositories import CharacterRepository
        from .services import ConversationService, get_output_strategy
        from .services.model_service import ModelService
        from .tools import get_action_tools
        from .tools.memory_tools_v3 import get_memory_tools_v3

        enable_vrm = output_mode == "vrm"

        conversation_service = ConversationService(db_session)
        model_service = ModelService(db_session, self.model_factory)
        character_repo = CharacterRepository(db_session)

        conversation_service.validate_conversation(conversation_id)
        if enable_vrm:
            character = character_repo.get(character_id)
            if not character:
                raise ValueError(f"角色 {character_id} 不存在")

        context = AgentContext(
            character_id=character_id,
            enable_vrm=enable_vrm,
            model_id=model_id,
            provider_config_id=provider_config_id,
            model_kwargs={**model_kwargs, "streaming": not enable_vrm},
            db_session=db_session,
            model_service=model_service,
            prompt_manager=self.prompt_manager,
        )

        all_tools = [
            *get_memory_tools_v3(),
            *get_action_tools(),
        ]
        tool_count = len([t for t in all_tools if not t.name.startswith("vrm_") or enable_vrm])
        logger.info(
            f"Agent配置: 模型={provider_config_id}/{model_id}, 模式={'VRM' if enable_vrm else '文本'}, 工具数={tool_count}",
            extra={
                "character_id": character_id,
                "conversation_id": conversation_id,
                "model_kwargs": model_kwargs,
            },
        )

        strategy = get_output_strategy(
            mode=output_mode,
            message_service=self.message_service,
        )

        agent = await asyncio.to_thread(self._get_or_create_agent)

        config = {"configurable": {"thread_id": str(conversation_id)}}

        token_callback = TokenUsageCallback()
        config["callbacks"] = [token_callback]

        settings = get_settings()
        if settings.enable_llm_call_logger:
            llm_logger = LLMCallLogger()
            config["callbacks"].append(llm_logger)
            logger.debug("LLM 调用日志记录器已启用")

        full_response = ""
        full_reasoning = ""
        tool_calls = []

        try:
            conversation_service.save_message(
                conversation_id=conversation_id,
                role="user",
                content=user_message,
            )
            new_title = conversation_service.auto_title(conversation_id, user_message)
            if new_title:
                yield json.dumps({"type": "title_update", "title": new_title}, ensure_ascii=False)
        except Exception as e:
            logger.error(f"前期消息处理失败: {e}")

        try:
            async for chunk_json in strategy.process(
                agent=agent,
                user_message=user_message,
                config=config,
                context=context,
            ):
                chunk_data = json.loads(chunk_json)

                if chunk_data.get("type") == "text":
                    full_response += chunk_data.get("content", "")
                elif chunk_data.get("type") == "full_response":
                    full_response = chunk_data.get("content", "")
                elif chunk_data.get("type") == "reasoning":
                    full_reasoning += chunk_data.get("content", "")
                elif chunk_data.get("type") == "tool_start":
                    tool_calls.append(
                        {
                            "run_id": chunk_data.get("run_id"),
                            "tool": chunk_data.get("tool"),
                            "input": chunk_data.get("input"),
                            "status": "running",
                        }
                    )
                elif chunk_data.get("type") == "tool_result":
                    run_id = chunk_data.get("run_id")
                    for tc in tool_calls:
                        if tc.get("run_id") == run_id:
                            tc["output"] = chunk_data.get("content")
                            tc["status"] = "completed"
                            break
                elif chunk_data.get("type") == "complete":
                    if not chunk_data.get("full_response") and full_response:
                        chunk_data["full_response"] = full_response

                    chunk_data["usage"] = token_callback.get_summary()
                    chunk_json = json.dumps(chunk_data, ensure_ascii=False)

                yield chunk_json

            if full_response:
                clean_response = strategy.clean_response(full_response)
                conversation_service.save_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=clean_response,
                )

        except Exception as e:
            logger.error(f"消息处理失败: {e}")
            error_msg = f"{type(e).__name__}: {str(e)}".strip(": ")
            yield json.dumps({"type": "error", "message": error_msg}, ensure_ascii=False)

    async def stream_runtime_events(
        self,
        *,
        user_message: str,
        conversation_id: str,
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
        from langchain_core.messages import BaseMessage

        from .callbacks import LLMCallLogger, TokenUsageCallback
        from .config import get_settings
        from .middleware import AgentContext
        from .services import ConversationService, get_output_strategy
        from .services.model_service import ModelService
        from .tools import get_action_tools
        from .tools.memory_tools_v3 import get_memory_tools_v3
        from .utils.message_utils import extract_text_from_content

        enable_vrm = output_mode == "vrm"
        conversation_service = ConversationService(db_session)
        model_service = ModelService(db_session, self.model_factory)

        conversation_service.validate_conversation(conversation_id)

        context = AgentContext(
            character_id=character_id,
            enable_vrm=enable_vrm,
            model_id=model_id,
            provider_config_id=provider_config_id,
            model_kwargs={**model_kwargs, "streaming": not enable_vrm},
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
            tool_count = len(
                [
                    t
                    for t in all_tools
                    if t.name.startswith("memory_")
                ]
            )
        logger.info(
            f"Agent Stream配置: 模型={provider_config_id}/{model_id}, 模式={'vrm' if enable_vrm else 'text'}, 工具数={tool_count}",
            extra={
                "character_id": character_id,
                "conversation_id": conversation_id,
                "model_kwargs": model_kwargs,
            },
        )

        agent = await asyncio.to_thread(self._get_or_create_agent)

        runtime_config: dict[str, Any] = {
            **(config or {}),
            "configurable": {
                "thread_id": str(conversation_id),
                **((config or {}).get("configurable") or {}),
            },
        }

        token_callback = TokenUsageCallback()
        runtime_config["callbacks"] = [token_callback]

        settings = get_settings()
        if settings.enable_llm_call_logger:
            llm_logger = LLMCallLogger()
            runtime_config["callbacks"].append(llm_logger)
            logger.debug("LLM 调用日志记录器已启用")

        full_response = ""

        try:
            conversation_service.save_message(
                conversation_id=conversation_id,
                role="user",
                content=user_message,
            )
            new_title = conversation_service.auto_title(conversation_id, user_message)
            if new_title:
                yield {"type": "custom", "data": {"type": "title_update", "title": new_title}}
        except Exception as e:
            logger.error(f"前期消息处理失败: {e}")

        try:
            if enable_vrm:
                strategy = get_output_strategy(
                    mode="vrm",
                    message_service=self.message_service,
                )
                async for chunk_json in strategy.process(
                    agent=agent,
                    user_message=user_message,
                    config=runtime_config,
                    context=context,
                ):
                    chunk_data = json.loads(chunk_json)
                    if chunk_data.get("type") == "full_response":
                        full_response = chunk_data.get("content", "")
                        continue
                    yield {"type": "custom", "data": chunk_data}
            else:
                async for part in agent.astream(
                    {"messages": [{"role": "user", "content": user_message}]},
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

                    if part_type == "messages" and isinstance(payload, tuple) and len(payload) == 2:
                        token, _metadata = payload
                        if isinstance(token, BaseMessage):
                            full_response += extract_text_from_content(token.content)

                            additional_kwargs = getattr(token, "additional_kwargs", {}) or {}
                            reasoning = (
                                additional_kwargs.get("reasoning_content")
                                or additional_kwargs.get("thought")
                                or additional_kwargs.get("thinking")
                            )
                            if reasoning:
                                yield {"type": "custom", "data": {"type": "reasoning", "content": reasoning}}

                    normalized_part = {
                        "type": part_type,
                        "data": payload,
                    }
                    if namespace:
                        normalized_part["ns"] = namespace
                    yield normalized_part

            if full_response:
                conversation_service.save_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_response,
                )

            yield {
                "type": "metadata",
                "data": {
                    "conversation_id": conversation_id,
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
