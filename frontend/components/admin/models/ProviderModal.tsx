import React from 'react';
import { Provider } from '../../../types';
import { Modal, Button, Input, Select } from '../../ui';
import { useLanguage } from '../../../contexts/LanguageContext';

interface ProviderModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider: Partial<Provider> | null;
    providerTemplates: any[];
    existingProviders: Provider[];
    onSave: () => void;
    onChange: (provider: Partial<Provider>) => void;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
    isOpen,
    onClose,
    provider,
    providerTemplates,
    existingProviders,
    onSave,
    onChange,
}) => {
    const { t } = useLanguage();

    if (!provider) return null;

    const isEditing = existingProviders.some(p => p.provider_id === provider.provider_id);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('admin.editProvider') : t('admin.addProvider')}
        >
            <div className="p-6 space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.basicInfo')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('admin.providerId')}
                            value={provider.provider_id || ''}
                            onChange={(e) => onChange({ ...provider, provider_id: e.target.value })}
                            disabled={isEditing}
                            placeholder="e.g. openai"
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">{t('admin.providerTemplate')}</label>
                            <Select
                                value={provider.template_type || providerTemplates[0]?.template_type || 'openai'}
                                onChange={(val) => {
                                    const template = providerTemplates.find(t => t.template_type === val);
                                    const config: any = {};
                                    template?.config_fields?.forEach((f: any) => {
                                        config[f.field_name] = f.default_value || '';
                                    });

                                    // 只有当 provider_id 等于当前 template_type 时才同步更新（说明用户没有自定义）
                                    const shouldSyncProviderId = !isEditing && provider.provider_id === provider.template_type;

                                    onChange({
                                        ...provider,
                                        provider_id: shouldSyncProviderId ? val : provider.provider_id,
                                        template_type: val as any,
                                        config_json: config,
                                    });
                                }}
                                options={providerTemplates.map(t => ({
                                    label: t.name,
                                    value: t.template_type,
                                }))}
                            />
                        </div>
                    </div>
                </div>

                {/* API 配置 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.apiConfig')}
                    </h4>
                    <Input
                        label={t('admin.apiKey')}
                        type="password"
                        value={provider.config_json?.api_key || ''}
                        onChange={(e) =>
                            onChange({
                                ...provider,
                                config_json: { ...provider.config_json, api_key: e.target.value },
                            })
                        }
                        showPasswordToggle
                    />
                    <Input
                        label={t('admin.baseUrl')}
                        value={provider.config_json?.base_url || ''}
                        onChange={(e) =>
                            onChange({
                                ...provider,
                                config_json: { ...provider.config_json, base_url: e.target.value },
                            })
                        }
                        placeholder="https://api..."
                    />
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="outline" onClick={onClose}>
                        {t('admin.cancel')}
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={!provider.provider_id}
                    >
                        {t('admin.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
