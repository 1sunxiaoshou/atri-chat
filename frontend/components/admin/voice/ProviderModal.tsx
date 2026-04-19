import React, { useState, useEffect } from 'react';
import { Save, Activity } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Input, Select, Modal } from '../../ui';
import { httpClient } from '../../../services/api/base';
import { extractConfigValues } from '../../../utils/helpers';
import { ProviderSettingsForm } from '../shared/ProviderSettingsTemplate';

interface TTSProvider {
    id: number;
    provider_type: string;
    name: string;
    config_payload: Record<string, any>;
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
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // 当弹窗打开或provider变化时，重新初始化状态
    useEffect(() => {
        if (isOpen && provider) {
            setProviderType(provider.provider_type);
            setName(provider.name);
        } else if (isOpen && !provider) {
            setProviderType('');
            setName('');
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
                const initialData: Record<string, any> = {};
                Object.keys(template).forEach((key) => {
                    initialData[key] = {
                        ...template[key],
                        value: (provider && provider.config_payload)
                            ? (provider.config_payload[key] ?? template[key].default)
                            : template[key].default
                    };
                });
                setFormData(initialData);
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

    const isFormValid = () => {
        if (!providerType || !name.trim()) {return false;}

        // 校验动态配置项中的必填项
        for (const key of Object.keys(formData)) {
            const field = formData[key];
            if (field.required) {
                const val = field.value;
                if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
                    return false;
                }
            }
        }
        return true;
    };

    const handleSave = async () => {
        setLoading(true);

        try {
            const configPayload = extractConfigValues(formData);
            const data = {
                provider_type: providerType,
                name: name.trim(),
                config_payload: configPayload
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
                        placeholder={t('admin.ttsProviderNameExample')}
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            {t('admin.providerType')}
                            <span className="text-destructive ml-1">*</span>
                        </label>
                        <Select
                            value={providerType}
                            onChange={(val) => {
                                setProviderType(val);
                                const template = providerTypes.find(t => t.id === val);
                                if (!provider && (!name.trim() || providerTypes.some(t => t.name === name))) {
                                    setName(template?.name || val);
                                }
                            }}
                            options={providerTypes.map((t) => ({ label: t.name, value: t.id }))}
                            disabled={!!provider}
                            className="w-full"
                        />
                    </div>
                </div>

                {/* 动态配置表单 */}
                {providerType && (
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                            {t('admin.providerConfiguration')}
                        </h4>
                        <ProviderSettingsForm
                            formData={formData}
                            onChange={handleInputChange}
                            filterLevel="provider"
                        />
                    </div>
                )}

                {/* 测试结果 */}
                {testResult && (
                    <div className={`p-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-1 duration-200 ${testResult.success ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
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
                    <Button onClick={handleSave} disabled={loading || !isFormValid()} loading={loading}>
                        <Save size={16} className="mr-2" />
                        {t('admin.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ProviderModal;
