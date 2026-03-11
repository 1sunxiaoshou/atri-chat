"""VRM 服务 - 极简版

职责：
1. 按换行分句
2. 去除标记
3. 调用 TTS 生成音频
4. 流式返回（带标记文本 + base64 音频数据）

架构改进：
- 移除对 AppStorage 的依赖
- 使用 CharacterRepository 获取角色信息
"""
import re
import base64
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.orm import Session

from ..repositories import CharacterRepository
from ..tts.factory import TTSFactory
from ..logger import get_logger

logger = get_logger(__name__)


class VRMService:
    """VRM 服务 - 极简实现"""
    
    # 标记正则：匹配 [xxx:yyy] 格式
    MARKUP_PATTERN = re.compile(r'\[[^\]]+:[^\]]+\]')
    
    def __init__(self, tts_factory: TTSFactory):
        """初始化 VRM 服务
        
        Args:
            tts_factory: TTS 工厂（单例，可共享）
        """
        self.tts_factory = tts_factory
    
    async def generate_stream(
        self,
        marked_text: str,
        character_id: str,
        db_session: Session
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式生成 VRM 音频段
        
        Args:
            marked_text: 带标记的完整文本
            character_id: 角色 ID (UUID)
            db_session: 数据库会话（请求级别）
            
        Yields:
            标准格式的音频段（与前端 AudioSegment 接口一致）：
            {
                "sentence_index": 0,
                "marked_text": "[State:happy] 你好！",
                "audio_url": "data:audio/wav;base64,..." 或 None
            }
        """
        # 通过 Repository 获取角色信息
        character_repo = CharacterRepository(db_session)
        character = character_repo.get_with_relations(character_id)
        
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
        
        # 获取音色资产信息
        voice_asset = character.voice_asset
        if not voice_asset:
            raise ValueError(f"角色 {character.name} 未配置音色")
        
        # 获取 TTS 供应商信息
        tts_provider = voice_asset.provider
        if not tts_provider or not tts_provider.enabled:
            raise ValueError(f"TTS 供应商未配置或未启用")
        
        # 创建 TTS 实例（合并供应商配置和音色配置）
        config = {**tts_provider.config_payload, **voice_asset.voice_config}
        tts = self.tts_factory.create_tts(
            provider_type=tts_provider.provider_type,
            config=config
        )
        
        logger.info(
            "开始 VRM 流式生成",
            extra={
                "character_id": character_id,
                "voice_asset_id": voice_asset.id,
                "provider_type": tts_provider.provider_type
            }
        )
        
        # 1. 按换行分句
        sentences = [s.strip() for s in marked_text.split('\n') if s.strip()]
        
        # 2. 逐句处理
        for index, sentence in enumerate(sentences):
            # 2.1 去除标记，得到纯文本
            clean_text = self.MARKUP_PATTERN.sub('', sentence).strip()
            
            # 2.2 生成音频（如果有文本）
            audio_data = None
            if clean_text:
                try:
                    audio_bytes = await tts.synthesize_async(clean_text)
                    
                    # 2.3 转换为 base64
                    audio_data = base64.b64encode(audio_bytes).decode('utf-8')
                    
                    logger.debug(
                        f"句子 {index} 音频生成完成",
                        extra={
                            "text": clean_text,
                            "size": len(audio_bytes)
                        }
                    )
                except Exception as e:
                    logger.error(
                        f"TTS 生成失败",
                        extra={"index": index, "text": clean_text, "error": str(e)},
                        exc_info=True
                    )
                    # 继续处理，但没有音频
            else:
                logger.debug(
                    f"句子 {index} 仅包含标记，无文本内容",
                    extra={"marked_text": sentence}
                )
            
            # 2.4 流式返回（即使没有音频也要返回，以便触发动作）
            # 直接返回前端期望的格式，避免中间转换
            yield {
                "sentence_index": index,      # 使用前端期望的字段名
                "marked_text": sentence,      # 带标记的原文
                "audio_url": f"data:audio/wav;base64,{audio_data}" if audio_data else None  # 直接返回 data URI
            }
        
        logger.info(
            "VRM 流式生成完成",
            extra={"total_sentences": len(sentences)}
        )

