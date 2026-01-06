"""Genie TTS 实现"""
import httpx
from typing import Optional, Dict, Any, AsyncGenerator

from core.logger import get_logger
from .base import TTSBase
from .registry import TTSRegistry

logger = get_logger(__name__, category="MODEL")


@TTSRegistry.register("genie", "Genie TTS")
class GenieTTS(TTSBase):
    """Genie TTS 实现（支持角色语音克隆）"""
    
    @classmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板"""
        return {
            "api_url": {
                "type": "string",
                "label": "API地址",
                "description": "Genie TTS 服务地址",
                "default": "http://127.0.0.1:8000",
                "required": True,
                "placeholder": "http://127.0.0.1:8000"
            },
            "character_name": {
                "type": "string",
                "label": "角色名称",
                "description": "唯一的角色标识符",
                "default": "",
                "required": True,
                "placeholder": "my_character"
            },
            "onnx_model_dir": {
                "type": "string",
                "label": "模型目录",
                "description": "ONNX 模型文件夹路径（服务器端）",
                "default": "",
                "required": True,
                "placeholder": "C:\\models\\character_model"
            },
            "language": {
                "type": "select",
                "label": "模型语言",
                "description": "模型支持的语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "jp"]
            },
            "reference_audio_path": {
                "type": "string",
                "label": "参考音频路径",
                "description": "用于声音克隆的参考音频文件路径（服务器端）",
                "default": "",
                "required": True,
                "placeholder": "C:\\audio\\reference.wav"
            },
            "reference_audio_text": {
                "type": "string",
                "label": "参考音频文本",
                "description": "参考音频对应的文本内容",
                "default": "",
                "required": True,
                "placeholder": "这是参考音频的文本"
            },
            "reference_language": {
                "type": "select",
                "label": "参考音频语言",
                "description": "参考音频的语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "jp"]
            },
            "split_sentence": {
                "type": "select",
                "label": "自动分句",
                "description": "是否自动分割长句子",
                "default": "true",
                "required": False,
                "options": ["true", "false"]
            }
        }
    
    def __init__(self, config: dict):
        self.api_url = config.get("api_url", "http://127.0.0.1:8000")
        self.character_name = config.get("character_name", "")
        self.onnx_model_dir = config.get("onnx_model_dir", "")
        self.language = config.get("language", "zh")
        self.reference_audio_path = config.get("reference_audio_path", "")
        self.reference_audio_text = config.get("reference_audio_text", "")
        self.reference_language = config.get("reference_language", "zh")
        self.split_sentence = config.get("split_sentence", "true") == "true"
        
        self._character_loaded = False
        self._reference_set = False
    
    async def _ensure_character_loaded(self):
        """确保角色模型已加载"""
        if self._character_loaded:
            return
        
        logger.info(f"加载 Genie TTS 角色模型", extra={"character": self.character_name})
        
        payload = {
            "character_name": self.character_name,
            "onnx_model_dir": self.onnx_model_dir,
            "language": self.language
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{self.api_url}/load_character", json=payload)
            response.raise_for_status()
            result = response.json()
            logger.info(f"角色模型加载成功", extra={"message": result.get("message")})
            self._character_loaded = True
    
    async def _ensure_reference_audio_set(self):
        """确保参考音频已设置"""
        if self._reference_set:
            return
        
        await self._ensure_character_loaded()
        
        logger.info(f"设置 Genie TTS 参考音频", extra={"character": self.character_name})
        
        payload = {
            "character_name": self.character_name,
            "audio_path": self.reference_audio_path,
            "audio_text": self.reference_audio_text,
            "language": self.reference_language
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{self.api_url}/set_reference_audio", json=payload)
            response.raise_for_status()
            result = response.json()
            logger.info(f"参考音频设置成功", extra={"message": result.get("message")})
            self._reference_set = True
    
    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（非流式）"""
        await self._ensure_reference_audio_set()
        
        payload = {
            "character_name": self.character_name,
            "text": text,
            "split_sentence": self.split_sentence
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{self.api_url}/tts", json=payload)
            response.raise_for_status()
            pcm_data = response.content
            
            # Genie TTS 返回的是原始 PCM 数据，需要添加 WAV 头
            return self._pcm_to_wav(pcm_data)
    
    async def synthesize_stream(
        self,
        text: str,
        language: Optional[str] = None,
        media_type: str = "wav"
    ) -> AsyncGenerator[bytes, None]:
        """文字转语音（流式输出）"""
        await self._ensure_reference_audio_set()
        
        payload = {
            "character_name": self.character_name,
            "text": text,
            "split_sentence": self.split_sentence
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", f"{self.api_url}/tts", json=payload) as response:
                response.raise_for_status()
                
                # 收集所有 PCM 数据
                pcm_chunks = []
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if chunk:
                        pcm_chunks.append(chunk)
                
                # 合并并转换为 WAV
                pcm_data = b''.join(pcm_chunks)
                wav_data = self._pcm_to_wav(pcm_data)
                
                # 一次性返回完整的 WAV 数据
                yield wav_data
    
    def _pcm_to_wav(self, pcm_data: bytes) -> bytes:
        """将 PCM 数据转换为 WAV 格式
        
        Args:
            pcm_data: 原始 PCM 数据（16-bit, 单声道, 32kHz）
            
        Returns:
            完整的 WAV 文件数据
        """
        import struct
        
        sample_rate = 32000
        channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        data_size = len(pcm_data)
        
        # 构建 WAV 头
        wav_header = b'RIFF'
        wav_header += struct.pack('<I', data_size + 36)  # 文件大小 - 8
        wav_header += b'WAVE'
        wav_header += b'fmt '
        wav_header += struct.pack('<I', 16)  # fmt chunk size
        wav_header += struct.pack('<H', 1)   # PCM format
        wav_header += struct.pack('<H', channels)
        wav_header += struct.pack('<I', sample_rate)
        wav_header += struct.pack('<I', byte_rate)
        wav_header += struct.pack('<H', block_align)
        wav_header += struct.pack('<H', bits_per_sample)
        wav_header += b'data'
        wav_header += struct.pack('<I', data_size)
        
        return wav_header + pcm_data
    
    def supports_streaming(self) -> bool:
        """不支持真正的流式传输（需要完整数据才能生成 WAV 头）"""
        return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接（尝试加载角色模型）"""
        try:
            # 测试基础连接
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 尝试访问根路径或健康检查端点
                try:
                    response = await client.get(self.api_url)
                except httpx.HTTPStatusError:
                    pass  # 某些服务器可能不支持 GET /
            
            # 测试加载角色模型
            payload = {
                "character_name": self.character_name,
                "onnx_model_dir": self.onnx_model_dir,
                "language": self.language
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(f"{self.api_url}/load_character", json=payload)
                response.raise_for_status()
                result = response.json()
                
                # 标记为已加载
                self._character_loaded = True
                
                return {
                    "success": True,
                    "message": f"连接成功，角色模型已加载: {result.get('message', '')}"
                }
        
        except httpx.ConnectError:
            return {
                "success": False,
                "message": f"无法连接到服务: {self.api_url}"
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "message": f"连接超时: {self.api_url}"
            }
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "message": f"HTTP 错误 {e.response.status_code}: {e.response.text}"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"测试失败: {str(e)}"
            }
    
    async def unload_character(self) -> Dict[str, Any]:
        """卸载角色模型（释放资源）"""
        if not self._character_loaded:
            return {"success": True, "message": "角色未加载"}
        
        try:
            payload = {"character_name": self.character_name}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.api_url}/unload_character", json=payload)
                response.raise_for_status()
                result = response.json()
                
                self._character_loaded = False
                self._reference_set = False
                
                logger.info(f"角色模型已卸载", extra={"character": self.character_name})
                
                return {
                    "success": True,
                    "message": result.get("message", "角色已卸载")
                }
        except Exception as e:
            logger.error(f"卸载角色失败", extra={"error": str(e)})
            return {
                "success": False,
                "message": f"卸载失败: {str(e)}"
            }
    
    async def stop_all_tasks(self) -> Dict[str, Any]:
        """停止所有 TTS 任务"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.api_url}/stop")
                response.raise_for_status()
                result = response.json()
                
                logger.info("已停止所有 TTS 任务")
                
                return {
                    "success": True,
                    "message": result.get("message", "所有任务已停止")
                }
        except Exception as e:
            logger.error(f"停止任务失败", extra={"error": str(e)})
            return {
                "success": False,
                "message": f"停止失败: {str(e)}"
            }
    
    async def clear_reference_cache(self) -> Dict[str, Any]:
        """清除参考音频缓存"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.api_url}/clear_reference_audio_cache")
                response.raise_for_status()
                result = response.json()
                
                self._reference_set = False
                logger.info("参考音频缓存已清除")
                
                return {
                    "success": True,
                    "message": result.get("message", "缓存已清除")
                }
        except Exception as e:
            logger.error(f"清除缓存失败", extra={"error": str(e)})
            return {
                "success": False,
                "message": f"清除失败: {str(e)}"
            }
