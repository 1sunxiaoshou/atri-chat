"""VRM音频生成器"""
import re
import wave
import uuid
from pathlib import Path
from typing import List, Optional, Dict
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
    
    def __init__(self, tts_factory: TTSFactory, action_mapping: Optional[dict] = None):
        """初始化音频生成器
        
        Args:
            tts_factory: TTS工厂实例
            action_mapping: 动作映射字典（中文名 -> 英文ID），从数据库获取
        """
        self.tts_factory = tts_factory
        self.parser = VRMMarkupParser(action_mapping=action_mapping)
        self.path_manager = get_path_manager()
        
        # 确保VRM音频目录存在
        self.vrm_audio_dir = self.path_manager.uploads_dir / "vrm_audio"
        self.vrm_audio_dir.mkdir(parents=True, exist_ok=True)
        
        logger.debug(
            f"音频生成器初始化完成",
            extra={
                "audio_dir": str(self.vrm_audio_dir),
                "action_count": len(action_mapping) if action_mapping else 0
            }
        )
    
    def split_sentences(self, text: str) -> List[str]:
        """按句分割文本（保留标记）
        
        使用正向扫描，直接在带标记的文本上分割，避免回溯匹配
        
        Args:
            text: 带标记的完整文本
            
        Returns:
            句子列表
            
        Example:
            >>> gen = AudioGenerator(tts_factory)
            >>> gen.split_sentences("[State:开心]你好！[State:好奇]今天怎么样？")
            ['[State:开心]你好！', '[State:好奇]今天怎么样？']
        """
        if not text:
            return []
        
        # 句子结束符
        end_chars = {'。', '！', '？', '.', '!', '?'}
        
        sentences = []
        current_sentence = []
        i = 0
        
        while i < len(text):
            char = text[i]
            
            # 处理标记（跳过整个标记块）
            if char == '[':
                # 找到标记的结束位置
                end_pos = text.find(']', i)
                if end_pos != -1:
                    # 将整个标记添加到当前句子
                    current_sentence.append(text[i:end_pos + 1])
                    i = end_pos + 1
                else:
                    # 没有找到结束符，当作普通字符
                    current_sentence.append(char)
                    i += 1
            # 处理句子结束符
            elif char in end_chars:
                current_sentence.append(char)
                # 完成一个句子
                sentence = ''.join(current_sentence)
                if sentence.strip():  # 忽略空句子
                    sentences.append(sentence)
                current_sentence = []
                i += 1
            # 普通字符
            else:
                current_sentence.append(char)
                i += 1
        
        # 处理剩余内容（没有结束符的句子）
        if current_sentence:
            sentence = ''.join(current_sentence)
            if sentence.strip():
                sentences.append(sentence)
        
        # 如果没有分割出任何句子，返回原文
        if not sentences:
            sentences = [text]
        
        logger.debug(
            f"句子分割完成",
            extra={
                "total_length": len(text),
                "sentence_count": len(sentences)
            }
        )
        
        return sentences
    
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
        
        改进算法：考虑标记位置的实际语义，而不是简单的线性插值
        - 位置为0的标记：触发时间为句子开始
        - 位置在句子中间的标记：使用线性插值（简化处理）
        - 位置在句子末尾的标记：触发时间为句子结束前
        
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
            # 特殊处理：位置为0的标记（句首标记）
            if markup.position == 0:
                timestamp = sentence_start_time
            # 特殊处理：位置在句尾的标记
            elif text_length > 0 and markup.position >= text_length:
                # 句尾标记提前0.1秒触发，避免在句子结束后才触发
                timestamp = sentence_start_time + max(0, audio_duration - 0.1)
            # 中间位置：线性插值
            elif text_length > 0:
                # 使用字符位置的比例来估算时间
                # 注意：这是简化处理，实际TTS的时间分布不是完全线性的
                relative_position = markup.position / text_length
                timestamp = sentence_start_time + (relative_position * audio_duration)
            else:
                # 空文本，默认为句子开始
                timestamp = sentence_start_time
            
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
                    "timestamp": timestamp,
                    "sentence_start": sentence_start_time,
                    "audio_duration": audio_duration
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
