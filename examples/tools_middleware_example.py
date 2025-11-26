"""工具和中间件使用示例"""
import sys
sys.path.append(".")

from core.storage import AppStorage
from core.store import SqliteStore
from core.agent_manager import AgentManager
from core.tools.registry import ToolRegistry
from core.middleware.config import MiddlewareConfig, SummarizationConfig
from langgraph.checkpoint.sqlite import SqliteSaver


def setup_tools_example():
    """设置工具示例"""
    # 1. 初始化存储
    app_storage = AppStorage("data/app.db")
    store = SqliteStore("data/store.db")
    checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
    
    # 2. 创建工具注册表（自动加载 MCP 工具）
    tool_registry = ToolRegistry(load_mcp_tools=True)
    
    # 3. 注册内置工具（示例）
    # 这里可以注册 LangChain 的内置工具
    # from langchain_community.tools import WikipediaQueryRun
    # wiki_tool = WikipediaQueryRun()
    # tool_registry.register_tool(wiki_tool, category="builtin")
    
    # 4. 检查 MCP 工具加载情况
    if tool_registry.is_mcp_available():
        mcp_tools = tool_registry.list_tools(category="mcp")
        print(f"已加载 {len(mcp_tools)} 个 MCP 工具")
        
        # 列出 MCP 服务器
        servers = tool_registry.list_mcp_servers()
        print(f"可用的 MCP 服务器: {servers}")
    
    # 5. 创建 AgentManager
    agent_manager = AgentManager(
        app_storage=app_storage,
        store=store,
        checkpointer=checkpointer,
        tool_registry=tool_registry
    )
    
    return agent_manager, app_storage


def configure_character_tools(agent_manager: AgentManager, character_id: int):
    """为角色配置工具"""
    # 列出所有可用工具
    available_tools = agent_manager.tool_registry.list_tools()
    print(f"\n可用工具: {len(available_tools)} 个")
    for tool in available_tools:
        print(f"  - {tool['name']} ({tool['category']}): {tool['description']}")
    
    # 为角色添加工具
    # agent_manager.tool_manager.add_character_tool(character_id, "wikipedia", enabled=True)
    # agent_manager.tool_manager.add_character_tool(character_id, "calculator", enabled=True)
    
    # 查看角色的工具配置
    character_tools = agent_manager.app_storage.list_character_tools(character_id)
    print(f"\n角色 {character_id} 的工具配置:")
    for tool in character_tools:
        status = "启用" if tool["enabled"] else "禁用"
        print(f"  - {tool['tool_name']}: {status}")


def configure_character_middleware(agent_manager: AgentManager, character_id: int):
    """为角色配置中间件"""
    # 配置摘要中间件
    success = agent_manager.middleware_manager.update_summarization_config(
        character_id=character_id,
        enabled=True,
        model="gpt-4o-mini",
        trigger_tokens=4000,
        keep_messages=20
    )
    
    if success:
        print(f"\n已为角色 {character_id} 配置摘要中间件")
        
        # 查看配置
        config = agent_manager.app_storage.get_middleware_config(character_id)
        if config:
            print(f"中间件配置: {config}")


def test_agent_with_tools_and_middleware():
    """测试带工具和中间件的 Agent"""
    # 设置
    agent_manager, app_storage = setup_tools_example()
    
    # 假设已有角色和会话
    character_id = 1
    conversation_id = 1
    
    # 配置工具
    configure_character_tools(agent_manager, character_id)
    
    # 配置中间件
    configure_character_middleware(agent_manager, character_id)
    
    # 清空缓存以使用新配置
    agent_manager.clear_agent_cache(character_id)
    
    # 发送消息测试
    try:
        response = agent_manager.send_message(
            user_message="你好，请介绍一下你自己",
            conversation_id=conversation_id,
            character_id=character_id,
            model_id="qwen-plus",
            provider_id="dashscope"
        )
        print(f"\n助手回复: {response}")
    except Exception as e:
        print(f"\n测试失败: {e}")


def list_mcp_servers_example():
    """列出 MCP 服务器示例"""
    tool_registry = ToolRegistry(load_mcp_tools=True)
    
    if tool_registry.is_mcp_available():
        servers = tool_registry.list_mcp_servers()
        print(f"\n可用的 MCP 服务器: {len(servers)} 个")
        for server in servers:
            print(f"  - {server}")
    else:
        print("\nMCP 不可用，请安装: pip install langchain-mcp-adapters")


if __name__ == "__main__":
    print("=== 工具和中间件示例 ===\n")
    
    # 示例 1: 列出 MCP 服务器
    print("1. 列出 MCP 服务器")
    list_mcp_servers_example()
    
    # 示例 2: 完整测试
    print("\n2. 完整测试（需要先创建角色和会话）")
    # test_agent_with_tools_and_middleware()
