"""工具管理器 - 处理角色工具配置"""
from typing import List, Optional
from langchain_core.tools import BaseTool

from .registry import ToolRegistry


class ToolManager:
    """工具管理器
    
    负责：
    - 管理角色的工具配置
    - 从工具注册表获取工具实例
    - 支持工具的启用/禁用
    """
    
    def __init__(self, app_storage, tool_registry: ToolRegistry):
        """初始化工具管理器
        
        Args:
            app_storage: 应用存储实例
            tool_registry: 工具注册表实例
        """
        self.app_storage = app_storage
        self.tool_registry = tool_registry
    
    def get_character_tools(self, character_id: int) -> List[BaseTool]:
        """获取角色的工具列表
        
        Args:
            character_id: 角色ID
            
        Returns:
            工具实例列表
        """
        # 从数据库获取角色的工具配置
        tool_configs = self.app_storage.list_character_tools(character_id)
        
        # 只获取启用的工具
        enabled_tool_names = [
            config["tool_name"]
            for config in tool_configs
            if config["enabled"]
        ]
        
        # 从注册表获取工具实例
        return self.tool_registry.get_tools(enabled_tool_names)
    
    def add_character_tool(
        self,
        character_id: int,
        tool_name: str,
        enabled: bool = True
    ) -> bool:
        """为角色添加工具
        
        Args:
            character_id: 角色ID
            tool_name: 工具名称
            enabled: 是否启用
            
        Returns:
            是否成功添加
        """
        # 验证工具是否存在
        if not self.tool_registry.get_tool(tool_name):
            return False
        
        return self.app_storage.add_character_tool(
            character_id, tool_name, enabled
        )
    
    def remove_character_tool(
        self,
        character_id: int,
        tool_name: str
    ) -> bool:
        """移除角色的工具
        
        Args:
            character_id: 角色ID
            tool_name: 工具名称
            
        Returns:
            是否成功移除
        """
        return self.app_storage.delete_character_tool(character_id, tool_name)
    
    def update_character_tool(
        self,
        character_id: int,
        tool_name: str,
        enabled: bool
    ) -> bool:
        """更新角色工具的启用状态
        
        Args:
            character_id: 角色ID
            tool_name: 工具名称
            enabled: 是否启用
            
        Returns:
            是否成功更新
        """
        return self.app_storage.update_character_tool(
            character_id, tool_name, enabled
        )
