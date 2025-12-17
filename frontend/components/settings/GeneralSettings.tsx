
import React from 'react';
import { Volume2, Database, Save, Moon, Sun, Monitor } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../hooks/useSettings';
import { Button, Select } from '../ui';
import { SUCCESS_MESSAGES } from '../../utils/constants';

interface GeneralSettingsProps {
  onSettingsChange?: (settings: { audioVolume: number; audioCacheLimit: number }) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onSettingsChange }) => {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { settings, saveSettings } = useSettings();
  const [saveMessage, setSaveMessage] = React.useState<string>('');

  const handleVolumeChange = (volume: number) => {
    saveSettings({ audioVolume: volume });
    if (onSettingsChange) {
      onSettingsChange({ ...settings, audioVolume: volume });
    }
  };

  const handleCacheLimitChange = (limit: number) => {
    saveSettings({ audioCacheLimit: limit });
    if (onSettingsChange) {
      onSettingsChange({ ...settings, audioCacheLimit: limit });
    }
  };

  const handleSave = () => {
    setSaveMessage(SUCCESS_MESSAGES.SAVE_SUCCESS);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="space-y-6">
        
        {/* Appearance & Language */}
        <div className="bg-gray-100 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
           <div className="flex items-start gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Monitor size={20} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {language === 'zh' ? '界面设置' : 'Interface Settings'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'zh' ? '自定义外观和语言偏好' : 'Customize appearance and language preferences'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'zh' ? '主题模式' : 'Theme Mode'}
              </label>
              <div className="flex p-1 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                {[
                  { id: 'light', icon: Sun, label: language === 'zh' ? '亮色' : 'Light' },
                  { id: 'dark', icon: Moon, label: language === 'zh' ? '暗色' : 'Dark' },
                  { id: 'system', icon: Monitor, label: language === 'zh' ? '系统' : 'System' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                      theme === item.id 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'zh' ? '语言' : 'Language'}
              </label>
              <Select 
                value={language}
                onChange={(val) => setLanguage(val as any)}
                options={[
                  { label: 'English', value: 'en', icon: <span className="text-lg">🇺🇸</span> },
                  { label: '简体中文', value: 'zh', icon: <span className="text-lg">🇨🇳</span> }
                ]}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Audio Volume */}
        <div className="bg-gray-100 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Volume2 size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {language === 'zh' ? '音频音量' : 'Audio Volume'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'zh' ? '控制 TTS 语音播放的音量大小' : 'Control TTS voice playback volume'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.audioVolume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="w-16 text-right">
                <span className="text-gray-900 dark:text-white font-medium">{settings.audioVolume}%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500">
              <span>{language === 'zh' ? '静音' : 'Mute'}</span>
              <span>{language === 'zh' ? '最大' : 'Max'}</span>
            </div>
          </div>
        </div>

        {/* Audio Cache */}
        <div className="bg-gray-100 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Database size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {language === 'zh' ? '音频缓存上限' : 'Audio Cache Limit'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'zh' ? '设置最多缓存多少条音频，超出后将删除最早的缓存' : 'Set maximum cached audio items, oldest will be removed when exceeded'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="10"
                max="200"
                step="10"
                value={settings.audioCacheLimit}
                onChange={(e) => handleCacheLimitChange(Number(e.target.value))}
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                {language === 'zh' ? '条' : 'items'}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {language === 'zh' ? '建议值：10-100 条。缓存过多可能占用较多内存。' : 'Recommended: 10-100 items. Too many may consume more memory.'}
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3">
          {saveMessage && (
            <span className="text-green-600 dark:text-green-400 text-sm animate-in fade-in slide-in-from-right-2">
              {saveMessage}
            </span>
          )}
          <Button
            onClick={handleSave}
            icon={<Save />}
            variant="primary"
            size="lg"
          >
            {language === 'zh' ? '保存设置' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
