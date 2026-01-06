"""VRM 服务 - 极简版

职责：
1. 按换行分句
2. 去除标记
3. 调用 TTS 生成音频（临时文件）
4. 流式返回（带标记文本 + 音频 URL）
"""
import re
import uuid
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Dict, Any

from ..storage import AppStorage
from ..tts.factory import TTSFactory
from ..paths import get_path_manager
from ..logger import get_logger

logger = get_logger(__name__, category="VRM")


class VRMService:
    """VRM 服务 - 极简实现"""
    
    # 标记正则：匹配 [xxx:yyy] 格式
    MARKUP_PATTERN = re.compile(r'\[[^\]]+:[^\]]+\]')
    
    def __init__(self, app_storage: AppStorage, tts_factory: TTSFactory):
        self.app_storage = app_storage
        self.tts_factory = tts_factory
        self.path_manager = get_path_manager()
    
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
            {"marked_text": "...", "audio_url": "...", "index": 0}
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
            
            if not clean_text:
                logger.debug(f"句子 {index} 无文本内容，跳过")
                continue
            
            # 2.2 调用 TTS 生成音频
            try:
                audio_bytes = await tts.synthesize_async(clean_text)
            except Exception as e:
                logger.error(
                    f"TTS 生成失败",
                    extra={"index": index, "text": clean_text, "error": str(e)},
                    exc_info=True
                )
                continue
            
            # 2.3 保存为临时文件（自动删除）
            temp_file = tempfile.NamedTemporaryFile(
                suffix='.wav',
                delete=False,
                dir=self.path_manager.vrm_audio_dir
            )
            temp_file.write(audio_bytes)
            temp_file.close()
            
            # 2.4 构建 URL
            audio_filename = Path(temp_file.name).name
            audio_url = self.path_manager.build_vrm_audio_url(audio_filename)
            
            logger.debug(
                f"句子 {index} 处理完成",
                extra={
                    "text": clean_text,
                    "audio_file": audio_filename,
                    "size": len(audio_bytes)
                }
            )
            
            # 2.5 流式返回
            yield {
                "marked_text": sentence,  # 带标记的原文
                "audio_url": audio_url,   # 音频 URL
                "index": index            # 句子索引
            }
        
        logger.info(
            "VRM 流式生成完成",
            extra={"total_sentences": len(sentences)}
        )
