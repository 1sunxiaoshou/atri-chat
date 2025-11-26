"""工具注册表 - 管理所有可用工具"""
from typing import Dict, List, Optional, Any
from langchain_core.tools import BaseTool


class ToolRegistry:
    """工具注册表
    
    管理系统中所有可用的工具，包括：
    - 内置工具（LangChain 工具）
    - MCP 工具（通过 MCP 服务器提供）
    - 自定义工具
    """
    
    def __init__(self, load_mcp_tools: bool = False, mcp_config: Optional[Dict[str, Any]] = None):
        """初始化工具注册表
        
        Args:
            load_mcp_tools: 是否自动加载 MCP 工具
            mcp_config: MCP 配置（服务器列表等）
        """
        self._tools: Dict[str, BaseTool] = {}
        self._mcp_tools: Dict[str, BaseTool] = {}
        self._tool_metadata: Dict[str, Dict[str, Any]] = {}
        self._mcp_client = None
        
        # 自动加载 MCP 工具
        if load_mcp_tools:
            self._init_mcp(mcp_config)
    
    def register_tool(
        self,
        tool: BaseTool,
        category: str = "custom",
        description: Optional[str] = None
    ) -> None:
        """注册工具
        
        Args:
            tool: 工具实例
            category: 工具分类（builtin/mcp/custom）
            description: 工具描述
        """
        tool_name = tool.name
        self._tools[tool_name] = tool
        self._tool_metadata[tool_name] = {
            "category": category,
            "description": description or tool.description,
            "tool": tool
        }
    
    def register_mcp_tools(self, mcp_tools: List[BaseTool]) -> None:
        """批量注册 MCP 工具
        
        Args:
            mcp_tools: MCP 工具列表
        """
        for tool in mcp_tools:
            self._mcp_tools[tool.name] = tool
            self.register_tool(tool, category="mcp")
    
    def get_tool(self, tool_name: str) -> Optional[BaseTool]:
        """获取工具实例
        
        Args:
            tool_name: 工具名称
            
        Returns:
            工具实例或 None
        """
        return self._tools.get(tool_name)
    
    def get_tools(self, tool_names: List[str]) -> List[BaseTool]:
        """批量获取工具实例
        
        Args:
            tool_names: 工具名称列表
            
        Returns:
            工具实例列表（跳过不存在的工具）
        """
        tools = []
        for name in tool_names:
            tool = self.get_tool(name)
            if tool:
                tools.append(tool)
        return tools
    
    def list_tools(
        self,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """列出所有工具
        
        Args:
            category: 可选的分类过滤
            
        Returns:
            工具信息列表
        """
        result = []
        for tool_name, metadata in self._tool_metadata.items():
            if category is None or metadata["category"] == category:
                result.append({
                    "name": tool_name,
                    "category": metadata["category"],
                    "description": metadata["description"]
                })
        return result
    
    def unregister_tool(self, tool_name: str) -> bool:
        """注销工具
        
        Args:
            tool_name: 工具名称
            
        Returns:
            是否成功注销
        """
        if tool_name in self._tools:
            del self._tools[tool_name]
            del self._tool_metadata[tool_name]
            if tool_name in self._mcp_tools:
                del self._mcp_tools[tool_name]
            return True
        return False
    
    def _init_mcp(self, mcp_config: Optional[Dict[str, Any]] = None) -> None:
        """初始化 MCP 客户端并加载工具
        
        Args:
            mcp_config: MCP 配置（服务器列表等）
        """
        try:
            from langchain_mcp_adapters import MultiServerMCPClient
            
            if mcp_config:
                self._mcp_client = MultiServerMCPClient(mcp_config)
            else:
                self._mcp_client = MultiServerMCPClient()
            
            # 加载所有 MCP 工具
            mcp_tools = self._mcp_client.get_all_tools()
            self.register_mcp_tools(mcp_tools)
            
        except ImportError:
            print("警告: langchain-mcp-adapters 未安装，MCP 功能不可用")
            print("安装命令: pip install langchain-mcp-adapters")
    
    def load_mcp_tools(self, server_name: Optional[str] = None) -> int:
        """手动加载 MCP 工具
        
        Args:
            server_name: 可选的服务器名称，不指定则加载所有服务器的工具
            
        Returns:
            加载的工具数量
        """
        if not self._mcp_client:
            print("MCP 客户端未初始化，请在创建 ToolRegistry 时设置 load_mcp_tools=True")
            return 0
        
        try:
            if server_name:
                tools = self._mcp_client.get_tools(server_name)
            else:
                tools = self._mcp_client.get_all_tools()
            
            self.register_mcp_tools(tools)
            return len(tools)
        except Exception as e:
            print(f"加载 MCP 工具失败: {e}")
            return 0
    
    def list_mcp_servers(self) -> List[str]:
        """列出所有 MCP 服务器
        
        Returns:
            服务器名称列表
        """
        if not self._mcp_client:
            return []
        
        try:
            return self._mcp_client.list_servers()
        except Exception as e:
            print(f"列出 MCP 服务器失败: {e}")
            return []
    
    def is_mcp_available(self) -> bool:
        """检查 MCP 是否可用
        
        Returns:
            是否已初始化且可用
        """
        return self._mcp_client is not None
