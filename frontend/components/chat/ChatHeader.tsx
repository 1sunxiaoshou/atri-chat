import React, { useState } from 'react';
import { Bot, Menu, Settings, Circle, PanelLeftOpen } from 'lucide-react';
import { Character, Model, ModelParameters } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Select, Button } from '../ui';
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
              {activeCharacter?.avatar ? (
                <img src={buildAvatarUrl(activeCharacter.avatar)} alt={activeCharacter.name} className="w-full h-full object-cover" />
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
            value={activeModel?.model_id || ''}
            onChange={onUpdateModel}
            options={modelOptions}
            placeholder="选择模型..."
            className="h-9 md:h-10"
          />
        </div>

        {/* Display Mode Toggle - Hidden on small mobile */}
        <div className="hidden sm:flex relative bg-muted p-1 rounded-xl items-center h-10 w-[180px] lg:w-[220px] shadow-inner ring-1 ring-border/50">
          {/* Slider Background Animation */}
          <div
            className="absolute top-1 bottom-1 left-1 bg-background rounded-lg shadow-sm transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)"
            style={{
              width: 'calc((100% - 8px) / 3)',
              transform: `translateX(${['normal', 'vrm', 'live2d'].indexOf(vrmDisplayMode) * 100}%)`
            }}
          />

          {/* Error Popup for VRM */}
          {showVrmError && (
            <div className="absolute top-14 right-0 bg-destructive text-destructive-foreground text-[10px] md:text-xs px-4 py-2 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2 whitespace-nowrap border border-destructive/20 font-bold uppercase tracking-wider">
              <Circle size={8} className="fill-current animate-pulse" />
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
                  className={cn(
                    "relative z-10 flex items-center justify-center text-[10px] lg:text-xs font-bold transition-all duration-300 rounded-lg tracking-wider",
                    isActive ? "text-primary scale-105" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenRightSidebar}
          className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
          title="模型参数设置"
        >
          <Settings size={20} />
        </Button>
      </div>
    </header>
  );
};

export default ChatHeader;
