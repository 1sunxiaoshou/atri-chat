import React, { useState, useEffect } from 'react';
import { Save, Activity } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Input, Select, RadioGroup, Modal } from '../../ui';
import { httpClient } from '../../../services/api/base';
import { extractConfigValues } from '../../../utils/helpers';

interface TTSProvider {
    id: string;
    provider_type: string;
    name: string;
    config_payload: Record<string, any>;
    enabled: boolean;
}

interface ProviderType {
    id: string;
    name: string;
    description: string;
}

interface ProviderModalProps {
    isOpen: boolean;
    provider: TTSProvider | null;
    providerTypes: ProviderType[];
    onClose: (needRefresh?: boolean) => void;
}

const ProviderModal: React.FC<ProviderModalProps> = ({
    isOpen,
    provider,
    providerTypes,
    onClose
}) => {
    const { t } = useLanguage();
    const [providerType, setProviderType] = useState(provider?.provider_type || '');
    const [name, setName] = useState(provider?.name || '');
    const [enabled, setEnabled] = useState(provider?.enabled ?? true);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // 当弹窗打开或provider变化时，重新初始化状态
    useEffect(() => {
        if (isOpen && provider) {
            setProviderType(provider.provider_type);
            setName(provider.name);
            setEnabled(provider.enabled);
        } else if (isOpen && !provider) {
            setProviderType('');
            setName('');
            setEnabled(true);
            setFormData({});
        }
    }, [isOpen, provider]);

    useEffect(() => {
        if (providerType) {
            loadTemplate(providerType);
        }
    }, [providerType]);

    const loadTemplate = async (type: string) => {
        try {
            const res = await httpClient.get(`/tts-providers/types/${type}/template`);
            if (res.code === 200 && res.data) {
                const template = (res.data as any).template;

                // 如果是编辑模式，填充现有配置
                if (provider && provider.config_payload) {
                    const initialData: Record<string, any> = {};
                    Object.keys(template).forEach((key) => {
                        if (template[key].level === 'provider') {
                            initialData[key] = {
                                ...template[key],
                                value: provider.config_payload[key] ?? template[key].default
                            };
                        }
                    });
                    setFormData(initialData);
                } else {
                    // 新建模式，使用默认值
                    const initialData: Record<string, any> = {};
                    Object.keys(template).forEach((key) => {
                        if (template[key].level === 'provider') {
                            initialData[key] = {
                                ...template[key],
                                value: template[key].default
                            };
                        }
                    });
                    setFormData(initialData);
                }
            }
        } catch (error) {
            console.error('Failed to load template:', error);
        }
    };

    const handleInputChange = (key: string, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [key]: { ...prev[key], value }
        }));
        setTestResult(null);
    };

    const handleTest = async () => {
        if (!provider) {
            alert(t('admin.saveProviderFirst'));
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const res = await httpClient.post(`/tts-providers/${provider.id}/test`, {});
            if (res.code === 200) {
                setTestResult({ success: true, message: (res.data as any)?.message || t('admin.connectionSuccess') });
            } else {
                setTestResult({ success: false, message: (res.data as any)?.message || t('admin.connectionFailed') });
            }
        } catch (error: any) {
            setTestResult({ success: false, message: error?.message || t('admin.testFailed') });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!providerType || !name.trim()) {
            alert(t('admin.fillRequiredFields'));
            return;
        }

        setLoading(true);

        try {
            const configPayload = extractConfigValues(formData);
            const data = {
                provider_type: providerType,
                name: name.trim(),
                config_payload: configPayload,
                enabled
            };

            let res;
            if (provider) {
                // 更新
                res = await httpClient.put(`/tts-providers/${provider.id}`, data);
            } else {
                // 创建
                res = await httpClient.post('/tts-providers', data);
            }

            if (res.code === 200) {
                onClose(true);
            } else {
                alert(res.message || t('admin.saveFailed'));
            }
        } catch (error: any) {
            console.error('Failed to save provider:', error);
            alert(error?.message || t('admin.saveFailed'));
        } finally {
            setLoading(false);
        }
    };

    const renderFormFields = () => {
        const providerFields = Object.keys(formData).filter(
            (key) => formData[key].level === 'provider'
        );

        if (providerFields.length === 0) {
            return (
                <div className="text-muted-foreground italic text-center py-8">
                    {t('admin.noConfigRequired')}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {providerFields.map((key) => {
                    const field = formData[key];
                    const { type, label, description, required, placeholder, options, min, max, step, value } = field;
                    const currentValue = value !== undefined ? value : (field.default || '');
                    const isPassword = type === 'password' || field.sensitive;

                    // 判断是否应该使用 RadioGroup：select 类型且选项少于 5 个
                    const shouldUseRadioGroup = type === 'select' && options && options.length < 5;

                    return (
                        <div key={key}>
                            {shouldUseRadioGroup ? (
                                <RadioGroup
                                    label={label}
                                    required={required}
                                    value={currentValue}
                                    onChange={(val) => handleInputChange(key, val)}
                                    options={options.map((opt: string) => ({ label: opt, value: opt }))}
                                    variant="segmented"
                                />
                            ) : type === 'select' ? (
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => onClose(false)}
            title={provider ? t('admin.editProvider') : t('admin.addProvider')}
            size="lg"
        >
            <div className="p-6 space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.basicInfo')}
                    </h4>
                    <Input
                        label={t('admin.providerName')}
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., My GPT-SoVITS"
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            {t('admin.providerType')}
                            <span className="text-destructive ml-1">*</span>
                        </label>
                        <Select
                            value={providerType}
                            onChange={setProviderType}
                            options={providerTypes.map((t) => ({ label: t.name, value: t.id }))}
                            disabled={!!provider}
                            className="w-full"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="enabled"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="rounded"
                        />
                        <label htmlFor="enabled" className="text-sm">
                            {t('admin.enableProvider')}
                        </label>
                    </div>
                </div>

                {/* 配置表单 */}
                {providerType && (
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                            {t('admin.providerConfiguration')}
                        </h4>
                        {renderFormFields()}
                    </div>
                )}

                {/* 测试结果 */}
                {testResult && (
                    <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                        {testResult.message}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="outline" onClick={() => onClose(false)}>
                        {t('admin.cancel')}
                    </Button>
                    {provider && (
                        <Button
                            variant="outline"
                            onClick={handleTest}
                            disabled={testing}
                            loading={testing}
                        >
                            <Activity size={16} className="mr-2" />
                            {t('admin.testConnection')}
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={loading} loading={loading}>
                        <Save size={16} className="mr-2" />
                        {t('admin.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ProviderModal;
