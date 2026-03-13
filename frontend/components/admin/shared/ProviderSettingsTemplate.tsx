import React, { useState, useEffect } from 'react';
import { Save, Activity, Loader2 } from 'lucide-react';
import Toast, { ToastMessage } from '../../ui/Toast';
import { extractConfigValues } from '../../../utils/helpers';
import { Button, Select, Input, Card, CardContent, RadioGroup } from '../../ui';
import { cn } from '../../../utils/cn';
import { useLanguage } from '../../../contexts/LanguageContext';

interface ConfigField {
  type: 'string' | 'password' | 'number' | 'select' | 'file' | 'boolean';
  label: string;
  description: string;
  default: any;
  required: boolean;
  placeholder?: string;
  sensitive?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  value?: any;
  level?: string; // 用于兼容 Voice 模块的 'provider' 级别过滤
}

interface Provider {
  id: string;
  name: string;
  is_configured: boolean;
  [key: string]: any; // 支持 config_json 或 config_payload
}

interface ProviderSettingsTemplateProps {
  fetchProviders: () => Promise<{ active_provider: string | null; providers: Provider[] }>;
  testConnection: (providerId: string, config: any) => Promise<{ success: boolean; message: string }>;
  saveConfig: (providerId: string, config: any) => Promise<{ success: boolean; message: string }>;
  onConfigSaved?: () => Promise<void>;
  emptyStateIcon?: string;
  emptyStateText?: string;
  configKey?: string; // 指定后端使用的配置字段名，如 'config_json' 或 'config_payload'
  filterLevel?: string; // 如果设置，则只渲染对应 level 的字段（如 'provider'）
}

interface ProviderSettingsFormProps {
  formData: Record<string, ConfigField>;
  onChange: (key: string, value: any) => void;
  filterLevel?: string;
}

export const ProviderSettingsForm: React.FC<ProviderSettingsFormProps> = ({
  formData,
  onChange,
  filterLevel
}) => {
  const { t } = useLanguage();
  // 状态管理由表单数据本身和 Input 组件内置状态处理

  let configKeys = Object.keys(formData);
  if (filterLevel) {
    configKeys = configKeys.filter(key => formData[key]?.level === filterLevel);
  }

  if (configKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground italic py-8 border-2 border-dashed border-border rounded-xl">
        {t('admin.noConfigRequired')}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
      {configKeys.map((key) => {
        const fieldConfig = formData[key];
        if (!fieldConfig || typeof fieldConfig !== 'object' || !('type' in fieldConfig)) return null;

        const { type, label, description, required, placeholder, options, min, max, step, value, sensitive } = fieldConfig;
        const displayLabel = label || key; // 如果没有 label，使用 key 作为展示名称
        const currentValue = value !== undefined ? value : (fieldConfig.default ?? '');
        const isPasswordField = type === 'password' || sensitive;

        const shouldUseRadioGroup = type === 'select' && options && options.length > 0 && options.length < 5;

        return (
          <div key={key} className="space-y-2">
            {shouldUseRadioGroup ? (
              <RadioGroup
                label={displayLabel}
                required={required}
                value={currentValue}
                onChange={(val) => onChange(key, val)}
                options={options.map((opt: string) => ({ label: opt, value: opt }))}
                variant="segmented"
              />
            ) : type === 'select' ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1">
                  {displayLabel}
                  {required && <span className="text-destructive">*</span>}
                </label>
                {description && <p className="text-xs text-muted-foreground mb-1">{description}</p>}
                <Select
                  value={currentValue}
                  onChange={(val) => onChange(key, val)}
                  options={options?.map((opt: string) => ({ label: opt, value: opt })) || []}
                  className="w-full"
                />
              </div>
            ) : type === 'number' ? (
              <Input
                label={label}
                description={description}
                required={required}
                type="number"
                value={currentValue}
                onChange={(e) => onChange(key, parseFloat(e.target.value))}
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
              />
            ) : (
                <Input
                  label={displayLabel}
                  description={description}
                  required={required}
                  type={isPasswordField ? 'password' : 'text'}
                  showPasswordToggle={isPasswordField}
                  value={currentValue}
                  onChange={(e) => onChange(key, e.target.value)}
                  placeholder={placeholder}
                />
            )}
          </div>
        );
      })}
    </div>
  );
};

