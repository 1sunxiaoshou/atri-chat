# Agent 核心重构计划

## ✅ 重构已完成

重构已于 2026-01-15 完成，主要成果：

### 已实现的改进
1. **职责分离**：Agent 作为纯技术组件，业务逻辑通过服务层处理
2. **单实例架构**：通过 `AgentCoordinator` 管理单个 Agent 实例，使用 thread_id 隔离会话
3. **动态配置**：通过中间件实现模型、提示词、工具的运行时动态配置
4. **服务分层**：`ConversationService` 和 `MessageService` 处理具体业务逻辑
5. **代码复用**：消除了普通模式和 VRM 模式的重复代码

### 新增模块
- `core/middleware/` - 动态配置中间件
  - `dynamic_model.py` - 动态模型选择
  - `dynamic_prompt.py` - 动态提示词生成
  - `dynamic_tools.py` - 动态工具过滤
- `core/services/` - 业务服务层
  - `conversation_service.py` - 会话管理
  - `message_service.py` - 消息处理
- `core/agent_coordinator.py` - 业务协调器（替代 agent_manager.py）

### 已清理
- ✅ 删除 `core/agent_manager.py`（已被 `agent_coordinator.py` 替代）
- ✅ 更新所有路由和依赖注入
- ✅ 更新测试文件

---

## 一、重构目标

### 1.1 核心问题
- **职责混乱**：`agent_manager.py` 既管理 Agent 又处理业务逻辑
- **重复创建**：每次请求都创建新的 Agent 实例
- **扩展性差**：新增功能需要修改核心代码
- **代码重复**：普通模式和 VRM 模式有大量重复逻辑

### 1.2 优化目标
- **Agent 与业务分离**：Agent 作为纯技术组件，业务逻辑独立
- **单 Agent 实例**：通过中间件实现动态配置，复用 Agent 实例
- **动态配置**：模型、提示词、工具都通过中间件动态调整
- **职责清晰**：服务分层，每个模块职责单一

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      API 层 (FastAPI)                        │
│                   api/routes/messages.py                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   业务协调层 (AgentCoordinator)              │
│                  core/agent_coordinator.py                   │
│  - 协调各个服务                                              │
│  - 管理 Agent 实例                                           │
│  - 构建运行时上下文                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Conversation│  │   Message   │  │    Agent    │
│   Service   │  │   Service   │  │  (LangChain)│
│             │  │             │  │             │
│ - 会话验证  │  │ - 流式处理  │  │ - 单实例    │
│ - 消息保存  │  │ - 消息解析  │  │ - 动态配置  │
│ - 自动标题  │  │ - 错误处理  │  │             │
└─────────────┘  └─────────────┘  └──────┬──────┘
                                          │
                         ┌────────────────┼────────────────┐
                         ▼                ▼                ▼
                  ┌────────────┐  ┌────────────┐  ┌────────────┐
                  │ Middleware │  │   Tools    │  │   Models   │
                  │  (动态)    │  │  (动态)    │  │  (动态)    │
                  └────────────┘  └────────────┘  └────────────┘
```

### 2.2 核心概念

#### 2.2.1 单 Agent 实例
- 在 `AgentCoordinator` 初始化时创建一个 Agent 实例
- 通过 `thread_id` 实现会话隔离（LangChain 内置机制）
- 通过中间件实现动态配置

#### 2.2.2 动态配置机制
- **动态模型**：通过 `@wrap_model_call` 中间件在运行时选择模型
- **动态提示词**：通过 `@dynamic_prompt` 中间件根据角色生成提示词
- **动态工具**：通过 `@wrap_model_call` 中间件根据模式过滤工具

#### 2.2.3 运行时上下文 (AgentContext)
```python
@dataclass
class AgentContext:
    character_id: int              # 角色 ID
    enable_vrm: bool               # 是否启用 VRM 模式
    model_id: str                  # 模型 ID
    provider_id: str               # 供应商 ID
    model_kwargs: Dict[str, Any]   # 模型参数
    prompt_manager: PromptManager  # 提示词管理器
    model_factory: ModelFactory    # 模型工厂
