import React from 'react';
import { X } from 'lucide-react';
import { Model, ModelParameters } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Select from '../ui/Select';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: Model | null;
  availableModels: Model[];
  modelParameters: ModelParameters;
  onUpdateModel: (modelId: string) => void;
  onModelParametersChange: (params: ModelParameters) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  activeModel,
  availableModels,
  modelParameters,
  onUpdateModel,
  onModelParametersChange
}) => {
  const { t } = useLanguage();

  const modelOptions = availableModels.map(m => ({
    label: m.model_id,
    value: m.model_id,
    group: m.provider_id
  }));

  const handleChange = (key: keyof ModelParameters, value: any) => {
    onModelParametersChange({
      ...modelParameters,
      [key]: value
    });
  };

  const resetToDefaults = () => {
    onModelParametersChange({
      temperature: undefined,
      enable_thinking: undefined
    });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('chat.settings.title')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-140px)]">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('chat.settings.modelSelection')}
            </label>
            <Select
              value={activeModel?.model_id || ''}
              onChange={onUpdateModel}
              options={modelOptions}
              placeholder="选择模型..."
            />
          </div>

          {/* Enable Thinking */}
          <div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                  {t('chat.settings.enableThinking')}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('chat.settings.enableThinkingDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={modelParameters.enable_thinking ?? false}
                  onChange={(e) => handleChange('enable_thinking', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('chat.settings.temperature')}
              </label>
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {modelParameters.temperature?.toFixed(1) ?? '1.0'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={modelParameters.temperature ?? 1}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>{t('chat.settings.precise')}</span>
              <span>{t('chat.settings.creative')}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('chat.settings.temperatureDesc')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={resetToDefaults}
            className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('chat.settings.reset')}
          </button>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;