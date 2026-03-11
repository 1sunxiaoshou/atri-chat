import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api/index';
import { AUDIO_CONFIG, UI_TIMING } from '../utils/constants';
import { Logger } from '../utils/logger';
import { useAudioStore } from '../store/useAudioStore';
import { audioCache } from '../utils/audioCache';

/**
 * TTS Hook - 封装原生 HTMLAudioElement TTS 播放、停止逻辑 (非流式、稳定版)
 */
export const useTTS = () => {
  // TTS 播放状态
  const [playingMessageId, setPlayingMessageId] = useState<string | number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 原生音频实例与对象 URL
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // 保存 error 清除 timeout id，防止组件卸载后仍触发 setState
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 从 Zustand Store 读取音量
  const volume = useAudioStore((state) => state.volume);

  /**
   * 清理当前正在播放的音频资源
   */
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  /**
   * 播放 TTS
   */
  const playTTS = useCallback(async (messageId: string | number, text: string, characterId?: string) => {
    try {
      setError(null);

      // 如果正在播放同一条消息，则停止播放
      if (playingMessageId === messageId) {
        cleanupAudio();
        setPlayingMessageId(null);
        setIsPlaying(false);
        return;
      }

      // 如果正在播放其他消息，先清理掉
      cleanupAudio();
      
      setPlayingMessageId(messageId);
      setIsPlaying(true);

      // 1. 尝试从缓存中获取完整音频 Blob
      let audioBlob: Blob | null = null;
      const cached = audioCache.get(text);
      if (cached) {
        audioBlob = cached.blob;
      } else {
        // 2. 发起 API 请求，获取非流式完整 WAV 文件
        audioBlob = await api.synthesizeSpeech(text, characterId);
        audioCache.set(text, audioBlob);
      }

      // 3. 将 Blob 转换为 Object URL 供原生 Audio 播放
      const url = URL.createObjectURL(audioBlob);
      audioUrlRef.current = url;

      // 4. 创建 Audio 对象并配置
      const audio = new Audio(url);
      const normalizedVolume = Math.max(0, Math.min(1, volume / AUDIO_CONFIG.VOLUME_SCALE));
      audio.volume = normalizedVolume;
      audioRef.current = audio;

      // 5. 绑定播放结束事件
      audio.onended = () => {
        setPlayingMessageId(null);
        setIsPlaying(false);
        cleanupAudio();
      };
      
      audio.onerror = () => {
        throw new Error('音频解码或播放失败');
      };

      // 6. 执行播放
      await audio.play();

    } catch (err) {
      Logger.error('TTS 播放失败', err instanceof Error ? err : undefined);
      const errorMessage = err instanceof Error ? err.message : 'TTS 播放失败';
      setError(errorMessage);
      setPlayingMessageId(null);
      setIsPlaying(false);
      
      cleanupAudio();

      if (errorTimeoutRef.current !== undefined) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => setError(null), UI_TIMING.ERROR_CLEAR_DELAY);
    }
  }, [playingMessageId, volume, cleanupAudio]);

  /**
   * 停止 TTS 播放
   */
  const stopTTS = useCallback(async () => {
    cleanupAudio();
    setPlayingMessageId(null);
    setIsPlaying(false);
  }, [cleanupAudio]);

  /**
   * 更新音量（实时生效）
   */
  const setVolume = useCallback((vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, vol / AUDIO_CONFIG.VOLUME_SCALE));
    }
  }, []);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current !== undefined) {
        clearTimeout(errorTimeoutRef.current);
      }
      cleanupAudio();
    };
  }, [cleanupAudio]);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    playingMessageId,
    isPlaying,
    error,
    playTTS,
    stopTTS,
    setVolume,
    clearError
  };
};
