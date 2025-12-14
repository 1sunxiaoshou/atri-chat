"""VRM服务层

统一管理VRM相关的业务逻辑，减少代码冗余
"""
from typing import Dict, List, Optional, Any, AsyncGenerator
from dataclasses import dataclass

from .audio_generator import AudioGenerator
from .audio_generator_parallel import ParallelAudioGenerator
from .audio_manager import AudioFileManager
from .markup_parser import VRMMarkupParser
from .markup_filter import MarkupFilter
from ..storage import AppStorage
from ..tts.factory import TTSFactory
from ..logger import get_logger

logger = get_logger(__name__, category="VRM")


@dataclass
class VRMContext:
    """VRM上下文信息"""
    character_id: int
    character: Dict[str, Any]
    vrm_model_id: Optional[str]
    action_mapping: Dict[str, str]
    tts_id: str


class VRMService:
    """VRM服务
    
    统一管理VRM相关的业务逻辑：
    - 动作映射管理
    - 音频生成
    - 标记解析
    """
    
    def __init__(
        self,
        app_storage: AppStorage,
        tts_factory: TTSFactory,
        parallel_tts: bool = True,
        audio_manager: Optional[AudioFileManager] = None
    ):
        """初始化VRM服务
        
        Args:
            app_storage: 应用存储实例
            tts_factory: TTS工厂实例
            parallel_tts: 是否启用并行TTS（默认True）
            audio_manager: 音频文件管理器（可选，如不提供则创建默认实例）
        """
        self.app_storage = app_storage
        self.tts_factory = tts_factory
        self.parallel_tts = parallel_tts
        self._action_mapping_cache = {}
        
        # 音频文件管理器
        from ..paths import get_path_manager
        path_manager = get_path_manager()
        vrm_audio_dir = path_manager.uploads_dir / "vrm_audio"
        
        self.audio_manager = audio_manager or AudioFileManager(
            audio_dir=vrm_audio_dir,
            ttl_seconds=3600,  # 1小时过期
            max_size_mb=500,   # 最大500MB
            cleanup_interval=300  # 5分钟清理一次
        )
        
        logger.debug(
            "VRM服务初始化完成",
            extra={"parallel_tts": parallel_tts}
        )
    
    def create_vrm_context(self, character_id: int) -> VRMContext:
        """创建VRM上下文
        
        Args:
            character_id: 角色ID
            
        Returns:
            VRM上下文对象
            
        Raises:
            ValueError: 角色不存在时
        """
        character = self.app_storage.get_character(character_id)
        if not character:
            raise ValueError(f"角色 {character_id} 不存在")
        
        vrm_model_id = character.get("vrm_model_id")
        action_mapping = self.get_action_mapping(vrm_model_id)
        tts_id = character.get("tts_id", "default")
        
        context = VRMContext(
            character_id=character_id,
            character=character,
            vrm_model_id=vrm_model_id,
            action_mapping=action_mapping,
            tts_id=tts_id
        )
        
        logger.debug(
            "VRM上下文创建完成",
            extra={
                "character_id": character_id,
                "vrm_model_id": vrm_model_id,
                "action_count": len(action_mapping)
            }
        )
        
        return context
    
    def get_action_mapping(self, vrm_model_id: Optional[str]) -> Dict[str, str]:
        """获取动作映射（带缓存）
        
        Args:
            vrm_model_id: VRM模型ID
            
        Returns:
            动作映射字典 {中文名: 英文ID}
        """
        if not vrm_model_id:
            return {}
        
        # 检查缓存
        if vrm_model_id in self._action_mapping_cache:
            return self._action_mapping_cache[vrm_model_id]
        
        try:
            # 通过关联表获取模型的动作
            animations = self.app_storage.get_model_animations(vrm_model_id)
            action_mapping = {anim["name_cn"]: anim["name"] for anim in animations}
            
            # 缓存结果
            self._action_mapping_cache[vrm_model_id] = action_mapping
            
            logger.debug(
                "动作映射获取完成",
                extra={"vrm_model_id": vrm_model_id, "action_count": len(action_mapping)}
            )
            
            return action_mapping
            
        except Exception as e:
            logger.warning(f"获取VRM动作映射失败: {e}")
            return {}
    
    def get_available_actions(self, vrm_model_id: Optional[str]) -> List[str]:
        """获取可用动作列表（中文名）
        
        Args:
            vrm_model_id: VRM模型ID
            
        Returns:
            动作中文名列表
        """
        action_mapping = self.get_action_mapping(vrm_model_id)
        return list(action_mapping.keys())
    
    async def generate_vrm_audio_segments(
        self,
        full_response: str,
        vrm_context: VRMContext
    ) -> AsyncGenerator[str, None]:
        """生成VRM音频段
        
        Args:
            full_response: 带标记的完整回复
            vrm_context: VRM上下文
            
        Yields:
            JSON格式的音频段数据
        """
        try:
            # 创建音频生成器（根据配置选择串行或并行）
            if self.parallel_tts:
                audio_gen = ParallelAudioGenerator(
                    self.tts_factory,
                    action_mapping=vrm_context.action_mapping,
                    audio_manager=self.audio_manager,
                    conversation_id=vrm_context.character_id  # 使用character_id作为会话标识
                )
                logger.debug("使用并行TTS模式")
            else:
                audio_gen = AudioGenerator(
                    self.tts_factory,
                    action_mapping=vrm_context.action_mapping,
                    audio_manager=self.audio_manager,
                    conversation_id=vrm_context.character_id
                )
                logger.debug("使用串行TTS模式")
            
            logger.debug(
                "开始生成VRM音频段",
                extra={
                    "character_id": vrm_context.character_id,
                    "tts_id": vrm_context.tts_id,
                    "text_length": len(full_response)
                }
            )
            
            # 生成音频段
            segments = await audio_gen.generate_by_sentence(
                full_response,
                tts_provider=vrm_context.tts_id
            )
            
            # 逐个发送音频段
            for i, segment in enumerate(segments):
                # 生成口型数据（可选）
                viseme_data = await self._generate_viseme_data(segment)
                
                # 构建音频段数据
                segment_data = {
                    "sentence_index": segment.sentence_index,
                    "text": segment.text,
                    "marked_text": segment.marked_text,
                    "audio_url": segment.audio_url,
                    "duration": segment.duration,
                    "start_time": segment.start_time,
                    "end_time": segment.end_time,
                    "markups": [
                        {
                            "type": markup.type,
                            "value": markup.value,
                            "timestamp": markup.timestamp,
                            "sentence_index": markup.sentence_index
                        }
                        for markup in segment.markups
                    ],
                    "viseme_data": viseme_data
                }
                
                logger.debug(
                    f"发送音频段 {i + 1}/{len(segments)}",
                    extra={
                        "sentence_index": segment.sentence_index,
                        "duration": segment.duration,
                        "markup_count": len(segment.markups)
                    }
                )
                
                # 发送单个音频段
                import json
                yield json.dumps({
                    "type": "vrm_audio_segment",
                    "segment": segment_data,
                    "total_segments": len(segments),
                    "current_index": i
                }, ensure_ascii=False)
            
            # 发送完成信号
            total_duration = segments[-1].end_time if segments else 0.0
            yield json.dumps({
                "type": "vrm_audio_complete",
                "total_segments": len(segments),
                "total_duration": total_duration
            }, ensure_ascii=False)
            
            logger.info(
                "VRM音频段生成完成",
                extra={
                    "character_id": vrm_context.character_id,
                    "segment_count": len(segments),
                    "total_duration": total_duration
                }
            )
            
        except Exception as e:
            logger.error(
                "VRM音频段生成失败",
                extra={
                    "character_id": vrm_context.character_id,
                    "error": str(e)
                },
                exc_info=True
            )
            import json
            yield json.dumps({
                "type": "vrm_error",
                "error": "音频生成失败",
                "details": str(e)
            }, ensure_ascii=False)
    
    async def _generate_viseme_data(self, segment) -> Optional[Dict]:
        """生成口型数据（可选功能）"""
        try:
            # TODO: 实现口型生成逻辑
            return {
                "enabled": False,
                "keyframes": [],
                "duration": segment.duration
            }
        except Exception as e:
            logger.warning(f"口型数据生成失败: {e}")
            return None
    
    def clear_cache(self):
        """清空缓存"""
        self._action_mapping_cache.clear()
        logger.debug("VRM服务缓存已清空")
    
    def cleanup_conversation_audio(self, conversation_id: int) -> int:
        """清理指定会话的音频文件
        
        Args:
            conversation_id: 会话ID
            
        Returns:
            清理的文件数量
        """
        return self.audio_manager.cleanup_conversation(conversation_id)
    
    def get_audio_stats(self) -> Dict:
        """获取音频文件统计信息"""
        return self.audio_manager.get_stats()
    
    async def start_audio_cleanup(self):
        """启动音频文件后台清理"""
        await self.audio_manager.start_background_cleanup()
    
    async def stop_audio_cleanup(self):
        """停止音频文件后台清理"""
        await self.audio_manager.stop_background_cleanup()