```

## 三、目录结构

```
core/
├── middleware/                    # 中间件（新增）
│   ├── __init__.py
│   ├── dynamic_model.py          # 动态模型选择
│   ├── dynamic_prompt.py         # 动态提示词生成
│   └── dynamic_tools.py          # 动态工具过滤
│
├── services/                      # 服务层（新增）
│   ├── __init__.py
│   ├── conversation_service.py   # 会话管理服务
│   └── message_service.py        # 消息处理服务
│
├── tools/                         # 工具定义
│   ├── __init__.py
│   ├── memory_tools.py           # 记忆工具（已存在）
│   └── vrm_tools.py              # VRM 工具（如需要）
│
├── agent_coordinator.py          # 业务协调器（重构）
├── models/                        # 模型相关（已存在）
├── prompts/                       # 提示词相关（已存在）
├── storage.py                     # 存储（已存在）
└── ...
```

## 四、实现细节

### 4.1 中间件实现

#### 4.1.1 动态模型中间件 (`core/middleware/dynamic_model.py`)

```python
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from typing import Callable
from ..logger import get_logger

logger = get_logger(__name__, category="MIDDLEWARE")

@wrap_model_call
def select_model_and_params(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse]
) -> ModelResponse:
    """动态选择模型和参数"""
    
    context = request.runtime.context
    
    # 创建模型实例
    model = context.model_factory.create_model(
        context.provider_id,
        context.model_id,
        streaming=True,
        **context.model_kwargs
    )
    
    logger.debug(
        f"动态模型: {context.provider_id}/{context.model_id}",
        extra={"model_kwargs": context.model_kwargs}
    )
    
    return handler(request.override(model=model))
```

#### 4.1.2 动态提示词中间件 (`core/middleware/dynamic_prompt.py`)

```python
from dataclasses import dataclass, field
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from typing import Dict, Any
from ..logger import get_logger

logger = get_logger(__name__, category="MIDDLEWARE")

@dataclass
class AgentContext:
    """Agent 运行时上下文"""
    character_id: int
    enable_vrm: bool = False
    model_id: str = "gpt-4o"
    provider_id: str = "openai"
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    prompt_manager: Any = None
    model_factory: Any = None

@dynamic_prompt
def build_character_prompt(request: ModelRequest) -> str:
    """动态构建角色提示词"""
    context = request.runtime.context
    
    prompt = context.prompt_manager.build_character_prompt(
        character_id=context.character_id,
        include_vrm=context.enable_vrm,
        include_safety=True
    )
    
    logger.debug(
        f"动态提示词: character_id={context.character_id}, vrm={context.enable_vrm}",
        extra={"prompt_length": len(prompt)}
    )
    
    return prompt
```

#### 4.1.3 动态工具中间件 (`core/middleware/dynamic_tools.py`)

```python
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from typing import Callable
from ..logger import get_logger

logger = get_logger(__name__, category="MIDDLEWARE")

@wrap_model_call
def filter_tools_by_mode(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse]
) -> ModelResponse:
    """根据模式动态过滤工具"""
    
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
    
    return handler(request.override(tools=filtered_tools))
```

### 4.2 服务层实现

#### 4.2.1 会话服务 (`core/services/conversation_service.py`)

```python
from ..storage import AppStorage
from ..logger import get_logger

logger = get_logger(__name__, category="SERVICE")

class ConversationService:
    """会话管理服务"""
    
    def __init__(self, app_storage: AppStorage):
        self.app_storage = app_storage
    
    def validate_conversation(self, conversation_id: int):
        """验证会话是否存在"""
        conversation = self.app_storage.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"会话不存在: {conversation_id}")
            raise ValueError(f"会话 {conversation_id} 不存在")
        return conversation
    
    def save_message(self, conversation_id: int, role: str, content: str):
        """保存消息"""
        self.app_storage.add_message(conversation_id, role, content)
        logger.debug(f"消息已保存: conversation_id={conversation_id}, role={role}")
    
    def auto_title(self, conversation_id: int, first_message: str):
        """自动生成会话标题"""
        conversation = self.app_storage.get_conversation(conversation_id)
        if conversation["title"] == "New Chat":
            title = first_message.replace("\n", " ").strip()
            if len(title) > 30:
                title = title[:30] + "..."
            self.app_storage.update_conversation(conversation_id, title=title)
            logger.debug(f"自动标题: {title}")
```

#### 4.2.2 消息服务 (`core/services/message_service.py`)

```python
import json
from typing import AsyncGenerator
from langchain.messages import AIMessageChunk
from ..logger import get_logger

logger = get_logger(__name__, category="SERVICE")

