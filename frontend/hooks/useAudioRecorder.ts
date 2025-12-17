import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api/index';
import { HTTP_STATUS } from '../utils/constants';
import { Logger } from '../utils/logger';

/**
 * 音频录制 Hook - 封装录音开始、停止、转录逻辑
 */
export const useAudioRecorder = () => {
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>('');

  // MediaRecorder 实例
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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

      // 创建 MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // 监听数据可用事件
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // 监听错误事件
      recorder.onerror = (e) => {
        Logger.error('MediaRecorder 错误', new Error(e.toString()));
        setError('录音过程中发生错误');
        setIsRecording(false);
        
        // 清理资源
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      // 监听停止事件
      recorder.onstop = async () => {
        // 停止所有音频轨道
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // 检查是否有音频数据
        if (audioChunksRef.current.length === 0) {
          setError('没有录制到音频数据');
          setIsRecording(false);
          setIsProcessing(false);
          mediaRecorderRef.current = null;
          return;
        }

        // 创建音频 Blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        audioChunksRef.current = [];

        setIsRecording(false);
        setIsProcessing(true);

        try {
          // 调用转录 API
          const response = await api.transcribeAudio(audioBlob);

          if (response.code === HTTP_STATUS.OK) {
            setTranscribedText(response.data.text);
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
          mediaRecorderRef.current = null;
        }
      };

      // 开始录音
      recorder.start();
      setIsRecording(true);

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
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      // 检查 MediaRecorder 的实际状态，而不仅仅依赖 React 状态
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          Logger.error('停止录音失败', err instanceof Error ? err : undefined);
          // 强制清理状态
          setIsRecording(false);
          setError('停止录音失败');
          
          // 清理资源
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      } else {
        // 如果状态不对，强制重置
        setIsRecording(false);
      }
    } else {
      setIsRecording(false);
    }
  }, [isRecording]);

  /**
   * 取消录音
   */
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        // 移除 onstop 事件处理器，避免触发转录
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      } catch (err) {
        Logger.error('取消录音时出错', err instanceof Error ? err : undefined);
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setIsProcessing(false);
    setError(null);
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
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.onerror = null;
          mediaRecorderRef.current.ondataavailable = null;
          
          if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          mediaRecorderRef.current = null;
        } catch (err) {
          Logger.error('清理 MediaRecorder 时出错', err instanceof Error ? err : undefined);
        }
      }

      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        } catch (err) {
          Logger.error('清理音频流时出错', err instanceof Error ? err : undefined);
        }
      }

      audioChunksRef.current = [];
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
