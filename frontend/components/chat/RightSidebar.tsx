import React from 'react';
import { X, RotateCcw, Brain, Thermometer } from 'lucide-react';
import { Model, ModelParameters } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Select, Button } from '../ui';
import { cn } from '../../utils/cn';

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
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-all duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/5">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight">{t('chat.settings.title')}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1">Parameters Configuration</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 rounded-xl hover:bg-muted transition-colors"
          >
            <X size={20} className="text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto h-[calc(100%-150px)] custom-scrollbar">
          {/* Model Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t('chat.settings.modelSelection')}
            </label>
            <Select
              value={activeModel?.model_id || ''}
              onChange={onUpdateModel}
              options={modelOptions}
              placeholder="选择模型..."
              className="h-11"
            />
          </div>

          <div className="h-px bg-border/50" />

          {/* Enable Thinking */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50 group hover:border-primary/30 transition-all duration-300">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Brain size={16} className="text-primary" />
                  <label className="text-sm font-bold text-foreground">
                    {t('chat.settings.enableThinking')}
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
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
                <div className="w-11 h-6 bg-muted border border-border rounded-full peer peer-checked:bg-primary peer-checked:border-primary transition-all duration-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full after:shadow-sm"></div>
              </label>
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Thermometer size={14} className="text-primary" />
                {t('chat.settings.temperature')}
              </label>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                {modelParameters.temperature?.toFixed(1) ?? '1.0'}
              </span>
            </div>

            <div className="px-1">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={modelParameters.temperature ?? 1}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
              />
              <div className="flex justify-between mt-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{t('chat.settings.precise')}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{t('chat.settings.creative')}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/30">
              {t('chat.settings.temperatureDesc')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border bg-card">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="w-full h-11 gap-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all duration-300"
          >
            <RotateCcw size={14} />
            {t('chat.settings.reset')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default RightSidebar;
