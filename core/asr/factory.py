"""ASR 工厂类"""
from typing import Optional, Dict, Any

from .base import ASRBase
from .service import ASRConfigService


class ASRFactory:
    """ASR 工厂类，负责创建和管理 ASR 实例（从数据库读取配置）"""
    
    # 提供商映射表（懒加载）
    _PROVIDERS = {
        "openai": ("openai_whisper.OpenAIWhisperASR", "OpenAI Whisper"),
        "funasr": ("funasr.FunASR", "FunASR"),
    }
    
    def __init__(self, db_path: str = "data/app.db"):
        """初始化
        
        Args:
            db_path: 数据库路径
        """
        self.config_service = ASRConfigService(db_path)
        self._instances = {}
        
        # 初始化所有已知的服务商
        self._init_providers()
    
    def _get_provider_class(self, provider: str):
        """动态导入提供商类（懒加载）"""
        if provider not in self._PROVIDERS:
            raise ValueError(f"未知的ASR提供商: {provider}")
        
        module_path, _ = self._PROVIDERS[provider]
        module_name, class_name = module_path.rsplit(".", 1)
        
        try:
            # 使用相对导入
            import importlib
            module = importlib.import_module(f".{module_name}", package="core.asr")
            return getattr(module, class_name)
        except (ImportError, AttributeError) as e:
            raise ValueError(f"无法加载ASR提供商 {provider}: {e}")
    
    def _init_providers(self):
        """初始化所有已知的服务商到数据库"""
        for provider_id, (_, provider_name) in self._PROVIDERS.items():
            try:
                # 检查是否已存在
                if not self.config_service.provider_exists(provider_id):
                    # 获取配置模板
                    provider_class = self._get_provider_class(provider_id)
                    template = provider_class.get_config_template()
                    
                    # 创建初始记录（未配置状态）
                    self.config_service.init_provider(
                        provider_id=provider_id,
                        name=provider_name,
                        config_template=template
                    )
            except Exception as e:
                # 初始化失败不应该阻止系统启动
                print(f"⚠️  初始化ASR提供商 {provider_id} 失败: {e}")
    
    def create_asr(self, provider: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> ASRBase:
        """创建 ASR 实例
        
        Args:
            provider: 提供商名称，不指定则使用当前active的提供商
            config: 配置字典，不指定则从数据库读取
            
        Returns:
            ASR 实例
            
        Raises:
            ValueError: 当提供商不存在或未配置时
        """
        # 如果提供了config，直接创建实例（用于测试连接）
        if config is not None:
            if not provider:
                raise ValueError("使用自定义配置时必须指定provider")
            provider_class = self._get_provider_class(provider)
            return provider_class(config)
        
        # 从数据库读取配置
        if provider:
            # 指定了provider，读取该provider的配置
            provider_config = self.config_service.get_provider_config(provider)
            if not provider_config:
                raise ValueError(f"ASR提供商 {provider} 未配置")
        else:
            # 未指定provider，使用active的provider
            active = self.config_service.get_active_provider()
            if not active:
                raise ValueError("未设置活动的ASR提供商，请先配置")
            provider, provider_config = active
        
        # 检查缓存
        if provider in self._instances:
            return self._instances[provider]
        
        # 动态导入并创建实例
        provider_class = self._get_provider_class(provider)
        instance = provider_class(provider_config)
        
        # 缓存实例
        self._instances[provider] = instance
        return instance
    
    def get_default_asr(self) -> ASRBase:
        """获取默认 ASR 实例（当前active的）"""
        return self.create_asr()
    
    def clear_cache(self):
        """清空实例缓存"""
        self._instances.clear()