import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AUDIO_CONFIG } from '../utils/constants';

interface AudioState {
  volume: number;        // 0–100
  asrLanguage: string;   // 'auto' | 'zh' | 'en' | 'ja' | 'ko' | 'yue'
  asrUseInt8: boolean;
  autoPlay: boolean;     // AI 回复后自动播放 TTS
  audioCacheLimit: number;
}

interface AudioStore extends AudioState {
  setVolume: (v: number) => void;
  setAsrLanguage: (lang: string) => void;
  setAsrUseInt8: (v: boolean) => void;
  setAutoPlay: (v: boolean) => void;
  setAudioCacheLimit: (v: number) => void;
  resetSettings: () => void;
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      // 默认值
      volume: AUDIO_CONFIG.DEFAULT_VOLUME,
      asrLanguage: 'auto',
      asrUseInt8: false,
      autoPlay: false,
      audioCacheLimit: AUDIO_CONFIG.DEFAULT_CACHE_LIMIT,

      setVolume: (v) => set({ volume: v }),
      setAsrLanguage: (lang) => set({ asrLanguage: lang }),
      setAsrUseInt8: (v) => set({ asrUseInt8: v }),
      setAutoPlay: (v) => set({ autoPlay: v }),
      setAudioCacheLimit: (v) => set({ audioCacheLimit: v }),
      resetSettings: () => set({
        volume: AUDIO_CONFIG.DEFAULT_VOLUME,
        asrLanguage: 'auto',
        asrUseInt8: false,
        autoPlay: false,
        audioCacheLimit: AUDIO_CONFIG.DEFAULT_CACHE_LIMIT,
      }),
    }),
    {
      name: 'audio-settings',
      // 仅持久化数据字段，排除函数
      partialize: (state) => ({
        volume: state.volume,
        asrLanguage: state.asrLanguage,
        asrUseInt8: state.asrUseInt8,
        autoPlay: state.autoPlay,
        audioCacheLimit: state.audioCacheLimit,
      }),
    }
  )
);
