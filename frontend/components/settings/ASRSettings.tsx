import React, { useState, useEffect } from 'react';
import { Activity, Save, Loader2 } from 'lucide-react';
import { api } from '../../services/api/index';
import { useASR } from '../../contexts/ASRContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button, Input, Select, Toast, ToastMessage, Card, CardContent } from '../ui';
import { extractConfigValues } from '../../utils/helpers';

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

const ASRSettings: React.FC = () => {
    const { refreshASRStatus } = useASR();
    const { language } = useLanguage();
    const [providers, setProviders] = useState<Provider[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(true);
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
            const res = await api.getASRProviders();
            if (res.code === 200) {
                setProviders(res.data.providers);
                const activeId = res.data.active_provider || '';
                setSelectedProviderId(activeId);
                if (activeId) {
                    const active = res.data.providers.find((p: Provider) => p.id === activeId);
                    if (active?.config) {
                        setFormData(active.config);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch ASR providers:', error);
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
        if (provider?.config) {
            setFormData(provider.config);
        } else {
            setFormData({});
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
            const res = await api.testASRConnection(selectedProviderId, values);
            if (res.code === 200 && res.data?.success) {
                setTestResult({ success: true, message: res.data.message || '连接成功' });
            } else {
                setTestResult({ success: false, message: res.data?.message || '连接失败' });
            }
            setTimeout(() => setTestResult(null), 3000);
        } catch (error: any) {
            setTestResult({ success: false, message: error?.message || '网络错误' });
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
            const res = await api.saveASRConfig(selectedProviderId || 'none', values);
            if (res.code === 200) {
                setSaveResult({
                    success: true,
                    message: selectedProviderId ? '配置已保存' : 'ASR已禁用'
                });
                await refreshASRStatus();
                await loadProviders();
                setTimeout(() => setSaveResult(null), 3000);
            } else {
                setSaveResult({ success: false, message: res.message || '保存失败' });
            }
        } catch (error: any) {
            setSaveResult({ success: false, message: error?.message || '网络错误' });
        } finally {
            setSaving(false);
        }
    };

    const renderFormFields = () => {
        if (!selectedProviderId) return null;

        const configKeys = Object.keys(formData);
        if (configKeys.length === 0) {
            return (
                <div className="text-muted-foreground italic text-center py-8">
                    {language === 'zh' ? '该服务商暂无配置项' : 'No configuration required'}
                </div>
            );
        }

        return (
            <div className="space-y-5">
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
                                    <label className="text-sm font-medium">
                                        {label}
                                        {required && <span className="text-destructive ml-1">*</span>}
                                    </label>
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
            <div className="flex flex-col items-center justify-center h-96 gap-3">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-sm text-muted-foreground">
                    {language === 'zh' ? '加载配置中...' : 'Loading...'}
                </p>
            </div>
        );
    }

    const providerOptions = [
        { label: language === 'zh' ? '无' : 'None', value: '' },
        ...providers.map(p => ({ label: p.name, value: p.id }))
    ];

    return (
        <>
            <Toast message={saveResult} title={{ success: '保存成功', error: '保存失败' }} />
            {!saveResult && <Toast message={testResult} title={{ success: '测试成功', error: '测试失败' }} />}

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Provider Selector */}
                <Card className="bg-muted/30 border-none shadow-none">
                    <CardContent className="p-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {language === 'zh' ? '服务商' : 'Provider'}
                            </label>
                            <Select
                                value={selectedProviderId}
                                onChange={handleProviderChange}
                                options={providerOptions}
                                className="w-full"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Config Form */}
                {selectedProviderId ? (
                    <Card className="bg-muted/30 border-none shadow-none">
                        <CardContent className="p-6 space-y-6">
                            {renderFormFields()}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                                <Button
                                    onClick={handleTestConnection}
                                    disabled={testing}
                                    variant="outline"
                                    loading={testing}
                                >
                                    <Activity size={16} className="mr-2" />
                                    {language === 'zh' ? '测试连接' : 'Test'}
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    loading={saving}
                                >
                                    <Save size={16} className="mr-2" />
                                    {language === 'zh' ? '保存配置' : 'Save'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-muted/20 border-dashed">
                        <CardContent className="p-12 text-center">
                            <p className="text-sm text-muted-foreground">
                                {language === 'zh' ? '请选择一个服务商进行配置' : 'Select a provider to configure'}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
};

export default ASRSettings;
