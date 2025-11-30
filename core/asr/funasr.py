"""FunASR 实现"""
import os
from typing import Optional, Union, Dict, Any
from pathlib import Path


from .base import ASRBase


class FunASR(ASRBase):
    """FunASR 实现（阿里达摩院语音识别）"""
    
    @classmethod
    def get_config_template(cls) -> Dict[str, Any]:
        """获取配置模板（带UI元数据）"""
        return {
            "model": {
                "type": "file",
                "label": "主模型路径",
                "description": "FunASR主模型文件路径或模型ID",
                "default": "paraformer-zh",
                "required": True,
                "placeholder": "./asr_models/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
                "accept": ""  # 目录选择
            },
            "device": {
                "type": "select",
                "label": "运行设备",
                "description": "选择模型运行的设备",
                "default": "cpu",
                "required": True,
                "options": ["cpu", "cuda"]
            },
            "vad_model": {
                "type": "file",
                "label": "VAD模型路径",
                "description": "语音活动检测模型路径",
                "default": None,
                "required": True,
                "placeholder": "./asr_models/speech_fsmn_vad_zh-cn-16k-common-pytorch",
                "accept": ""
            },
            "punc_model": {
                "type": "file",
                "label": "标点模型路径",
                "description": "标点恢复模型路径",
                "default": None,
                "required": True,
                "placeholder": "./asr_models/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
                "accept": ""
            },
            "language": {
                "type": "select",
                "label": "语言",
                "description": "识别语言",
                "default": "zh",
                "required": True,
                "options": ["zh", "en", "auto"]
            }
        }
    
    def __init__(self, config: dict):
        """初始化
        
        Args:
            config: FunASR配置字典
        """
        try:
            from funasr import AutoModel
        except ImportError:
            raise ImportError(
                "FunASR未安装，请运行: pip install funasr \n 确保已经安装了torch、torchaudio"
            )
        config = dict(filter(lambda item: item[1] is not None, config.items()))
        
        # 初始化模型
        self.model = AutoModel(**config, disable_update=True)
    
    def transcribe(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（同步）"""
        # 处理不同输入类型
        if isinstance(audio, bytes):
            # bytes需要保存为临时文件
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio)
                audio_path = tmp.name
            
            try:
                result = self._recognize(audio_path)
            finally:
                # 确保临时文件被删除
                try:
                    os.unlink(audio_path)
                except OSError:
                    pass
        else:
            # 文件路径
            audio_path = str(audio)
            result = self._recognize(audio_path)
        
        return result
    
    async def transcribe_async(
        self,
        audio: Union[bytes, str, Path],
        language: Optional[str] = None
    ) -> str:
        """语音转文字（异步）
        
        注意：FunASR本身不支持异步，这里使用线程池模拟
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self.transcribe,
                audio,
                language
            )
        return result
    
    def _recognize(self, audio_path: str) -> str:
        """执行识别"""
        result = self.model.generate(input=audio_path) 
        print(result)
        return result[0]["text"]
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        检查模型文件是否存在，模型已在__init__中加载，无需重复加载
        """
        try:    
            # 模型已在__init__中加载，这里只需验证self.model是否可用
            if self.model is None:
                return {
                    "success": False,
                    "message": "模型未正确初始化"
                }
            
            return {"success": True, "message": "模型已加载并可用"}
        
        except Exception as e:
            return {
                "success": False,
                "message": f"测试失败: {str(e)}"
            }
