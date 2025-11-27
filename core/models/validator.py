"""模型依赖检查工具"""
from typing import Dict, List, Any


class DependencyChecker:
    """依赖检查器"""
    
    @staticmethod
    def check_provider_dependencies(provider_id: str, app_storage) -> Dict[str, List[str]]:
        """检查供应商的依赖
        
        返回: {
            "models": ["model_id1", "model_id2"],
            "characters": ["character_name1", "character_name2"]
        }
        """
        dependencies = {
            "models": [],
            "characters": []
        }
        
        # 检查依赖的模型
        models = app_storage.list_models(provider_id=provider_id, enabled_only=False)
        dependencies["models"] = [m.model_id for m in models]
        
        # 检查依赖的角色
        characters = app_storage.list_characters(enabled_only=False)
        for char in characters:
            if char["primary_provider_id"] == provider_id:
                dependencies["characters"].append(char["name"])
        
        return dependencies
