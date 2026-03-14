"""Qwen3-TTS 实现（阿里云 DashScope API）"""
import os
from typing import Optional, Dict, Any, AsyncGenerator
import httpx

from core.logger import get_logger
from .base import TTSBase
from .registry import TTSRegistry

logger = get_logger(__name__)


@TTSRegistry.register("qwen_tts", "Qwen3-TTS")
class QwenTTS(TTSBase):
    """Qwen3-TTS 实现（阿里云 DashScope API）
    
    配置分离：
    - 供应商配置：api_key, region（新加坡/北京）
    - 音色配置：voice, language_type, instructions, optimize_instructions
    
    支持功能：
    - 9 种预置音色
    - 10+ 语言支持
    - 流式/非流式输出
    - 指令控制（情感、语速、语调）
    """
    
    # 可用音色列表
    VOICES = [
        "Cherry",      # 女声，中文
        "Ryan",        # 男声，英文
        "Aiden",       # 男声，英文
        "Vivian",      # 女声，中文
        "Serena",      # 女声，中文
        "Uncle_Fu",    # 男声，中文
        "Dylan",       # 男声，中文（北京口音）
        "Eric",        # 男声，中文（四川口音）
        "Ono_Anna",    # 女声，日语
        "Sohee"        # 女声，韩语
    ]
    
    # 支持的语言
    LANGUAGES = [
        "Auto",        # 自动检测
        "Chinese",     # 中文
        "English",     # 英文
        "German",      # 德语
        "Italian",     # 意大利语
        "Portuguese",  # 葡萄牙语
        "Spanish",     # 西班牙语
        "Japanese",    # 日语
        "Korean",      # 韩语
        "French",      # 法语
        "Russian"      # 俄语
    ]
    
    @classmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板（带UI元数据）"""
        return {
            # ========== 供应商级别配置 ==========
            "api_key": {
                "type": "password",
                "label": "API Key",
                "description": "阿里云 DashScope API Key",
                "default": "",
                "required": True,
                "placeholder": "sk-xxxxxxxxxxxxxxxx",
                "level": "provider",
                "sensitive": True
            },
            "region": {
                "type": "select",
                "label": "服务区域",
                "description": "选择 API 服务区域",
                "default": "singapore",
                "required": True,
                "options": ["singapore", "beijing"],
                "level": "provider"
            },
            "model": {
                "type": "select",
                "label": "模型",
                "description": "选择 TTS 模型",
                "default": "qwen3-tts-flash",
                "required": True,
                "options": [
                    "qwen3-tts-flash",           # 标准模型
                    "qwen3-tts-instruct-flash"   # 支持指令控制
                ],
                "level": "provider"
            },
            
            # ========== 音色级别配置 ==========
            "voice": {
                "type": "select",
                "label": "音色",
                "description": "选择预置音色",
                "default": "Cherry",
                "required": True,
                "options": cls.VOICES,
                "level": "voice"
            },
            "language_type": {
                "type": "select",
                "label": "语言",
                "description": "指定合成语言（Auto 为自动检测）",
                "default": "Auto",
                "required": False,
                "options": cls.LANGUAGES,
                "level": "voice"
            },
            "instructions": {
                "type": "string",
                "label": "指令控制",
                "description": "控制情感、语速、语调（仅 instruct 模型支持，最多 1600 tokens）",
                "default": "",
                "required": False,
                "placeholder": "例如：语速较快，语调上扬，适合介绍时尚产品",
                "level": "voice"
            },
            "optimize_instructions": {
                "type": "select",
                "label": "优化指令",
                "description": "自动优化指令以提升自然度（仅 instruct 模型支持）",
                "default": "false",
                "required": False,
                "options": ["true", "false"],
                "level": "voice"
            }
        }
    
    def __init__(self, config: dict):
        """初始化 TTS 实例
        
        Args:
            config: 合并后的完整配置（供应商配置 + 音色配置）
        """
        # 供应商级别配置
        self.api_key = config.get("api_key") or os.getenv("DASHSCOPE_API_KEY", "")
        region = config.get("region", "singapore")
        self.model = config.get("model", "qwen3-tts-flash")
        
        # 根据区域设置 API URL
        if region == "beijing":
            self.base_url = "https://dashscope.aliyuncs.com/api/v1"
        else:  # singapore
            self.base_url = "https://dashscope-intl.aliyuncs.com/api/v1"
        
        self.api_url = f"{self.base_url}/services/aigc/multimodal-generation/generation"
        
        # 音色级别配置
        self.voice = config.get("voice", "Cherry")
        self.language_type = config.get("language_type", "Auto")
        self.instructions = config.get("instructions", "")
        self.optimize_instructions = config.get("optimize_instructions", "false") == "true"
        
        # 固定采样率
        self.sample_rate = 24000
    
    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（非流式）
        
        Args:
            text: 要转换的文本（最多 600 字符）
            language: 可选，覆盖默认语言设置
            
        Returns:
            音频数据（bytes）
        """
        lang = language or self.language_type
        
        # 构建请求体
        payload = {
            "model": self.model,
            "input": {
                "text": text,
                "voice": self.voice,
                "language_type": lang
            }
        }
        
        # 如果是 instruct 模型且有指令，添加指令参数
        if "instruct" in self.model and self.instructions:
            payload["input"]["instructions"] = self.instructions
            payload["input"]["optimize_instructions"] = self.optimize_instructions
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            
            # 解析响应
            result = response.json()
            
            # 检查是否有错误
            if "code" in result and result["code"] != "200":
                raise Exception(f"API 错误: {result.get('message', '未知错误')}")
            
            # 获取音频 URL（百联返回的结构）
            if "output" in result and "audio" in result["output"]:
                audio_data = result["output"]["audio"]
                
                # 如果有 URL，下载音频
                if isinstance(audio_data, dict) and "url" in audio_data:
                    audio_url = audio_data["url"]
                    audio_response = await client.get(audio_url)
                    audio_response.raise_for_status()
                    return audio_response.content
                
                # 如果是 base64 字符串
                elif isinstance(audio_data, str):
                    import base64
                    return base64.b64decode(audio_data)
            
            raise Exception(f"无法从响应中提取音频数据: {result}")
    
    async def synthesize_stream(
        self,
        text: str,
        language: Optional[str] = None,
        media_type: str = "wav"
    ) -> AsyncGenerator[bytes, None]:
        """文字转语音（流式输出）
        
        Args:
            text: 要转换的文本
            language: 可选，覆盖默认语言设置
            media_type: 音频格式（暂时忽略，API 返回 base64 编码的音频）
            
        Yields:
            音频数据块（bytes）
        """
        lang = language or self.language_type
        
        # 构建请求体
        payload = {
            "model": self.model,
            "input": {
                "text": text,
                "voice": self.voice,
                "language_type": lang
            }
        }
        
        # 如果是 instruct 模型且有指令，添加指令参数
        if "instruct" in self.model and self.instructions:
            payload["input"]["instructions"] = self.instructions
            payload["input"]["optimize_instructions"] = self.optimize_instructions
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-DashScope-SSE": "enable"  # 启用流式输出
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", self.api_url, json=payload, headers=headers) as response:
                response.raise_for_status()
                
                # 处理 SSE 流
                import base64
                import json
                
                async for line in response.aiter_lines():
                    if not line or line.startswith(":"):
                        continue
                    
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        
                        # 跳过结束标记
                        if data_str == "[DONE]":
                            break
                        
                        try:
                            data = json.loads(data_str)
                            
                            # 检查错误
                            if "code" in data and data["code"] != "200":
                                raise Exception(f"API 错误: {data.get('message', '未知错误')}")
                            
                            # 提取音频数据
                            if "output" in data and "audio" in data["output"]:
                                audio_data = data["output"]["audio"]
                                
                                # 如果是字符串（base64），直接解码
                                if isinstance(audio_data, str):
                                    audio_bytes = base64.b64decode(audio_data)
                                    yield audio_bytes
                                
                                # 如果是字典（包含 URL），下载音频
                                elif isinstance(audio_data, dict) and "url" in audio_data:
                                    audio_url = audio_data["url"]
                                    audio_response = await client.get(audio_url)
                                    audio_response.raise_for_status()
                                    yield audio_response.content
                        
                        except json.JSONDecodeError:
                            continue
    
    def supports_streaming(self) -> bool:
        """支持流式传输"""
        return True
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            # 测试 API 连接：发送一个简短的合成请求
            test_text = "你好" if self.language_type == "Chinese" else "Hello"
            
            payload = {
                "model": self.model,
                "input": {
                    "text": test_text,
                    "voice": self.voice,
                    "language_type": self.language_type
                }
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.api_url, json=payload, headers=headers)
                
                # 检查 HTTP 状态
                if response.status_code == 401:
                    return {
                        "success": False,
                        "message": "API Key 无效或已过期"
                    }
                
                if response.status_code == 403:
                    return {
                        "success": False,
                        "message": "API Key 没有权限访问此服务"
                    }
                
                response.raise_for_status()
                
                # 解析响应
                result = response.json()
                
                # 检查 API 错误
                if "code" in result and result["code"] != "200":
                    return {
                        "success": False,
                        "message": f"API 错误: {result.get('message', '未知错误')}"
                    }
                
                return {
                    "success": True,
                    "message": f"连接成功！模型: {self.model}, 音色: {self.voice}"
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
            logger.error(f"Qwen-TTS 测试连接失败: {e}")
            return {
                "success": False,
                "message": f"测试失败: {str(e)}"
            }
