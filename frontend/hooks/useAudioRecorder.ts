import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api/index';
import { HTTP_STATUS } from '../utils/constants';
import { Logger } from '../utils/logger';
import { useAudioStore } from '../store/useAudioStore';

/**
 * 将 AudioBuffer 转换为 WAV 格式的 Blob
 */
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = new Float32Array(buffer.length * numberOfChannels);

  // 交错声道数据
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      data[i * numberOfChannels + channel] = channelData[i] ?? 0;
    }
  }

  // 转换为 16-bit PCM
  const samples = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i] ?? 0));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const dataLength = samples.length * bytesPerSample;
  const buffer_array = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer_array);

  // WAV 文件头
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // 写入 PCM 数据
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample !== undefined) {
      view.setInt16(offset + i * 2, sample, true);
    }
  }

  return new Blob([buffer_array], { type: 'audio/wav' });
};

/**
 * 音频录制 Hook - 使用 AudioWorklet 录音
 */
export const useAudioRecorder = () => {
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>('');

  // 从 Zustand Store 读取 ASR 设置（替代 localStorage 直读）
  const asrLanguage = useAudioStore((state) => state.asrLanguage);
  const asrUseInt8 = useAudioStore((state) => state.asrUseInt8);

  // AudioWorklet 相关
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const cleanupTimeoutRef = useRef<number | undefined>(undefined);

  /**
   * 开始录音
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscribedText('');

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 创建 AudioContext，采样率 16kHz（SenseVoice 要求）
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // 加载 AudioWorklet 模块
      try {
        await audioContext.audioWorklet.addModule('/audio-processor.js');
      } catch (err) {
        Logger.error('加载 AudioWorklet 失败', err instanceof Error ? err : undefined);
        throw new Error('无法加载音频处理器');
      }

      // 创建音频源
      const source = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // 创建 AudioWorklet 节点
      const workletNode = new AudioWorkletNode(audioContext, 'recorder-processor');
      workletNodeRef.current = workletNode;

      recordedChunksRef.current = [];

      // 监听来自 worklet 的消息
      workletNode.port.onmessage = (event) => {
        if (event.data.eventType === 'data') {
          recordedChunksRef.current.push(new Float32Array(event.data.audioData));
        }
      };

      // 连接节点
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      setIsRecording(true);
      Logger.debug('录音已开始', { sampleRate: audioContext.sampleRate });

    } catch (err) {
      Logger.error('无法访问麦克风', err instanceof Error ? err : undefined);
      const errorMessage = err instanceof Error ? err.message : '无法访问麦克风';
      setError(errorMessage);

      // 清理资源
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
    }
  }, []);

  /**
   * 停止录音
   */
  const stopRecording = useCallback(async () => {
    if (!audioContextRef.current || recordedChunksRef.current.length === 0) {
      setError('没有录制到音频数据');
      setIsRecording(false);
      return;
    }

    setIsRecording(false);
    setIsProcessing(true);

    try {
      const audioContext = audioContextRef.current;

      // 断开节点前先发 flush，让 Worklet 把剩余缓冲区数据发送出来（P0 修复）
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ command: 'flush' });
        // 等待 flush 消息被处理
        await new Promise(resolve => setTimeout(resolve, 50));
        workletNodeRef.current.disconnect();
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current = null;
      }

      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
      }

      // 停止音频流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // 合并所有录音片段
      const totalLength = recordedChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedData = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of recordedChunksRef.current) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      // 创建 AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        1, // 单声道
        combinedData.length,
        audioContext.sampleRate
      );
      audioBuffer.getChannelData(0).set(combinedData);

      // 转换为 WAV
      const wavBlob = audioBufferToWav(audioBuffer);

      Logger.debug('音频已转换为 WAV', {
        size: wavBlob.size,
        duration: audioBuffer.duration.toFixed(2) + 's',
        sampleRate: audioBuffer.sampleRate
      });

      // 关闭 AudioContext
      await audioContext.close();
      audioContextRef.current = null;
      recordedChunksRef.current = [];

      // 从 Store 读取 ASR 设置（已在 hook 顶部声明）
      Logger.debug('读取 ASR 设置', {
        language: asrLanguage,
        useInt8: asrUseInt8
      });

      // 调用转录 API
      const response = await api.transcribeAudio(wavBlob, asrLanguage, asrUseInt8);

      if (response.code === HTTP_STATUS.OK) {
        setTranscribedText(response.data.text);
        Logger.debug('转录成功', {
          text: response.data.text,
          language: response.data.language,
          precision: response.data.precision
        });
      } else {
        Logger.error('语音转录失败', undefined, { message: response.message });
        setError(response.message || '语音转录失败');
      }
    } catch (err) {
      Logger.error('语音转录异常', err instanceof Error ? err : undefined);
      const errorMessage = err instanceof Error ? err.message : '语音转录失败';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [asrLanguage, asrUseInt8]);

  /**
   * 取消录音
   */
  const cancelRecording = useCallback(async () => {
    try {
      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current = null;
      }

      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      recordedChunksRef.current = [];
      setIsRecording(false);
      setIsProcessing(false);
      setError(null);
    } catch (err) {
      Logger.error('取消录音时出错', err instanceof Error ? err : undefined);
    }
  }, []);

  /**
   * 清除转录文本
   */
  const clearTranscribedText = useCallback(() => {
    setTranscribedText('');
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current !== undefined) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.disconnect();
          workletNodeRef.current.port.onmessage = null;
        } catch (err) {
          Logger.error('清理 worklet 时出错', err instanceof Error ? err : undefined);
        }
      }

      if (mediaStreamSourceRef.current) {
        try {
          mediaStreamSourceRef.current.disconnect();
        } catch (err) {
          Logger.error('清理 source 时出错', err instanceof Error ? err : undefined);
        }
      }

      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => track.stop());
        } catch (err) {
          Logger.error('清理音频流时出错', err instanceof Error ? err : undefined);
        }
      }

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (err) {
          Logger.error('清理 AudioContext 时出错', err instanceof Error ? err : undefined);
        }
      }

      recordedChunksRef.current = [];
    };
  }, []);

  return {
    isRecording,
    isProcessing,
    error,
    transcribedText,
    startRecording,
    stopRecording,
    cancelRecording,
    clearTranscribedText,
    clearError
  };
};
