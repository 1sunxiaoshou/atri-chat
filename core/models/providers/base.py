"""供应商抽象基类"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List
from ..config import ModelConfig, ProviderConfig, ModelType, ProviderMetadata, ProviderModelInfo


class BaseProvider(ABC):
    """供应商基类"""
    
    @property
    @abstractmethod
    def metadata(self) -> ProviderMetadata:
        """供应商元数据"""
        pass
    
    @classmethod
    def get_common_parameters_schema(cls) -> Dict[str, Any]:
        """获取通用模型参数 Schema（所有 Provider 共享）
        
        子类可以覆盖此方法来自定义参数范围
        """
        return {
            "max_tokens": {
                "type": "slider",  # 改为 slider
                "label": "最大输出",
                "description": "生成的最大 token 数量",
                "min": 1,
                "max": 4096,
                "step": 1,
                "default": 4096,  # 默认使用最大值
                "use_max_as_default": True,  # 标记使用最大值作为默认值
                "applicable_model_types": ["chat"],
                "order": 3
            },
            "temperature": {
                "type": "slider",
                "label": "温度",
                "description": "控制输出的随机性。较低的值使输出更确定，较高的值使输出更有创造性",
                "min": 0,
                "max": 2,
                "step": 0.1,
                "default": 1.0,
                "applicable_model_types": ["chat"],
                "order": 4
            },
            "top_p": {
                "type": "slider",
                "label": "Top P",
                "description": "核采样参数，控制输出的多样性",
                "min": 0,
                "max": 1,
                "step": 0.01,
                "default": 1.0,
                "applicable_model_types": ["chat"],
                "order": 5
            }
        }
    
    @abstractmethod
    def create_text_model(
        self, 
        model_id: str, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Any:
        """创建文本模型
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            **kwargs: 动态参数（temperature, max_tokens, provider_options等）
        """
        pass
    
    def get_provider_options(self, **kwargs) -> Dict[str, Any]:
        """获取供应商特定参数
        
        子类可以覆盖此方法来处理供应商特定的参数，例如：
        - Claude: thinking (type, budgetTokens)
        - OpenAI: reasoningEffort (low, medium, high)
        - Google: thinkingConfig (thinkingBudget, includeThoughts)
        
        Args:
            **kwargs: 包含 provider_options 的参数
            
        Returns:
            供应商特定参数字典
            
        注意：
            - provider_options 应该是一个嵌套字典，格式为：
              {"provider_name": {"param1": value1, "param2": value2}}
            - 子类应该只提取自己供应商的参数
        """
        return kwargs.get("provider_options", {})
    
    def _merge_params(self, config: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        合并配置参数，优先级：kwargs > config
        
        Args:
            config: 供应商配置
            **kwargs: 动态参数
            
        Returns:
            合并后的参数字典
        """
        # 先取 config 的副本
        merged = {k: v for k, v in config.items() if v is not None}
        
        # 过滤掉 None 值
        filtered_kwargs = {k: v for k, v in kwargs.items() if v is not None}
        
        # kwargs 覆盖 config
        merged.update(filtered_kwargs)
        
        return merged
    
    def create_model(
        self, 
        model_config: ModelConfig, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Optional[Any]:
        """根据模型类型创建模型
        
        Args:
            model_config: 模型配置
            provider_config: 供应商配置
            **kwargs: 动态参数（会覆盖 provider_config 中的默认值）
            
        Raises:
            ValueError: 当模型类型不支持或创建失败时
        """
        if model_config.model_type == ModelType.CHAT:
            return self.create_text_model(model_config.model_id, provider_config, **kwargs)
        elif model_config.model_type == ModelType.EMBEDDING:
            return self.create_embedding_model(model_config.model_id, provider_config, **kwargs)
        else:
            raise ValueError(f"不支持的模型类型: {model_config.model_type}")
    
    def create_embedding_model(
        self, 
        model_id: str, 
        provider_config: ProviderConfig,
        **kwargs
    ) -> Any:
        """创建嵌入模型（通用实现，使用 OpenAI 兼容接口）
        
        子类可以重写此方法以支持特定的嵌入模型创建逻辑。
        默认实现使用 langchain_openai.OpenAIEmbeddings。
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            **kwargs: 动态参数
        """
        from langchain_openai import OpenAIEmbeddings
        config = provider_config.config_payload
        
        params = {
            "model": model_id,
            "api_key": config.get("api_key"),
        }
        
        # 如果有 base_url，添加它
        if "base_url" in config:
            params["base_url"] = config["base_url"]
        
        return OpenAIEmbeddings(**params)
    
    def list_models(self, provider_config: ProviderConfig) -> List[ProviderModelInfo]:
        """获取模型列表 - 从 API 动态获取
        
        子类可以重写此方法以支持特定的模型列表获取逻辑。
        默认实现使用 OpenAI 兼容接口。
        
        Args:
            provider_config: 供应商配置
            
        Returns:
            ProviderModelInfo 列表
            
        Raises:
            Exception: 当 API 调用失败时抛出异常
        """
        from openai import OpenAI
        config = provider_config.config_payload
        
        client = OpenAI(
            api_key=config.get("api_key"),
            base_url=config.get("base_url", "https://api.openai.com/v1")
        )
        
        models = client.models.list()
        result = []
        
        for model in models.data:
            # 调用子类的 get_model_info 获取详细信息
            model_info = self.get_model_info(model.id, provider_config)
            result.append(model_info)
        
        return result
    
    def get_model_info(self, model_id: str, provider_config: ProviderConfig) -> ProviderModelInfo:
        """获取模型信息
        
        优先使用 LangChain 的 model.profile 功能获取能力信息，
        如果不可用则根据模型ID的命名规则推断。
        
        Args:
            model_id: 模型ID
            provider_config: 供应商配置
            
        Returns:
            ProviderModelInfo 对象
        """
        from ..config import ModelCapability
        from ...logger import get_logger
        
        logger = get_logger(__name__)
        
        # 尝试使用 LangChain profile 获取能力信息
        try:
            model_instance = self.create_text_model(model_id, provider_config)
            
            if hasattr(model_instance, 'profile') and model_instance.profile:
                profile = model_instance.profile
                logger.debug(f"从 LangChain profile 获取模型信息: {model_id}")
                
                # 从 profile 提取能力信息
                capabilities = []
                
                # 视觉能力
                if profile.get('image_inputs'):
                    capabilities.append(ModelCapability.VISION)
                    capabilities.append(ModelCapability.DOCUMENT)
                
                # 音频能力
                if profile.get('audio_inputs') or profile.get('audio_outputs'):
                    capabilities.append(ModelCapability.AUDIO)
                
                # 视频能力
                if profile.get('video_inputs'):
                    capabilities.append(ModelCapability.VIDEO)
                
                # 工具调用能力
                if profile.get('tool_calling'):
                    capabilities.append(ModelCapability.TOOL_USE)
                
                # 推理能力
                if profile.get('reasoning_output'):
                    capabilities.append(ModelCapability.REASONING)
                
                return ProviderModelInfo(
                    model_id=model_id,
                    type=ModelType.CHAT,
                    capabilities=capabilities,
                    context_window=profile.get('max_input_tokens'),
                    max_output=profile.get('max_output_tokens'),
                )
        except Exception as e:
            logger.debug(f"无法从 LangChain profile 获取模型信息 {model_id}: {e}")
        
        # 降级到基于名称的推断
        model_id_lower = model_id.lower()
        
        if "embed" in model_id_lower:
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.EMBEDDING,
                capabilities=[],
            )
        elif "rerank" in model_id_lower:
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.RERANK,
                capabilities=[],
            )
        else:
            # 默认为聊天模型
            capabilities = []
            if "vision" in model_id_lower or "vl" in model_id_lower:
                capabilities.extend([ModelCapability.VISION, ModelCapability.DOCUMENT])
            if "audio" in model_id_lower:
                capabilities.append(ModelCapability.AUDIO)
            if "video" in model_id_lower:
                capabilities.append(ModelCapability.VIDEO)
            if "function" in model_id_lower or "tool" in model_id_lower:
                capabilities.append(ModelCapability.TOOL_USE)
            
            return ProviderModelInfo(
                model_id=model_id,
                type=ModelType.CHAT,
                capabilities=capabilities,
            )
