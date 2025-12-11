
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Save, Activity } from 'lucide-react';
import Toast, { ToastMessage } from './Toast';
import { extractConfigValues } from '../utils/helpers';
import Select from './ui/Select';

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
  // API 调用函数
  fetchProviders: () => Promise<{ active_provider: string | null; providers: Provider[] }>;
  testConnection: (providerId: string, config: any) => Promise<{ success: boolean; message: string }>;
  saveConfig: (providerId: string, config: any) => Promise<{ success: boolean; message: string }>;
  
  // 可选的回调
  onConfigSaved?: () => Promise<void>;
  
  // UI 配置
  emptyStateIcon?: string;
  emptyStateText?: string;
}

const ProviderSettingsTemplate: React.FC<ProviderSettingsTemplateProps> = ({
  fetchProviders,
  testConnection,
  saveConfig,
  onConfigSaved,
  emptyStateIcon = '⚙️',
  emptyStateText = '请选择上方的服务商进行配置'
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<ToastMessage | null>(null);
  const [saveResult, setSaveResult] = useState<ToastMessage | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await fetchProviders();
      setProviders(data.providers);
      setActiveProviderId(data.active_provider);
      if (data.active_provider) {
        setSelectedProviderId(data.active_provider);
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

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestConnection = async () => {
    if (!selectedProviderId) return;
    setTesting(true);
    setTestResult(null);
    setSaveResult(null);
    try {
      const values = extractConfigValues(formData);
      const result = await testConnection(selectedProviderId, values);
      setTestResult(result);
      setTimeout(() => setTestResult(null), 3000);
    } catch (error: any) {
      const errorMsg = error?.message || '网络错误或服务不可用';
      setTestResult({ success: false, message: errorMsg });
      setTimeout(() => setTestResult(null), 3000);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    setTestResult(null);

    try {
      const values = selectedProviderId ? extractConfigValues(formData) : {};
      const result = await saveConfig(
        selectedProviderId || 'none',
        values
      );

      if (result.success) {
        setActiveProviderId(selectedProviderId || null);
        setSaveResult(result);
        
        if (onConfigSaved) {
          await onConfigSaved();
        }

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
      setSaveResult({
        success: false,
        message: error?.message || '网络错误'
      });
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = () => {
    if (!selectedProviderId) {
      return <div className="text-gray-500 dark:text-gray-500 italic">选择服务商以进行配置</div>;
    }

    const configKeys = Object.keys(formData);
    if (configKeys.length === 0) {
      return <div className="text-gray-500 dark:text-gray-500 italic">该服务商暂无配置项</div>;
    }

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
        {configKeys.map((key) => {
          const fieldConfig = formData[key];
          
          if (!fieldConfig || typeof fieldConfig !== 'object' || !('type' in fieldConfig)) {
            console.error(`配置字段 ${key} 格式错误，应为元数据格式`);
            return null;
          }

          const { type, label, description, required, placeholder, options, min, max, step, value, accept } = fieldConfig;
          const currentValue = value !== undefined ? value : (fieldConfig.default || '');
          const isPassword = type === 'password' || fieldConfig.sensitive;

          return (
            <div key={key} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
                {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
              </label>
              {description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{description}</p>
              )}
              
              {type === 'select' ? (
                <Select
                  value={currentValue}
                  onChange={(val) => handleInputChange(key, val)}
                  options={options?.map(opt => ({ label: opt, value: opt })) || []}
                  className="w-full"
                />
              ) : type === 'number' ? (
                <input
                  type="number"
                  value={currentValue}
                  onChange={(e) => handleInputChange(key, parseFloat(e.target.value))}
                  min={min}
                  max={max}
                  step={step}
                  placeholder={placeholder}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              ) : type === 'file' ? (
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                />
              ) : (
                <div className="relative">
                  <input
                    type={isPassword && !showSecrets[key] ? 'password' : 'text'}
                    value={currentValue}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  {isPassword && (
                    <button
                      type="button"
                      onClick={() => toggleSecret(key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                    >
                      {showSecrets[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const providerOptions = [
    { label: '无', value: '' },
    ...providers.map(p => ({
      label: p.name,
      value: p.id,
      icon: p.is_configured ? <span className="text-green-500">●</span> : <span className="text-yellow-500">○</span>
    }))
  ];

  return (
    <>
      <Toast message={saveResult} title={{ success: '保存成功', error: '保存失败' }} />
      {!saveResult && <Toast message={testResult} title={{ success: '测试成功', error: '测试失败' }} />}

      <div className="flex flex-col h-full space-y-4">
        {/* Provider 选择器 */}
        <div className="flex-shrink-0">
          <div className="bg-gray-100 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Provider
              </label>
              <div className="flex-1">
                <Select
                  value={selectedProviderId}
                  onChange={handleProviderChange}
                  options={providerOptions}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 配置表单区域 */}
        <div className="flex-1 min-h-0 flex flex-col">
          {selectedProviderId ? (
            <div className="bg-gray-100 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-800 flex-1 overflow-y-auto custom-scrollbar">
              {renderFormFields()}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-500 italic bg-gray-100 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-800 border-dashed">
              <div className="mb-2 text-4xl">{emptyStateIcon}</div>
              <div>{emptyStateText}</div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 pt-2">
          {selectedProviderId && (
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? <Loader2 className="animate-spin" size={18} /> : <Activity size={18} />}
              <span>测试连接</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            <span>保存配置</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default ProviderSettingsTemplate;
