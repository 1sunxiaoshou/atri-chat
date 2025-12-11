import { useState, useEffect } from 'react';

export interface GeneralSettings {
  audioVolume: number;
  audioCacheLimit: number;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings>({
    audioVolume: 100,
    audioCacheLimit: 50
  });

  // 从本地存储加载设置
  useEffect(() => {
    const savedVolume = localStorage.getItem('audioVolume');
    const savedCacheLimit = localStorage.getItem('audioCacheLimit');
    
    setSettings({
      audioVolume: savedVolume ? Number(savedVolume) : 100,
      audioCacheLimit: savedCacheLimit ? Number(savedCacheLimit) : 50
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
      audioVolume: 100,
      audioCacheLimit: 50
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