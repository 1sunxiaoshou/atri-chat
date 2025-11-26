"""模型工厂"""
from typing import Optional, Any, TYPE_CHECKING, Callable, Dict
from .config import ModelConfig, ModelType, TextMode

if TYPE_CHECKING:
    from ..storage import AppStorage


class ModelFactory:
    """模型工厂
    
    使用注册表模式管理不同供应商的模型创建逻辑。
    支持动态注册自定义供应商。
    """
    
    def __init__(self, storage: "AppStorage"):
        self.storage = storage
        self._text_model_creators: Dict[str, Callable] = {}
        self._embedding_model_creators: Dict[str, Callable] = {}
        self._register_default_providers()
    
    def _register_default_providers(self):
        """注册默认供应商的创建函数"""
        # 注册文本模型创建函数
        self.register_text_model_creator("openai", self._create_openai_text_model)
        self.register_text_model_creator("tongyi", self._create_tongyi_text_model)
        self.register_text_model_creator("anthropic", self._create_anthropic_text_model)
        self.register_text_model_creator("google", self._create_google_text_model)
        
        # 注册嵌入模型创建函数
        self.register_embedding_model_creator("openai", self._create_openai_embedding_model)
        self.register_embedding_model_creator("google", self._create_google_embedding_model)
    
    def register_text_model_creator(self, provider_id: str, creator_func: Callable) -> None:
        """注册文本模型创建函数
        
        Args:
            provider_id: 供应商ID
            creator_func: 创建函数，签名为 (model_config, provider_config) -> Model
        """
        self._text_model_creators[provider_id] = creator_func
    
    def register_embedding_model_creator(self, provider_id: str, creator_func: Callable) -> None:
        """注册嵌入模型创建函数
        
        Args:
            provider_id: 供应商ID
            creator_func: 创建函数，签名为 (model_config, provider_config) -> Model
        """
        self._embedding_model_creators[provider_id] = creator_func
    
    def create_model(self, provider_id: str, model_id: str) -> Optional[Any]:
        """根据provider_id和model_id创建模型实例"""
        model_config = self.storage.get_model(provider_id, model_id)
        if not model_config or not model_config.enabled:
            return None
        
        if model_config.provider_id != provider_id:
            return None
        
        provider_config = self.storage.get_provider(provider_id)
        if not provider_config:
            return None
        
        # 根据供应商和模型类型创建实例
        if model_config.model_type == ModelType.TEXT:
            return self._create_text_model(provider_id, model_config, provider_config)
        elif model_config.model_type == ModelType.EMBEDDING:
            return self._create_embedding_model(provider_id, model_config, provider_config)
        
        return None
    
    def _create_text_model(self, provider_id: str, model_config: ModelConfig, provider_config) -> Optional[Any]:
        """创建文本模型（使用注册表）"""
        creator = self._text_model_creators.get(provider_id)
        if not creator:
            print(f"警告: 未注册的文本模型供应商 '{provider_id}'")
            return None
        
        try:
            return creator(model_config, provider_config)
        except Exception as e:
            print(f"创建文本模型失败 ({provider_id}/{model_config.model_id}): {e}")
            return None
    
    def _create_openai_text_model(self, model_config: ModelConfig, provider_config) -> Any:
        """创建 OpenAI 文本模型"""
        from langchain_openai import ChatOpenAI
        config = provider_config.config_json
        return ChatOpenAI(
            model=model_config.model_id,
            api_key=config.get("api_key"),
            base_url=config.get("base_url"),
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens")
        )
    
    def _create_tongyi_text_model(self, model_config: ModelConfig, provider_config) -> Any:
        """创建通义千问文本模型"""
        from langchain_community.chat_models.tongyi import ChatTongyi
        config = provider_config.config_json
        return ChatTongyi(
            model=model_config.model_id,
            api_key=config.get("api_key"),
            base_url=config.get("base_url"),
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens")
        )
    
    def _create_anthropic_text_model(self, model_config: ModelConfig, provider_config) -> Any:
        """创建 Anthropic 文本模型"""
        from langchain_anthropic import ChatAnthropic
        config = provider_config.config_json
        return ChatAnthropic(
            model=model_config.model_id,
            api_key=config.get("api_key"),
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens")
        )
    
    def _create_google_text_model(self, model_config: ModelConfig, provider_config) -> Any:
        """创建 Google 文本模型"""
        from langchain_google_genai import ChatGoogleGenerativeAI
        config = provider_config.config_json
        return ChatGoogleGenerativeAI(
            model=model_config.model_id,
            api_key=config.get("api_key"),
            temperature=config.get("temperature", 0.7),
            max_output_tokens=config.get("max_tokens")
        )
    
    def _create_embedding_model(self, provider_id: str, model_config: ModelConfig, provider_config) -> Optional[Any]:
        """创建嵌入模型（使用注册表）"""
        creator = self._embedding_model_creators.get(provider_id)
        if not creator:
            print(f"警告: 未注册的嵌入模型供应商 '{provider_id}'")
            return None
        
        try:
            return creator(model_config, provider_config)
        except Exception as e:
            print(f"创建嵌入模型失败 ({provider_id}/{model_config.model_id}): {e}")
            return None
    
    def _create_openai_embedding_model(self, model_config: ModelConfig, provider_config) -> Any:
        """创建 OpenAI 嵌入模型"""
        from langchain_openai import OpenAIEmbeddings
        config = provider_config.config_json
        return OpenAIEmbeddings(
            model=model_config.model_id,
            api_key=config.get("api_key"),
            base_url=config.get("base_url")
        )
    
    def _create_google_embedding_model(self, model_config: ModelConfig, provider_config) -> Any:
        """创建 Google 嵌入模型"""
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        config = provider_config.config_json
        return GoogleGenerativeAIEmbeddings(
            model=model_config.model_id,
            api_key=config.get("api_key")
        )
