"""GPT-SoVITS TTS 实现"""
import httpx
from typing import Optional, Dict, Any
from pathlib import Path

from .base import TTSBase


class GPTSoVITSTTS(TTSBase):
    """GPT-SoVITS TTS 实现（适配 api_v2.py 的 POST /tts 接口）"""
    
    @classmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板（带UI元数据）"""
        return {
            "api_url": {
                "type": "string",
                "label": "API地址",
                "description": "GPT-SoVITS服务地址",
                "default": "http://localhost:9880",
                "required": True,
                "placeholder": "http://localhost:9880"
            },
            "refer_wav_path": {
                "type": "file",
                "label": "参考音频路径",
                "description": "参考音频文件路径",
                "default": "",
                "required": True,
                "placeholder": "",
                "accept": ".wav,.mp3"
            },
            "prompt_text": {
                "type": "string",
                "label": "参考文本",
                "description": "参考音频对应的文本",
                "default": "",
                "required": True,
                "placeholder": ""
            },
            "prompt_language": {
                "type": "select",
                "label": "参考语言",
                "description": "参考文本的语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "ja"]
            },
            "text_language": {
                "type": "select",
                "label": "合成语言",
                "description": "默认合成语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "ja"]
            }
        }
    
    def __init__(self, config: dict):
        self.api_url = config.get("api_url", "http://localhost:9880") + "/tts"
        self.refer_wav_path = config.get("refer_wav_path", "")
        self.prompt_text = config.get("prompt_text", "")
        self.prompt_language = config.get("prompt_language", "zh")
        self.text_language = config.get("text_language", "zh")
    
    def synthesize(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（同步） - 使用 POST /tts"""
        lang = language or self.text_language
        
        # 构建 JSON 请求体（注意字段名！）
        json_data = {
            "text": text,
            "text_lang": lang,                     
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_lang": self.prompt_language,   
        }
        
        with httpx.Client(timeout=60.0) as client:
            response = client.post(self.api_url, json=json_data)  # ← 改为 POST + json
            response.raise_for_status()
            return response.content
    
    async def synthesize_async(
        self,
        text: str,
        language: Optional[str] = None
    ) -> bytes:
        """文字转语音（异步）"""
        lang = language or self.text_language
        
        json_data = {
            "text": text,
            "text_lang": lang,
            "ref_audio_path": self.refer_wav_path,
            "prompt_text": self.prompt_text,
            "prompt_lang": self.prompt_language,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.api_url, json=json_data)  # ← POST + json
            response.raise_for_status()
            return response.content
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接"""
        try:
            # 检查参考音频文件是否存在
            if self.refer_wav_path:
                refer_path = Path(self.refer_wav_path)
                if not refer_path.exists():
                    return {
                        "success": False,
                        "message": f"参考音频文件不存在: {self.refer_wav_path}"
                    }
            
            # 测试API连接
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 尝试访问健康检查端点或发送测试请求
                base_url = self.api_url.replace("/tts", "")
                response = await client.get(f"{base_url}/")
                
                if response.status_code == 200:
                    return {"success": True, "message": "连接成功"}
                else:
                    return {
                        "success": False,
                        "message": f"服务响应异常: {response.status_code}"
                    }
        
        except httpx.ConnectError:
            return {
                "success": False,
                "message": f"无法连接到服务: {self.api_url}"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"测试失败: {str(e)}"
            }