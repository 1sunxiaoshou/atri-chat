import React, { useState } from 'react';
import { Bot, Menu, Settings } from 'lucide-react';
import { Character, Model, ModelParameters } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Select from '../ui/Select';
import { buildAvatarUrl } from '../../utils/url';

interface ChatHeaderProps {
  activeCharacter: Character | null;
  activeModel: Model | null;
  availableModels: Model[];
  vrmDisplayMode: 'normal' | 'vrm' | 'live2d';
  modelParameters: ModelParameters;
  onUpdateModel: (modelId: string) => void;
  onVrmDisplayModeChange: (mode: 'normal' | 'vrm' | 'live2d') => void;
  onModelParametersChange: (params: ModelParameters) => void;
  onOpenMobileSidebar?: () => void;
  onOpenRightSidebar?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeCharacter,
  activeModel,
  availableModels,
  vrmDisplayMode,
  onUpdateModel,
  onVrmDisplayModeChange,
  onOpenMobileSidebar,
  onOpenRightSidebar
}) => {
  const { t } = useLanguage();
  const [showVrmError, setShowVrmError] = useState(false);

  const modelOptions = availableModels.map(m => ({
    label: m.model_id,
    value: m.model_id,
    group: m.provider_id
  }));

  const handleDisplayModeChange = (mode: 'normal' | 'vrm' | 'live2d') => {
    if (mode === 'vrm' && !activeCharacter?.vrm_model_id) {
      setShowVrmError(true);
      setTimeout(() => setShowVrmError(false), 3000);
      return;
    }
    onVrmDisplayModeChange(mode);
  };

  return (
    <div className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 sticky top-0 transition-colors">
      {/* Mobile Menu Button */}
      <button
        onClick={onOpenMobileSidebar}
        className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 transition-colors mr-2"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Character Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-initial">
        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 overflow-hidden flex-shrink-0">
          {activeCharacter?.avatar ? (
            <img src={buildAvatarUrl(activeCharacter.avatar)} alt={activeCharacter.name} className="w-full h-full object-cover" />
          ) : (
            <Bot size={24} />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 truncate">
            {activeCharacter?.name || t('chat.selectCharacter')}
          </h2>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            {t('chat.online')}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Model Selector - Hidden on mobile */}
        <div className="hidden md:block w-56">
          <Select
            value={activeModel?.model_id || ''}
            onChange={onUpdateModel}
            options={modelOptions}
            placeholder="选择模型..."
          />
        </div>

        {/* Display Mode Toggle - Hidden on small mobile */}
        <div className="hidden sm:block relative bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center h-9 w-[180px] border border-gray-200 dark:border-gray-700">
          {/* Slider Background Animation */}
          <div
            className="absolute top-1 bottom-1 left-1 bg-white dark:bg-gray-700 rounded-md shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300 ease-out"
            style={{
              width: 'calc((100% - 8px) / 3)',
              transform: `translateX(${['normal', 'vrm', 'live2d'].indexOf(vrmDisplayMode) * 100}%)`
            }}
          />

          {/* Error Popup for VRM */}
          {showVrmError && (
            <div className="absolute top-12 right-0 bg-red-100 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-lg shadow-lg z-50 animate-fadeIn flex items-center gap-2 whitespace-nowrap">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              请先在角色设置中配置 VRM 模型
            </div>
          )}

          <div className="grid grid-cols-3 w-full h-full relative">
            {[
              { id: 'normal', label: '正常' },
              { id: 'vrm', label: 'VRM' },
              { id: 'live2d', label: 'Live2D' }
            ].map((mode) => {
              const isActive = vrmDisplayMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => handleDisplayModeChange(mode.id as any)}
                  className={`
                    relative z-10 flex items-center justify-center text-xs font-medium transition-colors duration-200 rounded-md
                    ${isActive ? 'text-black dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                  `}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenRightSidebar}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
          title="模型参数设置"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
