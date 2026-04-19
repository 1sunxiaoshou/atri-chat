import React from 'react';
import { Provider } from '../../../types';
import { Modal, Button, Input, Select } from '../../ui';
import { useLanguage } from '../../../contexts/LanguageContext';
import { ProviderSettingsForm } from '../shared/ProviderSettingsTemplate';

interface ProviderModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider: Partial<Provider> | null;
    providerTemplates: any[];
    onSave: () => void;
    onChange: (provider: Partial<Provider>) => void;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
    isOpen,
    onClose,
    provider,
    providerTemplates,
    onSave,
    onChange,
}) => {
    const { t } = useLanguage();

    if (!provider) {return null;}

    const isEditing = !!provider.id;
    const currentTemplate = providerTemplates.find(t => t.provider_type === (provider.provider_type || 'openai'));

    // 将后端的 config_fields 转换为 ProviderSettingsForm 需要的 Record<string, ConfigField> 格式
    const constructFormData = () => {
        if (!currentTemplate?.config_fields) {return {};}

        const formData: Record<string, any> = {};
        currentTemplate.config_fields.forEach((field: any) => {
            formData[field.field_name] = {
                ...field, // 包含 type, label, description, required, default, options 等
                type: field.field_type === 'string' && field.sensitive ? 'password' : field.field_type, // 映射敏感字段
                value: provider.config_payload?.[field.field_name] ?? field.default_value ?? ''
            };
        });
        return formData;
    };

    const handleConfigChange = (fieldName: string, value: any) => {
        onChange({
            ...provider,
            config_payload: {
                ...provider.config_payload,
                [fieldName]: value
            }
        });
    };

    const isFormValid = () => {
        if (!provider.name?.trim()) {return false;}
        if (!provider.provider_type && !providerTemplates[0]?.provider_type) {return false;}

        // 校验动态配置项中的必填项
        if (currentTemplate?.config_fields) {
            for (const field of currentTemplate.config_fields) {
                if (field.required) {
                    const val = provider.config_payload?.[field.field_name];
                    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
                        return false;
                    }
                }
            }
        }
        return true;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('admin.editProvider') : t('admin.addProvider')}
            size="lg"
        >
            <div className="p-6 space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.basicInfo')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('admin.providerName')}
                            value={provider.name || ''}
                            onChange={(e) => onChange({ ...provider, name: e.target.value })}
                            placeholder={t('admin.providerNameExample')}
                            required
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                {t('admin.providerType')}
                                <span className="text-destructive ml-1">*</span>
                            </label>
                            <Select
                                value={provider.provider_type || providerTemplates[0]?.provider_type || 'openai'}
                                onChange={(val) => {
                                    const template = providerTemplates.find(t => t.provider_type === val);
                                    const config: any = {};
                                    template?.config_fields?.forEach((f: any) => {
                                        config[f.field_name] = f.default_value || '';
                                    });

                                    // 只有当 name 为空，或者 name 等于之前的 provider_type 或 template.name 时才同步更新
                                    const oldTemplate = providerTemplates.find(t => t.provider_type === provider.provider_type);
                                    const shouldSyncName = !isEditing && (
                                        !provider.name?.trim() ||
                                        provider.name === provider.provider_type ||
                                        (oldTemplate && provider.name === oldTemplate.name)
                                    );

                                    onChange({
                                        ...provider,
                                        name: shouldSyncName ? (template?.name || val) : provider.name,
                                        provider_type: val as any,
                                        config_payload: config,
                                    });
                                }}
                                options={providerTemplates.map(t => ({
                                    label: t.name,
                                    value: t.provider_type,
                                }))}
                            />
                        </div>
                    </div>
                </div>

                {/* 动态 API 配置 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.apiConfig')}
                    </h4>
                    <ProviderSettingsForm
                        formData={constructFormData()}
                        onChange={handleConfigChange}
                    />
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="outline" onClick={onClose}>
                        {t('admin.cancel')}
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={!isFormValid()}
                    >
                        {t('admin.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
