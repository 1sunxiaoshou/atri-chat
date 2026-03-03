import React, { useState, useEffect } from 'react';
import { Save, Activity, Loader2 } from 'lucide-react';
import Toast, { ToastMessage } from '../ui/Toast';
import { extractConfigValues } from '../../utils/helpers';
import { Button, Select, Input, Card, CardContent } from '../ui';
import { cn } from '../../utils/cn';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConfigField {
  type: 'string' | 'password' | 'number' | 'select' | 'file';
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
}

interface Provider {
  id: string;
  name: string;
  is_configured: boolean;
  config?: Record<string, ConfigField>;
}

interface ProviderSettingsTemplateProps {
  fetchProviders: () => Promise<{ active_provider: string | null; providers: Provider[] }>;
  testConnection: (providerId: string, config: any) => Promise<{ success: boolean; message: string }>;
  saveConfig: (providerId: string, config: any) => Promise<{ success: boolean; message: string }>;
  onConfigSaved?: () => Promise<void>;
  emptyStateIcon?: string;
  emptyStateText?: string;
}

const ProviderSettingsTemplate: React.FC<ProviderSettingsTemplateProps> = ({
  fetchProviders,
  testConnection,
  saveConfig,
  onConfigSaved,
  emptyStateIcon = '⚙️',
  emptyStateText = undefined
}) => {
  const { t } = useLanguage();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [formData, setFormData] = useState<any>({});
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
        if (active && active.config) {
          setFormData(active.config);
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
      setFormData(provider.config || {});
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
              ? { ...p, is_configured: true, config: formData }
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

  const renderFormFields = () => {
    if (!selectedProviderId) return null;

    const configKeys = Object.keys(formData);
    if (configKeys.length === 0) {
      return <div className="text-muted-foreground italic text-center py-8">该服务商暂无配置项</div>;
    }

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
        {configKeys.map((key) => {
          const fieldConfig = formData[key];
          if (!fieldConfig || typeof fieldConfig !== 'object' || !('type' in fieldConfig)) return null;

          const { type, label, description, required, placeholder, options, min, max, step, value } = fieldConfig;
          const currentValue = value !== undefined ? value : (fieldConfig.default || '');
          const isPassword = type === 'password' || fieldConfig.sensitive;

          return (
            <div key={key}>
              {type === 'select' ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{label}{required && <span className="text-destructive ml-1">*</span>}</label>
                  {description && <p className="text-xs text-muted-foreground">{description}</p>}
                  <Select
                    value={currentValue}
                    onChange={(val) => handleInputChange(key, val)}
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
                  onChange={(e) => handleInputChange(key, parseFloat(e.target.value))}
                  min={min}
                  max={max}
                  step={step}
                  placeholder={placeholder}
                />
              ) : (
                <Input
                  label={label}
                  description={description}
                  required={required}
                  type={isPassword ? 'password' : 'text'}
                  value={currentValue}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={placeholder}
                  showPasswordToggle={isPassword}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-muted-foreground">加载配置中...</p>
      </div>
    );
  }

  const providerOptions = [
    { label: '无', value: '' },
    ...providers.map(p => ({
      label: p.name,
      value: p.id,
      icon: <div className={cn("w-2 h-2 rounded-full mr-2", p.is_configured ? "bg-emerald-500" : "bg-muted")} />
    }))
  ];

  return (
    <>
      <Toast message={saveResult} title={{ success: t('settings.saveSuccess'), error: t('settings.saveFailed') }} />
      {!saveResult && <Toast message={testResult} title={{ success: t('settings.testSuccess'), error: t('settings.testFailed') }} />}

      <div className="flex flex-col h-full space-y-4">
        {/* Provider Selector */}
        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">服务商</label>
              <Select
                value={selectedProviderId}
                onChange={handleProviderChange}
                options={providerOptions}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Config Form Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {selectedProviderId ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
              {renderFormFields()}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic bg-muted/20 rounded-xl border border-dashed border-border p-8">
              <div className="mb-3 text-4xl opacity-50">{emptyStateIcon}</div>
              <div className="text-sm">{emptyStateText}</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          {selectedProviderId && (
            <Button
              onClick={handleTestConnection}
              disabled={testing}
              variant="outline"
              loading={testing}
            >
              <Activity size={16} className="mr-2" />
              测试连接
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            loading={saving}
          >
            <Save size={16} className="mr-2" />
            保存配置
          </Button>
        </div>
      </div>
    </>
  );
};

export default ProviderSettingsTemplate;