class MessageService:
    """消息处理服务"""
    
    async def run_streaming(
        self,
        agent,
        user_message: str,
        config: dict,
        context
    ) -> AsyncGenerator[str, None]:
        """执行流式处理"""
        
        full_response = ""
        chunk_count = 0
        
        try:
            # 使用 astream_events 获取流式事件
            async for event in agent.astream_events(
                {"messages": [{"role": "user", "content": user_message}]},
                config=config,
                context=context,
                version="v2"
            ):
                event_type = event.get("event")
                
                # 工具调用开始
                if event_type == "on_tool_start":
                    tool_name = event.get("name", "未知工具")
                    logger.info(f"工具调用: {tool_name}")
                    yield json.dumps({
                        "type": "status",
                        "content": f"正在使用工具: {tool_name}..."
                    }, ensure_ascii=False)
                
                # 模型流式输出
                elif event_type == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        text_chunk, reasoning_chunk = self._parse_chunk(chunk)
                        
                        if reasoning_chunk:
                            yield json.dumps({
                                "type": "reasoning",
                                "content": reasoning_chunk
                            }, ensure_ascii=False)
                        
                        if text_chunk:
                            chunk_count += 1
                            full_response += text_chunk
                            yield json.dumps({
                                "type": "text",
                                "content": text_chunk
                            }, ensure_ascii=False)
            
            logger.info(f"流式处理完成: chunks={chunk_count}, length={len(full_response)}")
            
        except Exception as e:
            logger.error(f"流式处理失败: {e}", exc_info=True)
            raise
    
    def _parse_chunk(self, chunk: AIMessageChunk):
        """解析消息块"""
        text_content = ""
        reasoning_content = ""
        
        if hasattr(chunk, 'content') and chunk.content:
            if isinstance(chunk.content, str):
                text_content = chunk.content
            elif isinstance(chunk.content, list):
                for block in chunk.content:
                    if isinstance(block, str):
                        text_content += block
                    elif isinstance(block, dict):
                        if block.get('type') == 'text':
                            text_content += block.get('text', '')
                        elif block.get('type') == 'reasoning':
                            reasoning_content += block.get('reasoning', '')
        
        return text_content, reasoning_content
```

### 4.3 AgentCoordinator 实现 (`core/agent_coordinator.py`)

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from .middleware import (
    select_model_and_params,
    build_character_prompt,
    filter_tools_by_mode,
    AgentContext
)
from .services import ConversationService, MessageService
from .tools.memory_tools import get_memory_tools
from .models.factory import ModelFactory
from .prompts import PromptManager
from .vrm import VRMService
from .logger import get_logger

logger = get_logger(__name__, category="BUSINESS")

class AgentCoordinator:
    """业务协调器"""
    
    def __init__(self, app_storage, store, checkpointer):
        self.app_storage = app_storage
        self.checkpointer = checkpointer
        self.store = store
        
        # 服务
        self.conversation_service = ConversationService(app_storage)
        self.message_service = MessageService()
        
        # 工厂
        self.model_factory = ModelFactory(app_storage)
        self.prompt_manager = PromptManager(app_storage)
        
        # VRM 服务
        from .tts.factory import TTSFactory
        self.vrm_service = VRMService(app_storage, TTSFactory(app_storage.db_path))
        
        # 创建单个 Agent 实例
        self.agent = self._create_agent()
        
        logger.info("AgentCoordinator 初始化完成")
    
    def _create_agent(self):
        """创建 Agent（使用动态中间件）"""
        
        # 注册所有可能的工具
        all_tools = get_memory_tools()
        
        # 创建默认模型（会被中间件动态替换）
        default_model = self.model_factory.create_model("openai", "gpt-4o")
        
        return create_agent(
            model=default_model,
            tools=all_tools,
            middleware=[
                select_model_and_params,     # 动态模型
                build_character_prompt,      # 动态提示词
                filter_tools_by_mode,        # 动态工具
                SummarizationMiddleware(
                    model=default_model,
                    trigger=("tokens", 20000),
                    keep=("tokens", 8000)
                )
            ],
            context_schema=AgentContext,
            checkpointer=self.checkpointer,
            store=self.store
        )
    
    async def send_message_stream(
        self,
        user_message: str,
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ):
        """发送消息（普通模式）"""
        
        # 1. 验证会话
        self.conversation_service.validate_conversation(conversation_id)
        
        # 2. 构建上下文
        context = AgentContext(
            character_id=character_id,
            enable_vrm=False,
            model_id=model_id,
            provider_id=provider_id,
            model_kwargs=model_kwargs,
            prompt_manager=self.prompt_manager,
            model_factory=self.model_factory
        )
        
        # 3. 执行流式处理
        full_response = ""
        async for chunk_json in self.message_service.run_streaming(
            agent=self.agent,
            user_message=user_message,
            config={"configurable": {"thread_id": str(conversation_id)}},
            context=context
        ):
            # 解析 JSON 获取文本内容
            chunk_data = json.loads(chunk_json)
            if chunk_data.get("type") == "text":
                full_response += chunk_data.get("content", "")
            yield chunk_json
        
        # 4. 保存消息
        self.conversation_service.save_message(conversation_id, "user", user_message)
        self.conversation_service.save_message(conversation_id, "assistant", full_response)
        self.conversation_service.auto_title(conversation_id, user_message)
    
    async def send_message_stream_vrm(
        self,
        user_message: str,
        conversation_id: int,
        character_id: int,
        model_id: str,
        provider_id: str,
        **model_kwargs
    ):
        """发送消息（VRM 模式）"""
        
        # 1. 验证会话和角色
        self.conversation_service.validate_conversation(conversation_id)
        character = self.app_storage.get_character(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
        
        # 2. 构建上下文（启用 VRM）
        context = AgentContext(
            character_id=character_id,
            enable_vrm=True,
            model_id=model_id,
            provider_id=provider_id,
            model_kwargs={**model_kwargs, "streaming": False},
            prompt_manager=self.prompt_manager,
            model_factory=self.model_factory
        )
        
        # 3. 获取完整回复（非流式）
        response = await self.agent.ainvoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config={"configurable": {"thread_id": str(conversation_id)}},
            context=context
        )
        
        # 提取回复
        full_response = self._extract_response(response)
        if not full_response:
            logger.warning("AI 回复为空")
            yield json.dumps({"type": "error", "message": "AI 回复为空"}, ensure_ascii=False)
            return
        
        logger.info(f"[VRM] 回复: {full_response}")
        
        # 4. 保存纯文本
        import re
        clean_response = re.sub(r'\[[^\]]+:[^\]]+\]', '', full_response).strip()
        self.conversation_service.save_message(conversation_id, "user", user_message)
        self.conversation_service.save_message(conversation_id, "assistant", clean_response)
        self.conversation_service.auto_title(conversation_id, user_message)
        
        # 5. 流式生成音频
        segment_count = 0
        async for segment in self.vrm_service.generate_stream(full_response, character_id):
            segment_count += 1
            yield json.dumps({"type": "vrm_segment", "data": segment}, ensure_ascii=False)
        
        yield json.dumps({"type": "vrm_complete", "total_segments": segment_count}, ensure_ascii=False)
    
    def _extract_response(self, response):
        """提取 AI 回复"""
        if hasattr(response, 'content'):
            return response.content
        elif isinstance(response, dict) and 'messages' in response:
            messages = response['messages']
            if messages and hasattr(messages[-1], 'content'):
                return messages[-1].content
        return ""
```

