import React, { useState, useRef, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { ModelParameters, Model } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ModelConfigPopoverProps {
  parameters: ModelParameters;
  onParametersChange: (params: ModelParameters) => void;
  model?: Model;
}

const ModelConfigPopover: React.FC<ModelConfigPopoverProps> = ({
  parameters,
  onParametersChange,
  model: _model
}) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleChange = (key: keyof ModelParameters, value: any) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };

  const resetToDefaults = () => {
    onParametersChange({
      temperature: undefined,
      max_tokens: undefined,
      top_p: undefined
    });
  };

  const texts = {
    zh: {
      title: '模型参数',
      temperature: '温度 (Temperature)',
      default: '默认',
      precise: '精确',
      creative: '创造',
      maxTokens: '最大长度 (Max Tokens)',
      maxTokensDesc: '限制回复的最大长度',
      topP: 'Top P',
      topPDesc: '控制采样的多样性',
      reset: '重置为默认值',
      tooltip: '模型参数配置'
    },
    en: {
      title: 'Model Parameters',
      temperature: 'Temperature',
      default: 'Default',
      precise: 'Precise',
      creative: 'Creative',
      maxTokens: 'Max Tokens',
      maxTokensDesc: 'Limit maximum response length',
      topP: 'Top P',
      topPDesc: 'Control sampling diversity',
      reset: 'Reset to Defaults',
      tooltip: 'Model Parameter Configuration'
    }
  };

  const t = texts[language];

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
        title={t.tooltip}
      >
        <Settings size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t.title}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.temperature}
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {parameters.temperature ?? t.default}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={parameters.temperature ?? 1}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>{t.precise}</span>
                <span>{t.creative}</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.maxTokens}
                </label>
                <input
                  type="number"
                  value={parameters.max_tokens ?? ''}
                  onChange={(e) => handleChange('max_tokens', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder={t.default}
                  className="w-20 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.maxTokensDesc}
              </p>
            </div>

            {/* Top P */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.topP}
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {parameters.top_p ?? t.default}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={parameters.top_p ?? 1}
                onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.topPDesc}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={resetToDefaults}
              className="w-full py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {t.reset}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelConfigPopover;
