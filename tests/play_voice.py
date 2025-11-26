from io import BytesIO
import wave
import numpy as np
import sounddevice as sd

def play_audio_from_bytes(
    audio_bytes: bytes,
    fallback_sample_rate: int = 24000,
    fallback_channels: int = 1,
    fallback_dtype: type = np.int16
):
    """
    自动识别 audio_bytes 是 WAV 还是 raw PCM，并播放。
    
    参数:
        audio_bytes: 音频字节数据（WAV 或 raw PCM）
        fallback_sample_rate: raw PCM 的默认采样率（Hz）
        fallback_channels: raw PCM 的默认声道数（1=mono, 2=stereo）
        fallback_dtype: raw PCM 的默认数据类型（如 np.int16）
    """
    if not audio_bytes:
        print("[Warning] Empty audio data, nothing to play.")
        return

    try:
        if audio_bytes.startswith(b'RIFF'):
            # === 处理 WAV 格式 ===
            with BytesIO(audio_bytes) as wav_buffer:
                with wave.open(wav_buffer, 'rb') as wf:
                    sample_rate = wf.getframerate()
                    channels = wf.getnchannels()
                    samp_width = wf.getsampwidth()
                    frames = wf.readframes(-1)

            # 转换为 numpy 数组
            if samp_width == 1:
                dtype = np.uint8
                audio_data = np.frombuffer(frames, dtype=dtype).astype(np.int16) - 128
                audio_data = audio_data * 256  # approximate scaling to int16 range
            elif samp_width == 2:
                dtype = np.int16
                audio_data = np.frombuffer(frames, dtype=dtype)
            else:
                raise ValueError(f"Unsupported sample width: {samp_width} bytes")

            # 归一化到 [-1.0, 1.0]
            audio_data = audio_data.astype(np.float32) / 32768.0

            # 重塑为多通道（仅 stereo 需要）
            if channels == 2:
                if len(audio_data) % 2 != 0:
                    audio_data = audio_data[:-1]  # 丢弃最后一个不完整的样本
                audio_data = audio_data.reshape(-1, 2)

            sd.play(audio_data, samplerate=sample_rate)
            sd.wait()

        else:
            # === 处理 raw PCM ===
            print("[Info] Detected raw PCM data.")
            dtype = fallback_dtype
            channels = fallback_channels
            sample_rate = fallback_sample_rate

            # 检查字节长度是否匹配 dtype
            sample_size = np.dtype(dtype).itemsize
            if len(audio_bytes) % sample_size != 0:
                trimmed_len = (len(audio_bytes) // sample_size) * sample_size
                audio_bytes = audio_bytes[:trimmed_len]
                print(f"[Warning] Raw PCM length not aligned; trimmed to {trimmed_len} bytes.")

            audio_data = np.frombuffer(audio_bytes, dtype=dtype)
            audio_data = audio_data.astype(np.float32) / 32768.0  # 归一化

            # 重塑为多通道（仅 stereo）
            if channels == 2:
                if len(audio_data) % 2 != 0:
                    audio_data = audio_data[:-1]
                audio_data = audio_data.reshape(-1, 2)

            sd.play(audio_data, samplerate=sample_rate)
            sd.wait()

    except Exception as e:
        print(f"[Error] Failed to play audio: {e}")
        raise