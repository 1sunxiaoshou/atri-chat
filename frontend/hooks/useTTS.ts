import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamTTSPlayer } from '../utils/streamTTSPlayer';
import { api } from '../services/api/index';
import { AUDIO_CONFIG, UI_TIMING, STORAGE_KEYS } from '../utils/constants';
import { Logger } from '../utils/logger';

/**
 * TTS Hook - 封装 TTS 播放、停止逻辑
 * 
 * 需求: 7.1, 7.2, 7.3, 9.4
 * - 7.1: 使用 useEffect 正确管理副作用
 * - 7.2: 使用 useCallback 包装返回的函数
 * - 7.3: 在依赖数组中正确声明所有依赖
 * - 9.4: 将 TTS 功能提取为独立的功能模块
 */
export const useTTS = () => {
  // TTS 播放状态
  const [playingMessageId, setPlayingMessageId] = useState<string | number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TTS 播放器实例
  const playerRef = useRef<StreamTTSPlayer | null>(null);

  /**
   * 播放 TTS
   */
  const playTTS = useCallback(async (messageId: string | number, text: string) => {
    try {
      setError(null);

      // 如果正在播放同一条消息，则停止播放
      if (playingMessageId === messageId) {
        if (playerRef.current) {
          playerRef.current.onStop();
        }
        setPlayingMessageId(null);
        setIsPlaying(false);
        return;
      }

      // 如果正在播放其他消息，先停止
      if (playerRef.current && playingMessageId !== null) {
        await playerRef.current.dispose();
        playerRef.current = null;
      }

      setPlayingMessageId(messageId);
      setIsPlaying(true);

      // 获取音量设置
      const volumeSetting = localStorage.getItem(STORAGE_KEYS.AUDIO_VOLUME);
      const volume = volumeSetting ? Number(volumeSetting) / AUDIO_CONFIG.VOLUME_SCALE : 1.0;

      // 创建新的播放器实例
      if (!playerRef.current) {
        playerRef.current = new StreamTTSPlayer(volume, () => {
          setPlayingMessageId(null);
          setIsPlaying(false);
        });
      }

      // 开始播放
      await playerRef.current.onPlay(text, async () => {
        return await api.synthesizeSpeechStream(text);
      });

    } catch (err) {
      Logger.error('TTS 播放失败', err instanceof Error ? err : undefined);
      const errorMessage = err instanceof Error ? err.message : 'TTS 播放失败';
      setError(errorMessage);
      setPlayingMessageId(null);
      setIsPlaying(false);

      // 清理播放器
      if (playerRef.current) {
        await playerRef.current.dispose();
        playerRef.current = null;
      }

      // 清除错误
      setTimeout(() => setError(null), UI_TIMING.ERROR_CLEAR_DELAY);
    }
  }, [playingMessageId]);

  /**
   * 停止 TTS 播放
   */
  const stopTTS = useCallback(async () => {
    if (playerRef.current) {
      playerRef.current.onStop();
      await playerRef.current.dispose();
      playerRef.current = null;
    }
    setPlayingMessageId(null);
    setIsPlaying(false);
  }, []);

  /**
   * 更新音量
   */
  const setVolume = useCallback((volume: number) => {
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
    // 保存到 localStorage
    localStorage.setItem(STORAGE_KEYS.AUDIO_VOLUME, String(volume * AUDIO_CONFIG.VOLUME_SCALE));
  }, []);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.onStop();
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

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
