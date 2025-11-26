"""FunASR 实现"""
import os
from typing import Optional, Union
from pathlib import Path


from .base import ASRBase


class FunASR(ASRBase):
    """FunASR 实现（阿里达摩院语音识别）"""
    
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
                os.unlink(audio_path)
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