const ProviderSettingsTemplate: React.FC<ProviderSettingsTemplateProps> = ({
  fetchProviders,
  testConnection,
  saveConfig,
  onConfigSaved,
  emptyStateIcon = '⚙️',
  emptyStateText = undefined,
  configKey = 'config',
  filterLevel = undefined
}) => {
  const { t } = useLanguage();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, ConfigField>>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<ToastMessage | null>(null);
  const [saveResult, setSaveResult] = useState<ToastMessage | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await fetchProviders();
      setProviders(data.providers);
      setSelectedProviderId(data.active_provider || '');
      
      if (data.active_provider) {
        const active = data.providers.find(p => p.id === data.active_provider);
        if (active) { // Check if active provider is found
          setFormData(active[configKey] || {}); // Ensure formData is an object
        }
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newId: string) => {
    setSelectedProviderId(newId);
    setTestResult(null);
    setSaveResult(null);

    if (!newId) {
      setFormData({});
      return;
    }

    const provider = providers.find(p => p.id === newId);
    if (provider) {
      setFormData(provider[configKey] || {});
    }
  };

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], value }
    }));
    setTestResult(null);
    setSaveResult(null);
  };

  const handleTestConnection = async () => {
    if (!selectedProviderId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const values = extractConfigValues(formData);
      const result = await testConnection(selectedProviderId, values);
      setTestResult(result);
      setTimeout(() => setTestResult(null), 3000);
    } catch (error: any) {
      setTestResult({ success: false, message: error?.message || t('settings.networkError') });
      setTimeout(() => setTestResult(null), 3000);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const values = selectedProviderId ? extractConfigValues(formData) : {};
      const result = await saveConfig(selectedProviderId || 'none', values);

      if (result.success) {
        setSaveResult(result);
        if (onConfigSaved) await onConfigSaved();
        setTimeout(() => setSaveResult(null), 3000);

        if (selectedProviderId) {
          setProviders(prev => prev.map(p =>
            p.id === selectedProviderId
              ? { ...p, is_configured: true, [configKey]: formData }
              : p
          ));
        }
      } else {
        setSaveResult(result);
      }
    } catch (error: any) {
      setSaveResult({ success: false, message: error?.message || t('settings.networkError') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">正在获取供应商配置...</p>
      </div>
    );
  }

  const providerOptions = [
    { label: '未启用', value: '' },
    ...providers.map(p => ({
      label: p.name,
      value: p.id,
      description: p.id,
      icon: <div className={cn("w-2 h-2 rounded-full mr-2 shadow-sm", p.is_configured ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-muted ring-2 ring-muted/20")} />
    }))
  ];

  return (
    <>
      <Toast message={saveResult} title={{ success: t('settings.saveSuccess'), error: t('settings.saveFailed') }} />
      {!saveResult && <Toast message={testResult} title={{ success: t('settings.testSuccess'), error: t('settings.testFailed') }} />}

      <div className="flex flex-col h-full space-y-6">
        {/* Provider Selector */}
        <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">选择服务商</label>
            <Select
              value={selectedProviderId}
              onChange={handleProviderChange}
              options={providerOptions}
              className="w-full bg-card/50"
            />
        </div>

        {/* Config Form Area */}
        <div className="flex-1 min-h-0 flex flex-col pt-2">
          {selectedProviderId ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
               <Card className="border-none bg-muted/20 shadow-none">
                 <CardContent className="p-5">
                    <ProviderSettingsForm 
                      formData={formData}
                      onChange={handleInputChange}
                      filterLevel={filterLevel}
                    />
                 </CardContent>
               </Card>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic bg-muted/10 rounded-2xl border-2 border-dashed border-border/50 p-12 transition-all">
              <div className="mb-6 p-4 bg-background rounded-full shadow-lg scale-110">
                <span className="text-5xl">{emptyStateIcon}</span>
              </div>
              <div className="text-sm font-medium tracking-wide">
                {emptyStateText || "请先选择一个服务商以开始配置"}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
          {selectedProviderId && (
            <Button
              onClick={handleTestConnection}
              disabled={testing || saving}
              variant="outline"
              className="px-6 border-2 hover:bg-emerald-500/5 hover:text-emerald-600 hover:border-emerald-500/30 transition-all"
              loading={testing}
            >
              {!testing && <Activity size={16} className="mr-2" />}
              测试连接
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || testing}
            className="px-8 shadow-md"
            loading={saving}
          >
            {!saving && <Save size={16} className="mr-2" />}
            保存配置
          </Button>
        </div>
      </div>
    </>
  );
};

export default ProviderSettingsTemplate;
