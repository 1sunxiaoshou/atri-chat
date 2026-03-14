"""GPT-SoVITS TTS 实现"""
import httpx
from typing import Optional, Dict, Any, AsyncGenerator

from core.logger import get_logger
from .base import TTSBase
from .registry import TTSRegistry

logger = get_logger(__name__)


@TTSRegistry.register("gpt_sovits", "GPT-SoVITS")
class GPTSoVITSTTS(TTSBase):
    """GPT-SoVITS TTS 实现（适配 api_v2.py 的 POST /tts 接口）
    
    配置分离：
    - 供应商配置：api_url（服务地址）
    - 音色配置：refer_wav_path, prompt_text, prompt_language, text_language
    """
    
    @classmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板（带UI元数据）
        
        注意：这个模板包含所有字段，但在实际使用时：
        - TTSProvider.config_payload 只存储供应商级别字段
        - VoiceAsset.voice_config 只存储音色级别字段
        """
        return {
            # ========== 供应商级别配置 ==========
            "api_url": {
                "type": "string",
                "label": "API地址",
                "description": "GPT-SoVITS服务地址",
                "default": "http://localhost:9880",
                "required": True,
                "placeholder": "http://localhost:9880",
                "level": "provider"  # 标记为供应商级别
            },
            
            # ========== 音色级别配置 ==========
            "refer_wav_path": {
                "type": "file",
                "label": "参考音频路径",
                "description": "参考音频文件路径",
                "default": "",
                "required": True,
                "placeholder": "",
                "accept": ".wav,.mp3",
                "level": "voice"  # 标记为音色级别
            },
            "prompt_text": {
                "type": "string",
                "label": "参考文本",
                "description": "参考音频对应的文本",
                "default": "",
                "required": True,
                "placeholder": "",
                "level": "voice"
            },
            "prompt_language": {
                "type": "select",
                "label": "参考语言",
                "description": "参考文本的语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "ja"],
                "level": "voice"
            },
            "text_language": {
                "type": "select",
                "label": "合成语言",
                "description": "默认合成语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "ja"],
                "level": "voice"
            }
        }
    
    def __init__(self, config: dict):
        """初始化 TTS 实例
        
        Args:
            config: 合并后的完整配置（供应商配置 + 音色配置）
        """
        # 供应商级别配置
        self.api_url = config.get("api_url", "http://localhost:9880") + "/tts"
        
        # 音色级别配置
        self.refer_wav_path = config.get("refer_wav_path", "")
        self.prompt_text = config.get("prompt_text", "")
        self.prompt_language = config.get("prompt_language", "zh")
        self.text_language = config.get("text_language", "zh")
        
        self.sample_rate = 48000 

    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（非流式）"""
        lang = language or self.text_language
        
        json_data = {
            "text": text,
            "text_lang": lang,
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_lang": self.prompt_language,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.api_url, json=json_data)
            response.raise_for_status()
            return response.content
    
    async def synthesize_stream(
        self,
        text: str,
        language: Optional[str] = None,
        media_type: str = "wav"
    ) -> AsyncGenerator[bytes, None]:
        """文字转语音（流式输出）
        
        注意：为了获取采样率，我们总是请求wav格式，然后提取PCM数据
        """
        lang = language or self.text_language
        
        json_data = {
            "text": text,
            "text_lang": lang,
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_lang": self.prompt_language,
            "streaming_mode": True,
            "media_type": "wav",  # 总是请求wav格式以获取采样率
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", self.api_url, json=json_data) as response:
                response.raise_for_status()
                
                first_chunk = True
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if chunk:
                        if first_chunk and len(chunk) >= 44 and chunk[:4] == b'RIFF':
                            # 从WAV头读取采样率（字节24-27）
                            import struct
                            self.sample_rate = struct.unpack('<I', chunk[24:28])[0]
                            
                            # 如果需要raw格式，跳过WAV头（44字节）
                            if media_type == "raw":
                                yield chunk[44:]
                            else:
                                yield chunk
                            first_chunk = False
                        else:
                            yield chunk
                            first_chunk = False
    
    def supports_streaming(self) -> bool:
        """支持流式传输"""
        return True
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接：只要能收到 HTTP 响应（无论状态码），即视为可用"""
        try:      
            # 测试 API 连接：直接请求配置的 api_url
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.api_url)

                return {
                    "success": True,
                    "message": f"连接成功（状态码: {response.status_code}）"
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
        except Exception as e:
            logger.error(f"GPT-SoVITS 测试连接失败: {e}")
            return {
                "success": False,
                "message": f"测试失败: {str(e)}"
            }