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
                "placeholder": "asr_models/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
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
                "description": "语音活动检测模型路径（可选）",
                "default": None,
                "required": False,
                "placeholder": "asr_models/speech_fsmn_vad_zh-cn-16k-common-pytorch",
                "accept": ""
            },
            "punc_model": {
                "type": "file",
                "label": "标点模型路径",
                "description": "标点恢复模型路径（可选）",
                "default": None,
                "required": False,
                "placeholder": "asr_models/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
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
        
        self.model_name = config.get("model", "paraformer-zh")
        self.device = config.get("device", "cpu")
        self.vad_model = config.get("vad_model")
        self.punc_model = config.get("punc_model")
        self.language = config.get("language", "zh")
        
        # 初始化模型
        self.model = AutoModel(
            model=self.model_name,
            vad_model=self.vad_model,
            punc_model=self.punc_model,
            device=self.device,
            disable_update=True,
        )
    
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
        
        # 解析结果
        if isinstance(result, list) and len(result) > 0:
            # 提取文本
            if isinstance(result[0], dict):
                return result[0].get("text", "")
            elif isinstance(result[0], str):
                return result[0]
        
        return ""
    
    async def test_connection(self) -> Dict[str, Any]:
        """测试连接
        
        检查模型文件是否存在，模型已在__init__中加载，无需重复加载
        """
        try:
            # 检查主模型路径
            model_path = Path(self.model_name)
            if not model_path.exists():
                return {
                    "success": False,
                    "message": f"模型文件不存在: {self.model_name}"
                }
            
            # 检查VAD模型（如果配置了）
            if self.vad_model:
                vad_path = Path(self.vad_model)
                if not vad_path.exists():
                    return {
                        "success": False,
                        "message": f"VAD模型文件不存在: {self.vad_model}"
                    }
            
            # 检查标点模型（如果配置了）
            if self.punc_model:
                punc_path = Path(self.punc_model)
                if not punc_path.exists():
                    return {
                        "success": False,
                        "message": f"标点模型文件不存在: {self.punc_model}"
                    }
            
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
