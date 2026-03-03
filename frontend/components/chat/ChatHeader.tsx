import React, { useState } from 'react';
import { Bot, Menu, Settings, Circle, PanelLeftOpen } from 'lucide-react';
import { Character, Model, ModelParameters } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Select, Button, RadioGroup } from '../ui';
import { buildAvatarUrl } from '../../utils/url';
import { cn } from '../../utils/cn';

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
  onShowSidebar?: () => void;
  isSidebarHidden?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeCharacter,
  activeModel,
  availableModels,
  vrmDisplayMode,
  onUpdateModel,
  onVrmDisplayModeChange,
  onOpenMobileSidebar,
  onOpenRightSidebar,
  onShowSidebar,
  isSidebarHidden = false
}) => {
  const { t } = useLanguage();
  const [showVrmError, setShowVrmError] = useState(false);

  const modelOptions = availableModels.map(m => ({
    label: m.model_id,
    value: m.id, // 使用 UUID 作为 value
    group: m.provider_id
  }));

  const handleDisplayModeChange = (mode: 'normal' | 'vrm' | 'live2d') => {
    if (mode === 'vrm' && !activeCharacter?.avatar_id) {
      setShowVrmError(true);
      setTimeout(() => setShowVrmError(false), 3000);
      return;
    }
    onVrmDisplayModeChange(mode);
  };

  return (
    <header className="h-16 md:h-18 border-b border-border flex items-center justify-between pl-2 pr-4 md:pl-3 md:pr-6 bg-background/80 backdrop-blur-xl z-40 sticky top-0 transition-all duration-300">
      <div className="flex items-center min-w-0">
        {/* 移动端菜单按钮 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileSidebar}
          className="lg:hidden h-10 w-10 text-muted-foreground mr-1"
        >
          <Menu size={20} />
        </Button>

        {/* 桌面端显示按钮 - 优化位置，使用负外边距贴近边缘 */}
        <div
          className={cn(
            "hidden lg:flex items-center transition-all duration-300 ease-in-out overflow-hidden",
            // 隐藏时宽度展开，使用 -ml-1 让它更贴近边缘
            isSidebarHidden ? "w-10 opacity-100 -ml-1 mr-1" : "w-0 opacity-0 m-0"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onShowSidebar}
            className="h-9 w-9 gap-0 text-muted-foreground hover:text-primary hover:bg-transparent rounded-lg [&_svg]:size-5"
          >
            <PanelLeftOpen size={20} />
          </Button>
        </div>

        {/* 角色信息：增加微小的间距补偿，确保视觉对齐 */}
        <div
          className={cn(
            "flex items-center gap-3 min-w-0 transition-transform duration-300",
            !isSidebarHidden && "lg:ml-2" // 侧边栏显示时，给头像留出一点呼吸空间
          )}
        >
          <div className="relative shrink-0">
            <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary ring-2 ring-background shadow-md overflow-hidden transition-transform duration-300 group-hover:scale-105">
              {activeCharacter?.portrait_url ? (
                <img src={buildAvatarUrl(activeCharacter.portrait_url)} alt={activeCharacter.name} className="w-full h-full object-cover" />
              ) : activeCharacter?.avatar?.thumbnail_url ? (
                <img src={buildAvatarUrl(activeCharacter.avatar.thumbnail_url)} alt={activeCharacter.name} className="w-full h-full object-cover" />
              ) : (
                <Bot size={24} />
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full shadow-sm animate-pulse" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <h2 className="font-bold text-foreground truncate text-sm md:text-base leading-tight">
              {activeCharacter?.name || t('chat.selectCharacter')}
            </h2>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-tight opacity-70">
              {activeModel?.model_id || 'AI Assistant'}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Model Selector - Hidden on mobile */}
        <div className="hidden md:block w-48 lg:w-64">
          <Select
            value={activeModel?.id || ''}
            onChange={onUpdateModel}
            options={modelOptions}
            placeholder={t('chat.selectModel')}
            className="h-9 md:h-10"
          />
        </div>

        {/* Display Mode Toggle - Hidden on small mobile */}
        <div className="hidden sm:block relative">
          {/* Error Popup for VRM */}
          {showVrmError && (
            <div className="absolute top-14 right-0 bg-destructive text-destructive-foreground text-[10px] md:text-xs px-4 py-2 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2 whitespace-nowrap border border-destructive/20 font-bold uppercase tracking-wider">
              <Circle size={8} className="fill-current animate-pulse" />
              {t('chat.configureVRMFirst')}
            </div>
          )}

          <RadioGroup
            value={vrmDisplayMode}
            onChange={(mode) => handleDisplayModeChange(mode as 'normal' | 'vrm' | 'live2d')}
            options={[
              { label: t('chat.normal'), value: 'normal' },
              { label: 'VRM', value: 'vrm' },
              { label: 'Live2D', value: 'live2d' }
            ]}
            variant="segmented"
            className="w-[180px] lg:w-[220px]"
          />
        </div>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenRightSidebar}
          className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
          title={t('chat.modelSettings')}
        >
          <Settings size={20} />
        </Button>
      </div>
    </header>
  );
};

export default ChatHeader;
