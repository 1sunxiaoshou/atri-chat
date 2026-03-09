import React, { useState, useMemo, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Model, ModelParameters, ModelParameterSchemaResponse } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui';
import { cn } from '../../utils/cn';
import HierarchicalSelector, { HierarchicalItem } from '../ui/HierarchicalSelector';
import ParameterField from './ParameterField';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: Model | null;
  modelParameters: ModelParameters;
  onUpdateModel: (modelId: string) => void;
  onModelParametersChange: (params: ModelParameters) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  activeModel,
  modelParameters,
  onUpdateModel,
  onModelParametersChange
}) => {
  const { t } = useLanguage();
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [parameterSchema, setParameterSchema] = useState<ModelParameterSchemaResponse | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // 当模型选择器打开时，加载可用模型列表
  useEffect(() => {
    if (isModelSelectorOpen && availableModels.length === 0) {
      loadAvailableModels();
    }
  }, [isModelSelectorOpen]);

  const loadAvailableModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await fetch('/api/v1/models?enabled_only=true');
      const result = await response.json();
      if (result.code === 200) {
        setAvailableModels(result.data);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // 获取模型参数 schema
  useEffect(() => {
    if (!activeModel?.id) {
      setParameterSchema(null);
      return;
    }

    setIsLoadingSchema(true);
    fetch(`/api/v1/models/${activeModel.id}/parameter-schema`)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch parameter schema');
        return response.json();
      })
      .then(result => {
        setParameterSchema(result.data);
        setIsLoadingSchema(false);
      })
      .catch(error => {
        console.error('Error fetching parameter schema:', error);
        setIsLoadingSchema(false);
      });
  }, [activeModel?.id]);

  // 转换模型列表为 HierarchicalItem 格式
  const hierarchicalModels = useMemo<HierarchicalItem[]>(() => {
    return availableModels.map(model => ({
      id: model.id,
      label: model.model_id,
      category: model.provider_id,
      tags: model.capabilities
    }));
  }, [availableModels]);

  const handleModelSelect = (item: HierarchicalItem) => {
    // 找到完整的模型对象
    const selectedModel = availableModels.find(m => m.id === item.id);
    if (selectedModel) {
      // 传递完整的模型信息（id, model_id, provider_id）
      onUpdateModel(JSON.stringify({
        id: selectedModel.id,
        model_id: selectedModel.model_id,
        provider_id: selectedModel.provider_id
      }));
    }
    setIsModelSelectorOpen(false);
  };

  const handleParameterChange = (key: string, value: any) => {
    onModelParametersChange({
      ...modelParameters,
      [key]: value
    });
  };

  const resetToDefaults = () => {
    onModelParametersChange({});
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
          <div className="space-y-2">
            <label className="text-sm text-foreground">
              {t('chat.settings.modelSelection')}
            </label>

            <Button
              variant="outline"
              onClick={() => setIsModelSelectorOpen(true)}
              className="w-full h-11 px-4 justify-start bg-muted/30 border-border/50 rounded-xl hover:bg-muted/50 hover:border-primary/30"
            >
              {activeModel ? (
                <span className="truncate">
                  {activeModel.provider_id} / {activeModel.model_id}
                </span>
              ) : (
                <span>{t('chat.settings.selectModel')}</span>
              )}
            </Button>
          </div>

          <div className="h-px bg-border/50" />

          {/* Dynamic Parameters */}
          {isLoadingSchema ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {t('chat.settings.loadingSchema')}
            </div>
          ) : parameterSchema ? (
            <div className="space-y-4">
              {/* Provider Parameters (思考类参数) - 显示在最前面 */}
              {Object.entries(parameterSchema.provider_parameters).map(([key, schema]) => (
                <ParameterField
                  key={key}
                  name={key}
                  schema={schema}
                  value={modelParameters[key]}
                  onChange={handleParameterChange}
                />
              ))}

              {/* 分隔线（如果有供应商参数） */}
              {Object.keys(parameterSchema.provider_parameters).length > 0 && (
                <div className="h-px bg-border/50" />
              )}

              {/* Common Parameters (通用参数) */}
              {Object.entries(parameterSchema.common_parameters).map(([key, schema]) => (
                <ParameterField
                  key={key}
                  name={key}
                  schema={schema}
                  value={modelParameters[key]}
                  onChange={handleParameterChange}
                />
              ))}
            </div>
          ) : null}
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

      {/* Model Selector Modal */}
      <HierarchicalSelector
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        items={hierarchicalModels}
        selectedId={activeModel?.id}
        onSelect={handleModelSelect}
        title={t('chat.settings.selectModel')}
        placeholder={t('chat.settings.searchModel')}
      />
    </>
  );
};

export default RightSidebar;
