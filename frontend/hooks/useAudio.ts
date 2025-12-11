import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { StreamTTSPlayer } from '../utils/streamTTSPlayer';

export const useAudio = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamPlayerRef = useRef<StreamTTSPlayer | null>(null);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      console.log('开始录音');
    } catch (error) {
      console.error('录音失败:', error);
      throw new Error('无法访问麦克风，请检查权限设置');
    }
  }, []);

  // 停止录音并返回音频数据
  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('录音器未初始化'));
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // 停止所有音轨
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        
        setIsRecording(false);
        console.log('录音结束，音频大小:', audioBlob.size);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('录音错误:', event);
        setIsRecording(false);
        reject(new Error('录音过程中发生错误'));
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  // 语音转文字
  const transcribeAudio = useCallback(async (audioBlob: Blob, language?: string) => {
    setIsProcessingAudio(true);
    try {
      const response = await api.transcribeAudio(audioBlob, language);
      if (response.code === 200) {
        console.log('语音转文字成功:', response.data.text);
        return response.data.text;
      } else {
        throw new Error(response.message || '语音识别失败');
      }
    } catch (error) {
      console.error('语音转文字失败:', error);
      throw error;
    } finally {
      setIsProcessingAudio(false);
    }
  }, []);

  // 播放TTS音频
  const playTTS = useCallback(async (text: string, messageId: string | number, language?: string) => {
    try {
      setPlayingMessageId(messageId);
      
      if (!streamPlayerRef.current) {
        streamPlayerRef.current = new StreamTTSPlayer();
      }

      const { stream, sampleRate, channels } = await api.synthesizeSpeechStream(text, language);
      
      await streamPlayerRef.current.playStream(stream, sampleRate, channels);
      console.log('TTS播放完成');
    } catch (error) {
      console.error('TTS播放失败:', error);
      throw error;
    } finally {
      setPlayingMessageId(null);
    }
  }, []);

  // 停止TTS播放
  const stopTTS = useCallback(() => {
    if (streamPlayerRef.current) {
      streamPlayerRef.current.stop();
    }
    setPlayingMessageId(null);
  }, []);

  // 清理资源
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamPlayerRef.current) {
      streamPlayerRef.current.stop();
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessingAudio,
    playingMessageId,
    startRecording,
    stopRecording,
    transcribeAudio,
    playTTS,
    stopTTS,
    cleanup
  };
};