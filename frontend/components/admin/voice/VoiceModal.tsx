import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Input, Select, Modal } from '../../ui';
import { httpClient } from '../../../services/api/base';
import { extractConfigValues } from '../../../utils/helpers';

interface VoiceAsset {
    id: string;
    provider_id: string;
    provider_name: string;
    provider_type: string;
    name: string;
    voice_config: Record<string, any>;
}

interface TTSProvider {
    id: string;
    provider_type: string;
    name: string;
    enabled: boolean;
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

interface VoiceModalProps {
    voice: VoiceAsset | null;
    providers: TTSProvider[];
    onClose: (needRefresh?: boolean) => void;
}

const VoiceModal: React.FC<VoiceModalProps> = ({
    voice,
    providers,
    onClose
}) => {
    const { language } = useLanguage();
    const [providerId, setProviderId] = useState(voice?.provider_id || '');
    const [name, setName] = useState(voice?.name || '');
    const [configTemplate, setConfigTemplate] = useState<Record<string, ConfigField>>({});
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    // 获取启用的供应商
    const enabledProviders = providers.filter((p) => p.enabled);

    useEffect(() => {
        if (providerId) {
            const provider = providers.find((p) => p.id === providerId);
            if (provider) {
                loadTemplate(provider.provider_type);
            }
        }
    }, [providerId]);

    const loadTemplate = async (providerType: string) => {
        try {
            const res = await httpClient.get(`/tts-providers/types/${providerType}/template`);
            if (res.code === 200) {
                const template = res.data.template;
                setConfigTemplate(template);

                // 如果是编辑模式，填充现有配置
                if (voice) {
                    const initialData: Record<string, any> = {};
                    Object.keys(template).forEach((key) => {
                        if (template[key].level === 'voice') {
                            initialData[key] = {
                                ...template[key],
                                value: voice.voice_config[key] ?? template[key].default
                            };
                        }
                    });
                    setFormData(initialData);
                } else {
                    // 新建模式，使用默认值
                    const initialData: Record<string, any> = {};
                    Object.keys(template).forEach((key) => {
                        if (template[key].level === 'voice') {
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
    };

    const handleSave = async () => {
        if (!providerId || !name.trim()) {
            alert(language === 'zh' ? '请填写必填项' : 'Please fill required fields');
            return;
        }

        setLoading(true);

        try {
            const voiceConfig = extractConfigValues(formData);
            const data = {
                provider_id: providerId,
                name: name.trim(),
                voice_config: voiceConfig
            };

            let res;
            if (voice) {
                // 更新
                res = await httpClient.put(`/voice-assets/${voice.id}`, data);
            } else {
                // 创建
                res = await httpClient.post('/voice-assets', data);
            }

            if (res.code === 200) {
                onClose(true);
            } else {
                alert(res.message || (language === 'zh' ? '保存失败' : 'Save failed'));
            }
        } catch (error: any) {
            console.error('保存音色失败:', error);
            alert(error?.message || (language === 'zh' ? '保存失败' : 'Save failed'));
        } finally {
            setLoading(false);
        }
    };

    const renderFormFields = () => {
        const voiceFields = Object.keys(formData).filter(
            (key) => formData[key].level === 'voice'
        );

        if (voiceFields.length === 0) {
            return (
                <div className="text-muted-foreground italic text-center py-8">
                    {language === 'zh' ? '该供应商暂无音色配置项' : 'No voice configuration required'}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {voiceFields.map((key) => {
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
                            ) : type === 'file' ? (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">
                                        {label}
                                        {required && <span className="text-destructive ml-1">*</span>}
                                    </label>
                                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                    <input
                                        type="file"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                // 这里可以上传文件或读取文件路径
                                                handleInputChange(key, file.name);
                                            }
                                        }}
                                        className="w-full text-sm"
                                    />
                                </div>
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
            title={voice ? (language === 'zh' ? '编辑音色' : 'Edit Voice') : (language === 'zh' ? '添加音色' : 'Add Voice')}
            size="lg"
        >
            <div className="space-y-4">
                {/* 基本信息 */}
                <Input
                    label={language === 'zh' ? '音色名称' : 'Voice Name'}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'zh' ? '例如：甜美女声' : 'e.g., Sweet Female'}
                />

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        {language === 'zh' ? '所属供应商' : 'Provider'}
                        <span className="text-destructive ml-1">*</span>
                    </label>
                    <Select
                        value={providerId}
                        onChange={setProviderId}
                        options={enabledProviders.map((p) => ({
                            label: `${p.name} (${p.provider_type})`,
                            value: p.id
                        }))}
                        disabled={!!voice}
                        className="w-full"
                    />
                    {enabledProviders.length === 0 && (
                        <p className="text-xs text-destructive">
                            {language === 'zh' ? '请先创建并启用至少一个供应商' : 'Please create and enable at least one provider first'}
                        </p>
                    )}
                </div>

                {/* 配置表单 */}
                {providerId && (
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">
                            {language === 'zh' ? '音色配置' : 'Voice Configuration'}
                        </h4>
                        {renderFormFields()}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => onClose(false)}>
                        {language === 'zh' ? '取消' : 'Cancel'}
                    </Button>
                    <Button onClick={handleSave} disabled={loading || !providerId} loading={loading}>
                        <Save size={16} className="mr-2" />
                        {language === 'zh' ? '保存' : 'Save'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default VoiceModal;
