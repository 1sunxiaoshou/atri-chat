"""VRM音频生成器"""
import re
import wave
import uuid
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass, asdict
from .markup_parser import VRMMarkupParser, VRMMarkup
from .markup_filter import MarkupFilter
from ..tts.factory import TTSFactory
from ..logger import get_logger
from ..paths import get_path_manager

logger = get_logger(__name__, category="VRM")


@dataclass
class TimedMarkup:
    """带时间戳的标记"""
    type: str  # "action" 或 "state"
    value: str  # 动作名或表情名（英文ID）
    timestamp: float  # 触发时间（秒）
    sentence_index: int  # 所属句子索引


@dataclass
class AudioSegment:
    """音频片段"""
    sentence_index: int  # 句子索引
    text: str  # 纯文本
    marked_text: str  # 带标记的文本
    audio_url: str  # 音频URL
    duration: float  # 音频时长（秒）
    start_time: float  # 起始时间（秒）
    end_time: float  # 结束时间（秒）
    markups: List[TimedMarkup]  # 带时间戳的标记


class AudioGenerator:
    """音频生成器
    
    按句分割文本，为每个句子生成TTS音频，计算精确时间戳
    """
    
    # 句子分割正则（保留分隔符）
    SENTENCE_PATTERN = re.compile(r'([^。！？\.\!\?]+[。！？\.\!\?]+)')
    
    def __init__(self, tts_factory: TTSFactory):
        """初始化音频生成器
        
        Args:
            tts_factory: TTS工厂实例
        """
        self.tts_factory = tts_factory
        self.parser = VRMMarkupParser()
        self.path_manager = get_path_manager()
        
        # 确保VRM音频目录存在
        self.vrm_audio_dir = self.path_manager.uploads_dir / "vrm_audio"
        self.vrm_audio_dir.mkdir(parents=True, exist_ok=True)
        
        logger.debug(f"音频生成器初始化完成", extra={"audio_dir": str(self.vrm_audio_dir)})
    
    def split_sentences(self, text: str) -> List[str]:
        """按句分割文本（保留标记）
        
        Args:
            text: 带标记的完整文本
            
        Returns:
            句子列表
            
        Example:
            >>> gen = AudioGenerator(tts_factory)
            >>> gen.split_sentences("[State:开心]你好！[State:好奇]今天怎么样？")
            ['[State:开心]你好！', '[State:好奇]今天怎么样？']
        """
        # 先移除标记，按句分割
        clean_text = MarkupFilter.remove_markup(text)
        sentences_clean = self.SENTENCE_PATTERN.findall(clean_text)
        
        if not sentences_clean:
            # 如果没有匹配到句子（没有标点），返回整个文本
            return [text]
        
        # 重新匹配带标记的句子
        sentences_with_markup = []
        text_pos = 0
        
        for clean_sentence in sentences_clean:
            # 在原文中查找这个句子的位置
            # 需要考虑标记的存在
            sentence_start = text.find(clean_sentence, text_pos)
            
            if sentence_start == -1:
                # 如果找不到（可能因为标记），尝试逐字匹配
                # 这里简化处理：从当前位置开始，找到下一个句子结束符
                end_chars = ['。', '！', '？', '.', '!', '?']
                sentence_end = text_pos
                
                for i in range(text_pos, len(text)):
                    if text[i] in end_chars:
                        sentence_end = i + 1
                        break
                else:
                    sentence_end = len(text)
                
                sentence_with_markup = text[text_pos:sentence_end]
                text_pos = sentence_end
            else:
                # 找到了，提取带标记的句子
                # 需要包含句子前面的标记
                markup_start = text_pos
                
                # 向前查找标记
                while markup_start < sentence_start:
                    if text[markup_start] == '[':
                        break
                    markup_start += 1
                
                if markup_start >= sentence_start:
                    markup_start = sentence_start
                
                sentence_end = sentence_start + len(clean_sentence)
                sentence_with_markup = text[markup_start:sentence_end]
                text_pos = sentence_end
            
            sentences_with_markup.append(sentence_with_markup)
        
        # 如果还有剩余文本（没有句子结束符的部分）
        if text_pos < len(text):
            sentences_with_markup.append(text[text_pos:])
        
        logger.debug(
            f"句子分割完成",
            extra={
                "total_length": len(text),
                "sentence_count": len(sentences_with_markup)
            }
        )
        
        return sentences_with_markup
    
    async def generate_by_sentence(
        self,
        marked_text: str,
        tts_provider: Optional[str] = None,
        language: Optional[str] = None
    ) -> List[AudioSegment]:
        """按句生成音频（带精确时间戳）
        
        Args:
            marked_text: 带标记的完整文本
            tts_provider: TTS提供商（可选）
            language: 语言代码（可选）
            
        Returns:
            音频片段列表
            
        Raises:
            RuntimeError: TTS合成失败时
        """
        logger.info(f"开始按句生成音频", extra={"text_length": len(marked_text)})
        
        # 1. 按句分割（保留标记）
        sentences = self.split_sentences(marked_text)
        
        if not sentences:
            logger.warning("没有句子可处理")
            return []
        
        # 2. 逐句处理
        segments = []
        cumulative_time = 0.0
        
        for sentence_index, sentence in enumerate(sentences):
            logger.debug(
                f"处理句子 {sentence_index + 1}/{len(sentences)}",
                extra={"sentence": sentence}
            )
            
            # 2.1 解析标记，得到纯文本和标记列表
            clean_text, markups = self.parser.parse(sentence)
            
            if not clean_text.strip():
                logger.warning(f"句子 {sentence_index} 为空，跳过")
                continue
            
            # 2.2 对纯文本进行TTS合成
            try:
                audio_path, audio_duration = await self._synthesize_audio(
                    clean_text,
                    tts_provider,
                    language
                )
            except Exception as e:
                logger.error(
                    f"TTS合成失败",
                    extra={"sentence_index": sentence_index, "error": str(e)},
                    exc_info=True
                )
                raise RuntimeError(f"TTS合成失败: {str(e)}")
            
            # 2.3 计算标记时间戳
            timed_markups = self._calculate_timestamps(
                markups,
                clean_text,
                audio_duration,
                cumulative_time,
                sentence_index
            )
            
            # 2.4 创建音频片段
            audio_url = f"/uploads/vrm_audio/{audio_path.name}"
            
            segment = AudioSegment(
                sentence_index=sentence_index,
                text=clean_text,
                marked_text=sentence,
                audio_url=audio_url,
                duration=audio_duration,
                start_time=cumulative_time,
                end_time=cumulative_time + audio_duration,
                markups=timed_markups
            )
            
            segments.append(segment)
            
            # 2.5 累积时间
            cumulative_time += audio_duration
            
            logger.debug(
                f"句子 {sentence_index} 处理完成",
                extra={
                    "duration": audio_duration,
                    "cumulative_time": cumulative_time,
                    "markup_count": len(timed_markups)
                }
            )
        
        logger.info(
            f"音频生成完成",
            extra={
                "segment_count": len(segments),
                "total_duration": cumulative_time
            }
        )
        
        return segments
    
    async def _synthesize_audio(
        self,
        text: str,
        tts_provider: Optional[str],
        language: Optional[str]
    ) -> tuple[Path, float]:
        """合成音频并返回路径和时长
        
        Args:
            text: 纯文本
            tts_provider: TTS提供商
            language: 语言代码
            
        Returns:
            (音频文件路径, 音频时长)
        """
        # 创建TTS实例
        tts = self.tts_factory.create_tts(tts_provider)
        
        # 合成音频
        audio_bytes = await tts.synthesize_async(text, language=language)
        
        # 保存音频文件
        audio_filename = f"{uuid.uuid4()}.wav"
        audio_path = self.vrm_audio_dir / audio_filename
        
        with open(audio_path, 'wb') as f:
            f.write(audio_bytes)
        
        # 获取音频时长
        duration = self._get_audio_duration(audio_path)
        
        logger.debug(
            f"音频合成完成",
            extra={
                "filename": audio_filename,
                "duration": duration,
                "size": len(audio_bytes)
            }
        )
        
        return audio_path, duration
    
    def _get_audio_duration(self, audio_path: Path) -> float:
        """获取WAV文件的精确时长
        
        Args:
            audio_path: 音频文件路径
            
        Returns:
            时长（秒）
        """
        try:
            with wave.open(str(audio_path), 'rb') as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                duration = frames / float(rate)
            return duration
        except Exception as e:
            logger.error(
                f"获取音频时长失败",
                extra={"path": str(audio_path), "error": str(e)}
            )
            # 降级：使用文本长度估算（每个字0.15秒）
            return 0.0
    
    def _calculate_timestamps(
        self,
        markups: List[VRMMarkup],
        clean_text: str,
        audio_duration: float,
        sentence_start_time: float,
        sentence_index: int
    ) -> List[TimedMarkup]:
        """计算标记的精确时间戳
        
        Args:
            markups: 标记列表
            clean_text: 纯文本
            audio_duration: 音频时长
            sentence_start_time: 句子起始时间
            sentence_index: 句子索引
            
        Returns:
            带时间戳的标记列表
        """
        timed_markups = []
        text_length = len(clean_text)
        
        for markup in markups:
            # 计算相对位置（0.0 - 1.0）
            if text_length > 0:
                relative_position = markup.position / text_length
            else:
                relative_position = 0.0
            
            # 计算绝对时间戳
            # 公式: timestamp = sentence_start_time + (position / text_length) * audio_duration
            timestamp = sentence_start_time + (relative_position * audio_duration)
            
            timed_markups.append(TimedMarkup(
                type=markup.type,
                value=markup.value,
                timestamp=timestamp,
                sentence_index=sentence_index
            ))
            
            logger.debug(
                f"标记时间戳计算",
                extra={
                    "type": markup.type,
                    "value": markup.value,
                    "position": markup.position,
                    "text_length": text_length,
                    "relative_position": relative_position,
                    "timestamp": timestamp
                }
            )
        
        return timed_markups
    
    def to_dict_list(self, segments: List[AudioSegment]) -> List[dict]:
        """将音频片段列表转换为字典列表（用于JSON序列化）
        
        Args:
            segments: 音频片段列表
            
        Returns:
            字典列表
        """
        return [
            {
                **asdict(segment),
                "markups": [asdict(m) for m in segment.markups]
            }
            for segment in segments
        ]