## 五、实施步骤

### 5.1 第一阶段：创建基础结构
1. 创建 `core/middleware/` 目录和文件
2. 创建 `core/services/` 目录和文件
3. 实现 `AgentContext` 数据类

### 5.2 第二阶段：实现中间件
1. 实现 `dynamic_model.py`
2. 实现 `dynamic_prompt.py`
3. 实现 `dynamic_tools.py`
4. 添加日志记录

### 5.3 第三阶段：实现服务层
1. 实现 `ConversationService`
2. 实现 `MessageService`
3. 添加错误处理和日志

### 5.4 第四阶段：重构业务协调器
1. 创建 `agent_coordinator.py`
2. 从 `agent_manager.py` 迁移代码
3. 简化逻辑，使用服务层和中间件
4. 更新依赖注入（`dependencies.py`）
5. 保持 API 兼容性

### 5.5 第五阶段：测试和优化
1. 单元测试
2. 集成测试
3. 性能测试
4. 清理无效代码

## 六、注意事项

### 6.1 向后兼容
- 在 `dependencies.py` 中更新依赖注入，使用 `AgentCoordinator`
- 保持公共接口不变（方法名、参数）
- API 路由无需修改
- 前端无需修改
- 可选：保留 `agent_manager.py` 作为兼容层（导入 `AgentCoordinator` 并重命名）

### 6.2 日志记录
- 每个中间件添加 DEBUG 级别日志
- 服务层添加 INFO 级别日志
- 错误添加 ERROR 级别日志

### 6.3 错误处理
- 中间件捕获异常并记录
- 服务层统一错误处理
- 向上层抛出有意义的异常

### 6.4 性能考虑
- Agent 实例复用
- 避免重复创建对象
- 合理使用缓存

## 七、预期收益

### 7.1 代码质量
- 职责清晰，易于理解
- 减少重复代码 50%+
- 提高可测试性

### 7.2 可维护性
- 新增功能只需添加中间件或服务
- 修改影响范围小
- 易于调试和排查问题

### 7.3 性能
- Agent 实例复用，减少创建开销
- 通过 thread_id 实现会话隔离
- 无需担心状态污染

### 7.4 扩展性
- 易于添加新的工具
- 易于添加新的中间件
- 易于支持新的模式
