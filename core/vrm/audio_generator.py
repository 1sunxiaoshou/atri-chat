"""VRM音频生成器"""
import re
import wave
import uuid
from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import dataclass, asdict
from .markup_parser import VRMMarkupParser, VRMMarkup
from .markup_filter import MarkupFilter
from .audio_manager import AudioFileManager
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
    
    def __init__(
        self,
        tts_factory: TTSFactory,
        audio_manager: Optional[AudioFileManager] = None,
        conversation_id: Optional[int] = None
    ):
        """初始化音频生成器
        
        Args:
            tts_factory: TTS工厂实例
            audio_manager: 音频文件管理器（可选）
            conversation_id: 会话ID（用于文件生命周期管理）
        """
        self.tts_factory = tts_factory
        self.parser = VRMMarkupParser()
        self.path_manager = get_path_manager()
        self.conversation_id = conversation_id
        
        # 确保VRM音频目录存在
        self.vrm_audio_dir = self.path_manager.uploads_dir / "vrm_audio"
        self.vrm_audio_dir.mkdir(parents=True, exist_ok=True)
        
        # 音频文件管理器
        self.audio_manager = audio_manager or AudioFileManager(
            audio_dir=self.vrm_audio_dir,
            ttl_seconds=3600,  # 默认1小时
            max_size_mb=500    # 默认500MB
        )
        
        logger.debug(
            "音频生成器初始化完成",
            extra={
                "audio_dir": str(self.vrm_audio_dir),
                "conversation_id": conversation_id
            }
        )
    
    def split_sentences(self, text: str) -> List[str]:
        """按换行符分割文本（保留标记）
        
        使用换行符 \n 作为句子分隔符
        
        Args:
            text: 带标记的完整文本
            
        Returns:
            句子列表
        """
        if not text:
            return []
        
        # 按换行符分割
        sentences = text.split('\n')
        
        # 过滤空句子
        sentences = [s.strip() for s in sentences if s.strip()]
        
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
    
    def _filter_and_merge_sentences(self, sentences: List[str], min_text_length: int = 2) -> List[str]:
        """过滤空文本句子并合并短文本句子
        
        Args:
            sentences: 原始句子列表
            min_text_length: 最小文本长度（不含标记），默认2个字符
            
        Returns:
            过滤和合并后的句子列表
        """
        if not sentences:
            return []
        
        filtered = []
        pending_sentence = ""
        
        for sentence in sentences:
            # 解析出纯文本（去除标记）
            clean_text, _ = self.parser.parse(sentence)
            clean_text = clean_text.strip()
            
            # 跳过完全没有文本的句子
            if not clean_text:
                logger.debug(f"跳过空文本句子: {sentence}")
                continue
            
            # 如果有待合并的句子，先合并
            if pending_sentence:
                pending_sentence += sentence
                pending_clean, _ = self.parser.parse(pending_sentence)
                pending_clean = pending_clean.strip()
                
                # 检查合并后的长度
                if len(pending_clean) >= min_text_length:
                    filtered.append(pending_sentence)
                    logger.debug(f"合并短句子: {pending_sentence} (长度: {len(pending_clean)})")
                    pending_sentence = ""
                # 继续累积
                continue
            
            # 文本太短，标记为待合并
            if len(clean_text) < min_text_length:
                pending_sentence = sentence
                logger.debug(f"标记短句子待合并: {sentence} (长度: {len(clean_text)})")
                continue
            
            # 文本长度足够，直接添加
            filtered.append(sentence)
        
        # 处理最后的待合并句子
        if pending_sentence:
            filtered.append(pending_sentence)
            logger.debug(f"添加最后的待合并句子: {pending_sentence}")
        
        logger.info(
            f"句子过滤和合并完成",
            extra={
                "original_count": len(sentences),
                "filtered_count": len(filtered),
                "removed_count": len(sentences) - len(filtered)
            }
        )
        
        return filtered
    
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
        
        # 1.5 过滤和合并句子
        sentences = self._filter_and_merge_sentences(sentences)
        
        if not sentences:
            logger.warning("过滤后没有有效句子")
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
        
        # 注册到音频管理器
        self.audio_manager.register_file(audio_path, self.conversation_id)
        
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
        
        使用线性插值算法：根据标记在文本中的位置比例计算时间戳
        
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
            # 使用线性插值计算时间戳
            if text_length > 0:
                relative_position = markup.position / text_length
                timestamp = sentence_start_time + (relative_position * audio_duration)
            else:
                # 空文本，默认为句子开始
                timestamp = sentence_start_time
            
            timed_markups.append(
                TimedMarkup(
                    type=markup.type,
                    value=markup.value,
                    timestamp=timestamp,
                    sentence_index=sentence_index,
                )
            )
            
            logger.debug(
                f"标记时间戳计算",
                extra={
                    "type": markup.type,
                    "value": markup.value,
                    "position": markup.position,
                    "text_length": text_length,
                    "timestamp": timestamp,
                    "sentence_start": sentence_start_time,
                    "audio_duration": audio_duration,
                },
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
