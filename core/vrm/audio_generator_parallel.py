"""VRM音频生成器 - 并行优化版本

改进点：
1. 并行调用TTS，减少总等待时间
2. 边生成边发送，提升用户体验
3. 保持时间戳计算的准确性
"""
import asyncio
from typing import List, Optional
from .audio_generator import AudioGenerator, AudioSegment
from ..logger import get_logger

logger = get_logger(__name__, category="VRM")


class ParallelAudioGenerator(AudioGenerator):
    """并行音频生成器
    
    继承自AudioGenerator，重写generate_by_sentence方法以支持并行处理
    """
    
    async def generate_by_sentence(
        self,
        marked_text: str,
        tts_provider: Optional[str] = None,
        language: Optional[str] = None
    ) -> List[AudioSegment]:
        """按句并行生成音频（带精确时间戳）
        
        优化策略：
        1. 先分割所有句子并解析标记
        2. 并行调用TTS合成所有音频
        3. 按顺序计算时间戳并组装结果
        
        Args:
            marked_text: 带标记的完整文本
            tts_provider: TTS提供商（可选）
            language: 语言代码（可选）
            
        Returns:
            音频片段列表
        """
        logger.info(
            "开始并行生成音频",
            extra={"text_length": len(marked_text)}
        )
        
        # 1. 按句分割（保留标记）
        sentences = self.split_sentences(marked_text)
        
        if not sentences:
            logger.warning("没有句子可处理")
            return []
        
        # 1.5 过滤和合并句子
        sentences = self._filter_and_merge_sentences(sentences)
        
        if not sentences:
            logger.warning("过滤后没有有效句子")
            return []
        
        # 2. 解析所有句子的标记
        parsed_sentences = []
        for sentence_index, sentence in enumerate(sentences):
            clean_text, markups = self.parser.parse(sentence)
            if clean_text.strip():
                parsed_sentences.append({
                    'index': sentence_index,
                    'sentence': sentence,
                    'clean_text': clean_text,
                    'markups': markups
                })
        
        if not parsed_sentences:
            logger.warning("没有有效句子可处理")
            return []
        
        logger.info(
            f"准备并行合成 {len(parsed_sentences)} 个句子",
            extra={"sentence_count": len(parsed_sentences)}
        )
        
        # 3. 并行调用TTS合成所有音频
        tts_tasks = [
            self._synthesize_audio(
                item['clean_text'],
                tts_provider,
                language
            )
            for item in parsed_sentences
        ]
        
        try:
            # 并行执行所有TTS任务
            tts_results = await asyncio.gather(*tts_tasks, return_exceptions=True)
        except Exception as e:
            logger.error(
                "并行TTS合成失败",
                extra={"error": str(e)},
                exc_info=True
            )
            raise RuntimeError(f"TTS合成失败: {str(e)}")
        
        # 4. 按顺序组装音频段（计算累积时间戳）
        segments = []
        cumulative_time = 0.0
        
        for i, (parsed_item, tts_result) in enumerate(zip(parsed_sentences, tts_results)):
            # 检查TTS是否成功
            if isinstance(tts_result, Exception):
                logger.error(
                    f"句子 {parsed_item['index']} TTS合成失败",
                    extra={
                        "sentence_index": parsed_item['index'],
                        "error": str(tts_result)
                    }
                )
                continue
            
            audio_path, audio_duration = tts_result
            
            # 计算标记时间戳
            timed_markups = self._calculate_timestamps(
                parsed_item['markups'],
                parsed_item['clean_text'],
                audio_duration,
                cumulative_time,
                parsed_item['index']
            )
            
            # 创建音频片段
            audio_url = f"/uploads/vrm_audio/{audio_path.name}"
            
            segment = AudioSegment(
                sentence_index=parsed_item['index'],
                text=parsed_item['clean_text'],
                marked_text=parsed_item['sentence'],
                audio_url=audio_url,
                duration=audio_duration,
                start_time=cumulative_time,
                end_time=cumulative_time + audio_duration,
                markups=timed_markups
            )
            
            segments.append(segment)
            
            # 累积时间
            cumulative_time += audio_duration
            
            logger.debug(
                f"句子 {parsed_item['index']} 处理完成",
                extra={
                    "duration": audio_duration,
                    "cumulative_time": cumulative_time,
                    "markup_count": len(timed_markups)
                }
            )
        
        logger.info(
            "并行音频生成完成",
            extra={
                "segment_count": len(segments),
                "total_duration": cumulative_time,
                "success_rate": f"{len(segments)}/{len(parsed_sentences)}"
            }
        )
        
        return segments
