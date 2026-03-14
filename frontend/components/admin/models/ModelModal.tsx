import React, { useState, useEffect } from 'react';
import { Model, ModelParameterSchemaResponse } from '../../../types';
import { Modal, Button, Input, Select } from '../../ui';
import { cn } from '../../../utils/cn';
import { useLanguage } from '../../../contexts/LanguageContext';
import { modelsApi } from '../../../services/api';
import { DynamicParameterForm } from './DynamicParameterForm';

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    model: Partial<Model> | null;
    onSave: () => void;
    onChange: (model: Partial<Model>) => void;
}

const allCapabilities = [
    { key: 'has_vision', label: 'Vision' },
    { key: 'has_document', label: 'Document' },
    { key: 'has_video', label: 'Video' },
    { key: 'has_audio', label: 'Audio' },
    { key: 'has_reasoning', label: 'Reasoning' },
    { key: 'has_tool_use', label: 'Tool Use' },
];

export const ModelModal: React.FC<ModelModalProps> = ({
    isOpen,
    onClose,
    model,
    onSave,
    onChange,
}) => {
    const { t } = useLanguage();
    const [schema, setSchema] = useState<ModelParameterSchemaResponse | null>(null);
    const [isLoadingSchema, setIsLoadingSchema] = useState(false);

    useEffect(() => {
        if (isOpen && model?.id) {
            fetchSchema(model.id);
        } else {
            setSchema(null);
        }
    }, [isOpen, model?.id]);

    const fetchSchema = async (id: number) => {
        setIsLoadingSchema(true);
        try {
            const response = await modelsApi.getParameterSchema(id);
            if (response.code === 200) {
                setSchema(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch parameter schema:', error);
        } finally {
            setIsLoadingSchema(false);
        }
    };

    if (!model) return null;

    const toggleCapability = (capabilityKey: string) => {
        const currentValue = (model as any)[capabilityKey] || false;
        onChange({
            ...model,
            [capabilityKey]: !currentValue,
        });

        // 如果能力变化，可能需要重新获取 schema (特别是涉及 reasoning 时)
        if (model.id && capabilityKey === 'has_reasoning') {
            fetchSchema(model.id);
        }
    };

    const handleParameterChange = (key: string, value: any) => {
        onChange({
            ...model,
            parameters: {
                ...(model.parameters || {}),
                [key]: value
            }
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={model.model_id ? t('admin.editModel') : t('admin.addModel')}
            className="max-w-2xl"
        >
            <div className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
                {/* 基本信息 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.basicInfo')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('admin.modelId')}
                            value={model.model_id || ''}
                            onChange={(e) => onChange({ ...model, model_id: e.target.value })}
                            placeholder="e.g. gpt-4"
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">{t('admin.modelType')}</label>
                            <Select
                                value={model.model_type || 'chat'}
                                onChange={(val) => onChange({ ...model, model_type: val as any })}
                                options={[
                                    { label: t('admin.chatModel'), value: 'chat' },
                                    { label: t('admin.embeddingModel'), value: 'embedding' },
                                    { label: t('admin.rerankModel'), value: 'rerank' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* 模型能力 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {t('admin.modelCapabilities')}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {allCapabilities.map((cap) => (
                            <button
                                key={cap.key}
                                onClick={() => toggleCapability(cap.key)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs border transition-all",
                                    (model as any)[cap.key]
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                                )}
                            >
                                {cap.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 动态参数表单 */}
                {schema && (
                    <>
                        <DynamicParameterForm
                            title={t('admin.commonParameters')}
                            schema={schema.common_parameters}
                            values={model.parameters || {}}
                            onChange={handleParameterChange}
                        />
                        <DynamicParameterForm
                            title={t('admin.providerParameters')}
                            schema={schema.provider_parameters}
                            values={model.parameters || {}}
                            onChange={handleParameterChange}
                        />
                    </>
                )}

                {isLoadingSchema && (
                    <div className="flex justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border sticky bottom-0 bg-background/80 backdrop-blur-sm -mx-6 px-6 pb-2">
                    <Button variant="outline" onClick={onClose}>
                        {t('admin.cancel')}
                    </Button>
                    <Button onClick={onSave} disabled={!model.model_id}>
                        {t('admin.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
