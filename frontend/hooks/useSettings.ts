import { useState, useEffect } from 'react';
import { AUDIO_CONFIG, STORAGE_KEYS } from '../utils/constants';

export interface GeneralSettings {
  audioVolume: number;
  audioCacheLimit: number;
  asrLanguage: string;
  asrUseInt8: boolean;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings>(() => {
    // 同步初始化，避免 UI 闪烁
    const savedVolume = localStorage.getItem(STORAGE_KEYS.AUDIO_VOLUME);
    const savedCacheLimit = localStorage.getItem(STORAGE_KEYS.AUDIO_CACHE_LIMIT);
    const savedAsrLanguage = localStorage.getItem(STORAGE_KEYS.ASR_LANGUAGE);
    const savedAsrUseInt8 = localStorage.getItem(STORAGE_KEYS.ASR_USE_INT8);

    return {
      audioVolume: savedVolume ? Number(savedVolume) : AUDIO_CONFIG.DEFAULT_VOLUME,
      audioCacheLimit: savedCacheLimit ? Number(savedCacheLimit) : AUDIO_CONFIG.DEFAULT_CACHE_LIMIT,
      asrLanguage: savedAsrLanguage || 'auto',
      asrUseInt8: savedAsrUseInt8 === 'true'
    };
  });

  // 监听并同步 localStorage 变化（处理多窗口、多组件同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const keys = Object.values(STORAGE_KEYS) as string[];
      if (e.key && keys.includes(e.key)) {
        const savedVolume = localStorage.getItem(STORAGE_KEYS.AUDIO_VOLUME);
        const savedCacheLimit = localStorage.getItem(STORAGE_KEYS.AUDIO_CACHE_LIMIT);
        const savedAsrLanguage = localStorage.getItem(STORAGE_KEYS.ASR_LANGUAGE);
        const savedAsrUseInt8 = localStorage.getItem(STORAGE_KEYS.ASR_USE_INT8);

        setSettings({
          audioVolume: savedVolume ? Number(savedVolume) : AUDIO_CONFIG.DEFAULT_VOLUME,
          audioCacheLimit: savedCacheLimit ? Number(savedCacheLimit) : AUDIO_CONFIG.DEFAULT_CACHE_LIMIT,
          asrLanguage: savedAsrLanguage || 'auto',
          asrUseInt8: savedAsrUseInt8 === 'true'
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 保存设置到本地存储
  const saveSettings = (newSettings: Partial<GeneralSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };

    // 映射到正确的 localStorage key
    const keyMapping: Record<keyof GeneralSettings, string> = {
      audioVolume: STORAGE_KEYS.AUDIO_VOLUME,
      audioCacheLimit: STORAGE_KEYS.AUDIO_CACHE_LIMIT,
      asrLanguage: STORAGE_KEYS.ASR_LANGUAGE,
      asrUseInt8: STORAGE_KEYS.ASR_USE_INT8
    };

    Object.entries(updatedSettings).forEach(([key, value]) => {
      const storageKey = keyMapping[key as keyof GeneralSettings];
      localStorage.setItem(storageKey, value.toString());
    });

    setSettings(updatedSettings);
    return true;
  };

  // 重置设置为默认值
  const resetSettings = () => {
    const defaultSettings = {
      audioVolume: AUDIO_CONFIG.DEFAULT_VOLUME,
      audioCacheLimit: AUDIO_CONFIG.DEFAULT_CACHE_LIMIT,
      asrLanguage: 'auto',
      asrUseInt8: false
    };

    // 映射到正确的 localStorage key
    const keyMapping: Record<keyof GeneralSettings, string> = {
      audioVolume: STORAGE_KEYS.AUDIO_VOLUME,
      audioCacheLimit: STORAGE_KEYS.AUDIO_CACHE_LIMIT,
      asrLanguage: STORAGE_KEYS.ASR_LANGUAGE,
      asrUseInt8: STORAGE_KEYS.ASR_USE_INT8
    };

    Object.entries(defaultSettings).forEach(([key, value]) => {
      const storageKey = keyMapping[key as keyof GeneralSettings];
      localStorage.setItem(storageKey, value.toString());
    });

    setSettings(defaultSettings);
  };

  return {
    settings,
    saveSettings,
    resetSettings
  };
};