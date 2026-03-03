import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Input, Select, RadioGroup, Modal } from '../../ui';
import { httpClient } from '../../../services/api/base';
import { extractConfigValues } from '../../../utils/helpers';

interface VoiceAsset {
    id: string;
    provider_id: string;
    name: string;
    voice_config: Record<string, any>;
    provider?: {
        id: string;
        name: string;
        provider_type: string;
    };
}

interface TTSProvider {
    id: string;
    provider_type: string;
    name: string;
    enabled: boolean;
}

interface VoiceModalProps {
    isOpen: boolean;
    voice: VoiceAsset | null;
    providers: TTSProvider[];
    onClose: (needRefresh?: boolean) => void;
}

const VoiceModal: React.FC<VoiceModalProps> = ({
    isOpen,
    voice,
    providers,
    onClose
}) => {
    const { language } = useLanguage();
    const providerId = voice?.provider_id || '';
    const [name, setName] = useState(voice?.name || '');
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    // 当弹窗打开或voice变化时，重新初始化状态
    useEffect(() => {
        if (isOpen && voice) {
            setName(voice.name);
        } else if (isOpen && !voice) {
            setName('');
            setFormData({});
        }
    }, [isOpen, voice]);

    useEffect(() => {
        if (providerId) {
            const provider = providers.find((p) => p.id === providerId);
            if (provider) {
                loadTemplate(provider.provider_type);
            }
        }
    }, [providerId, providers]);

    const loadTemplate = async (providerType: string) => {
        try {
            const res = await httpClient.get(`/tts-providers/types/${providerType}/template`);
            if (res.code === 200 && res.data) {
                const template = (res.data as any).template;

                // 如果是编辑模式，填充现有配置
                if (voice && voice.voice_config) {
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

                    // 如果有 voice 字段，自动设置名称为默认音色值
                    if (initialData['voice']?.value) {
                        setName(initialData['voice'].value);
                    }
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

        // 如果修改的是 voice 字段，且当前名称为空或与旧的 voice 值相同，则自动更新名称
        if (key === 'voice') {
            const oldVoiceValue = formData['voice']?.value;
            if (!name.trim() || name === oldVoiceValue) {
                setName(value);
            }
        }
    };

    const handleSave = async () => {
        if (!providerId || !name.trim()) {
            alert(language === 'zh' ? '请填写必填项' : 'Please fill required fields');
            return;
        }

        setLoading(true);

        try {
            const voiceConfig = extractConfigValues(formData);

            let res;
            if (voice && voice.id) {
                // 更新：只发送 name 和 voice_config
                const updateData = {
                    name: name.trim(),
                    voice_config: voiceConfig
                };
                res = await httpClient.put(`/voice-assets/${voice.id}`, updateData);
            } else {
                // 创建：需要发送 provider_id, name 和 voice_config
                const createData = {
                    provider_id: providerId,
                    name: name.trim(),
                    voice_config: voiceConfig
                };
                res = await httpClient.post('/voice-assets', createData);
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

        // 判断字段是否为语言选择（参考语言、合成语言等）
        const isLanguageField = (key: string, label: string) => {
            return key.toLowerCase().includes('language') ||
                label.includes('语言') ||
                label.toLowerCase().includes('language');
        };

        return (
            <div className="space-y-3">
                {voiceFields.map((key) => {
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
                                    options={options.map((opt: string) => ({
                                        label: isLanguageField(key, label) ? opt.toUpperCase() : opt,
                                        value: opt
                                    }))}
                                    variant="segmented"
                                />
                            ) : type === 'select' ? (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">
                                        {label}
                                        {required && <span className="text-destructive ml-1">*</span>}
                                    </label>
                                    <Select
                                        value={currentValue}
                                        onChange={(val) => handleInputChange(key, val)}
                                        options={options?.map((opt: string) => ({ label: opt, value: opt })) || []}
                                        placeholder={description || placeholder}
                                        className="w-full"
                                    />
                                </div>
                            ) : type === 'number' ? (
                                <Input
                                    label={label}
                                    required={required}
                                    type="number"
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(key, parseFloat(e.target.value))}
                                    min={min}
                                    max={max}
                                    step={step}
                                    placeholder={description || placeholder}
                                />
                            ) : type === 'file' ? (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">
                                        {label}
                                        {required && <span className="text-destructive ml-1">*</span>}
                                    </label>
                                    <input
                                        type="file"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                // 这里可以上传文件或读取文件路径
                                                handleInputChange(key, file.name);
                                            }
                                        }}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            ) : (
                                <Input
                                    label={label}
                                    required={required}
                                    type={isPassword ? 'password' : 'text'}
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                    placeholder={description || placeholder}
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
            title={voice ? (language === 'zh' ? '编辑音色' : 'Edit Voice') : (language === 'zh' ? '添加音色' : 'Add Voice')}
            size="lg"
        >
            <div className="p-4 space-y-4">
                {/* 基本信息 */}
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {language === 'zh' ? '基本信息' : 'Basic Information'}
                    </h4>
                    <Input
                        label={language === 'zh' ? '音色名称' : 'Voice Name'}
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={language === 'zh' ? '例如：甜美女声' : 'e.g., Sweet Female'}
                    />
                </div>

                {/* 配置表单 */}
                {providerId && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {language === 'zh' ? '音色配置' : 'Voice Configuration'}
                        </h4>
                        {renderFormFields()}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => onClose(false)}>
                        {language === 'zh' ? '取消' : 'Cancel'}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={loading || !providerId} loading={loading}>
                        <Save size={14} />
                        {language === 'zh' ? '保存' : 'Save'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default VoiceModal;
