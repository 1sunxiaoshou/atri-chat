import { useState, useEffect } from 'react';
import { AUDIO_CONFIG, STORAGE_KEYS } from '../utils/constants';

export interface GeneralSettings {
  audioVolume: number;
  audioCacheLimit: number;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings>({
    audioVolume: AUDIO_CONFIG.DEFAULT_VOLUME,
    audioCacheLimit: AUDIO_CONFIG.DEFAULT_CACHE_LIMIT
  });

  // 从本地存储加载设置
  useEffect(() => {
    const savedVolume = localStorage.getItem(STORAGE_KEYS.AUDIO_VOLUME);
    const savedCacheLimit = localStorage.getItem(STORAGE_KEYS.AUDIO_CACHE_LIMIT);
    
    setSettings({
      audioVolume: savedVolume ? Number(savedVolume) : AUDIO_CONFIG.DEFAULT_VOLUME,
      audioCacheLimit: savedCacheLimit ? Number(savedCacheLimit) : AUDIO_CONFIG.DEFAULT_CACHE_LIMIT
    });
  }, []);

  // 保存设置到本地存储
  const saveSettings = (newSettings: Partial<GeneralSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    Object.entries(updatedSettings).forEach(([key, value]) => {
      localStorage.setItem(key, value.toString());
    });
    
    setSettings(updatedSettings);
    return true;
  };

  // 重置设置为默认值
  const resetSettings = () => {
    const defaultSettings = {
      audioVolume: AUDIO_CONFIG.DEFAULT_VOLUME,
      audioCacheLimit: AUDIO_CONFIG.DEFAULT_CACHE_LIMIT
    };
    
    Object.entries(defaultSettings).forEach(([key, value]) => {
      localStorage.setItem(key, value.toString());
    });
    
    setSettings(defaultSettings);
  };

  return {
    settings,
    saveSettings,
    resetSettings
  };
};