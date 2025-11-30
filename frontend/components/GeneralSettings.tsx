import React, { useState, useEffect } from 'react';
import { Volume2, Database, Save } from 'lucide-react';

interface GeneralSettingsProps {
  onSettingsChange?: (settings: GeneralSettingsData) => void;
}

export interface GeneralSettingsData {
  audioVolume: number;
  audioCacheLimit: number;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onSettingsChange }) => {
  const [audioVolume, setAudioVolume] = useState<number>(100);
  const [audioCacheLimit, setAudioCacheLimit] = useState<number>(50);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // 从 localStorage 加载设置
  useEffect(() => {
    const savedVolume = localStorage.getItem('audioVolume');
    const savedCacheLimit = localStorage.getItem('audioCacheLimit');
    
    if (savedVolume) setAudioVolume(Number(savedVolume));
    if (savedCacheLimit) setAudioCacheLimit(Number(savedCacheLimit));
  }, []);

  const handleSave = () => {
    localStorage.setItem('audioVolume', audioVolume.toString());
    localStorage.setItem('audioCacheLimit', audioCacheLimit.toString());
    
    if (onSettingsChange) {
      onSettingsChange({ audioVolume, audioCacheLimit });
    }

    setSaveMessage('设置已保存');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="space-y-6">
        {/* 音频音量控制 */}
        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Volume2 size={20} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white mb-1">音频音量</h3>
              <p className="text-sm text-gray-400">控制 TTS 语音播放的音量大小</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={audioVolume}
                onChange={(e) => setAudioVolume(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="w-16 text-right">
                <span className="text-white font-medium">{audioVolume}%</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>静音</span>
              <span>最大</span>
            </div>
          </div>
        </div>

        {/* 音频缓存上限 */}
        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Database size={20} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white mb-1">音频缓存上限</h3>
              <p className="text-sm text-gray-400">设置最多缓存多少条音频，超出后将删除最早的缓存</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="10"
                max="200"
                step="10"
                value={audioCacheLimit}
                onChange={(e) => setAudioCacheLimit(Number(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <div className="text-gray-400 text-sm">条</div>
            </div>
            <p className="text-xs text-gray-500">
              建议值：10-100 条。缓存过多可能占用较多内存。
            </p>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center justify-end gap-3">
          {saveMessage && (
            <span className="text-green-400 text-sm animate-in fade-in slide-in-from-right-2">
              {saveMessage}
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
          >
            <Save size={18} />
            <span>保存设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
