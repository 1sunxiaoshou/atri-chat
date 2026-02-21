import React, { useState, useEffect } from 'react';
import { X, Save, Activity } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Input, Select, Modal } from '../../ui';
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

interface ConfigField {
    type: 'string' | 'password' | 'number' | 'select' | 'file';
    label: string;
    description?: string;
    default?: any;
    required?: boolean;
    placeholder?: string;
    sensitive?: boolean;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    level?: 'provider' | 'voice';
    value?: any;
}

interface ProviderModalProps {
    provider: TTSProvider | null;
    providerTypes: ProviderType[];
    onClose: (needRefresh?: boolean) => void;
}

const ProviderModal: React.FC<ProviderModalProps> = ({
    provider,
    providerTypes,
    onClose
}) => {
    const { language } = useLanguage();
    const [providerType, setProviderType] = useState(provider?.provider_type || '');
    const [name, setName] = useState(provider?.name || '');
    const [enabled, setEnabled] = useState(provider?.enabled ?? true);
    const [configTemplate, setConfigTemplate] = useState<Record<string, ConfigField>>({});
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (providerType) {
            loadTemplate(providerType);
        }
    }, [providerType]);

    const loadTemplate = async (type: string) => {
        try {
            const res = await httpClient.get(`/tts-providers/types/${type}/template`);
            if (res.code === 200) {
                const template = res.data.template;
                setConfigTemplate(template);

                // 如果是编辑模式，填充现有配置
                if (provider) {
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
            console.error('加载配置模板失败:', error);
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
            alert(language === 'zh' ? '请先保存供应商后再测试' : 'Please save provider first');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const res = await httpClient.post(`/tts-providers/${provider.id}/test`, {});
            if (res.code === 200) {
                setTestResult({ success: true, message: res.data.message || '连接成功' });
            } else {
                setTestResult({ success: false, message: res.data?.message || '连接失败' });
            }
        } catch (error: any) {
            setTestResult({ success: false, message: error?.message || '测试失败' });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!providerType || !name.trim()) {
            alert(language === 'zh' ? '请填写必填项' : 'Please fill required fields');
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
                alert(res.message || (language === 'zh' ? '保存失败' : 'Save failed'));
            }
        } catch (error: any) {
            console.error('保存供应商失败:', error);
            alert(error?.message || (language === 'zh' ? '保存失败' : 'Save failed'));
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
                    {language === 'zh' ? '该供应商暂无配置项' : 'No configuration required'}
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

    return (
        <Modal
            isOpen={true}
            onClose={() => onClose(false)}
            title={provider ? (language === 'zh' ? '编辑供应商' : 'Edit Provider') : (language === 'zh' ? '添加供应商' : 'Add Provider')}
            size="lg"
        >
            <div className="space-y-4">
                {/* 基本信息 */}
                <Input
                    label={language === 'zh' ? '供应商名称' : 'Provider Name'}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'zh' ? '例如：我的 GPT-SoVITS' : 'e.g., My GPT-SoVITS'}
                />

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        {language === 'zh' ? '供应商类型' : 'Provider Type'}
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
                        {language === 'zh' ? '启用此供应商' : 'Enable this provider'}
                    </label>
                </div>

                {/* 配置表单 */}
                {providerType && (
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">
                            {language === 'zh' ? '供应商配置' : 'Provider Configuration'}
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
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => onClose(false)}>
                        {language === 'zh' ? '取消' : 'Cancel'}
                    </Button>
                    {provider && (
                        <Button
                            variant="outline"
                            onClick={handleTest}
                            disabled={testing}
                            loading={testing}
                        >
                            <Activity size={16} className="mr-2" />
                            {language === 'zh' ? '测试连接' : 'Test'}
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={loading} loading={loading}>
                        <Save size={16} className="mr-2" />
                        {language === 'zh' ? '保存' : 'Save'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ProviderModal;
