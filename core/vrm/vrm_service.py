"""VRM 服务 - 极简版

职责：
1. 按换行分句
2. 去除标记
3. 调用 TTS 生成音频
4. 流式返回（带标记文本 + base64 音频数据）
"""
import re
import base64
from typing import AsyncGenerator, Dict, Any

from ..storage import AppStorage
from ..tts.factory import TTSFactory
from ..logger import get_logger

logger = get_logger(__name__)


class VRMService:
    """VRM 服务 - 极简实现"""
    
    # 标记正则：匹配 [xxx:yyy] 格式
    MARKUP_PATTERN = re.compile(r'\[[^\]]+:[^\]]+\]')
    
    def __init__(self, app_storage: AppStorage, tts_factory: TTSFactory):
        self.app_storage = app_storage
        self.tts_factory = tts_factory
    
    async def generate_stream(
        self,
        marked_text: str,
        character_id: int
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式生成 VRM 音频段
        
        Args:
            marked_text: 带标记的完整文本
            character_id: 角色 ID
            
        Yields:
            {"marked_text": "...", "audio_data": "base64...", "index": 0}
        """
        # 获取角色的 TTS 配置
        character = self.app_storage.get_character(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
        
        tts_id = character.get("tts_id", "default")
        tts = self.tts_factory.create_tts(tts_id)
        
        logger.info(
            "开始 VRM 流式生成",
            extra={"character_id": character_id, "tts_id": tts_id}
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
            yield {
                "marked_text": sentence,  # 带标记的原文
                "audio_data": audio_data,  # base64 编码的音频数据（可能为 None）
                "index": index             # 句子索引
            }
        
        logger.info(
            "VRM 流式生成完成",
            extra={"total_sentences": len(sentences)}
        )
