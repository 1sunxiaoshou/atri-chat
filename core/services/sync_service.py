"""模型同步服务 - 实现自动发现与能力探测逻辑"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from core.repositories import ProviderRepository, ModelRepository
from core.models.factory import ModelFactory
from core.models.config import ProviderConfig, ModelConfig, ProviderModelInfo
from core.logger import get_logger

logger = get_logger(__name__)


class ModelSyncService:
    """模型同步服务
    
    职责：
    1. 调用供应商 API 获取模型列表
    2. 使用 init_chat_model 探测模型能力（Capabilities）
    3. 将发现的模型同步到数据库
    """
    
    def __init__(self, db: Session, model_factory: ModelFactory):
        self.provider_repo = ProviderRepository(db)
        self.model_repo = ModelRepository(db)
        self.model_factory = model_factory

    def sync_provider_models(
        self, 
        provider_config_id: int, 
        update_existing: bool = False
    ) -> Dict[str, Any]:
        """同步指定供应商的模型列表"""
        # 1. 获取供应商配置
        provider_orm = self.provider_repo.get(provider_config_id)
        if not provider_orm:
            raise ValueError(f"供应商配置 {provider_config_id} 不存在")

        # 2. 获取 Provider 模板实例
        provider_template = self.model_factory.get_provider_template(provider_orm.provider_type)
        if not provider_template:
            raise ValueError(f"不支持的供应商驱动: {provider_orm.provider_type}")

        # 3. 构造供应商连接配置
        p_config = ProviderConfig(
            provider_id=provider_orm.id,
            config_payload=provider_orm.config_payload
        )

        # 4. 调用 API 获取模型列表
        logger.info(f"开始同步供应商模型: {provider_orm.name} ({provider_orm.provider_type})")
        try:
            available_models: List[ProviderModelInfo] = provider_template.list_models(p_config)
        except Exception as e:
            logger.exception(f"获取模型列表失败: {str(e)}")
            raise e

        # 5. 执行同步逻辑
        stats = {
            "total": len(available_models),
            "added": 0,
            "updated": 0,
            "skipped": 0,
            "failed": 0,
            "errors": []
        }

        for model_info in available_models:
            try:
                existing = self.model_repo.get_by_provider_and_model(provider_config_id, model_info.model_id)
                
                if existing:
                    if update_existing:
                        # 更新已有模型的能力评分
                        self.model_repo.update_by_provider_and_model(
                            provider_config_id,
                            model_id=model_info.model_id,
                            has_vision=model_info.has_vision,
                            has_audio=model_info.has_audio,
                            has_video=model_info.has_video,
                            has_reasoning=model_info.has_reasoning,
                            has_tool_use=model_info.has_tool_use,
                            has_document=model_info.has_document,
                            has_structured_output=model_info.has_structured_output,
                            context_window=model_info.context_window,
                            max_output=model_info.max_output,
                            meta=model_info.meta,
                            # 注意：不覆盖用户手动设置的 parameters
                        )
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1
                else:
                    # 创建新模型
                    self.model_repo.create(
                        provider_config_id=provider_config_id,
                        model_id=model_info.model_id,
                        model_type=model_info.type.value,
                        has_vision=model_info.has_vision,
                        has_audio=model_info.has_audio,
                        has_video=model_info.has_video,
                        has_reasoning=model_info.has_reasoning,
                        has_tool_use=model_info.has_tool_use,
                        has_document=model_info.has_document,
                        has_structured_output=model_info.has_structured_output,
                        context_window=model_info.context_window,
                        max_output=model_info.max_output,
                        enabled=True,
                        parameters=model_info.parameters,
                        meta=model_info.meta
                    )
                    stats["added"] += 1
            except Exception as e:
                logger.error(f"同步模型 {model_info.model_id} 失败: {str(e)}")
                stats["failed"] += 1
                stats["errors"].append(f"{model_info.model_id}: {str(e)}")

        return stats
