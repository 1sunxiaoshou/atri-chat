import React from 'react';
import { Model } from '../../../types';
import { Modal, Button, Input, Select } from '../../ui';
import { cn } from '../../../utils/cn';

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    model: Partial<Model> | null;
    onSave: () => void;
    onChange: (model: Partial<Model>) => void;
}

const allCapabilities = [
    'vision',
    'document',
    'video',
    'audio',
    'reasoning',
    'tool_use',
    'web_search',
];

export const ModelModal: React.FC<ModelModalProps> = ({
    isOpen,
    onClose,
    model,
    onSave,
    onChange,
}) => {
    if (!model) return null;

    const toggleCapability = (capability: string) => {
        const capabilities = model.capabilities || [];
        const index = capabilities.indexOf(capability);
        onChange({
            ...model,
            capabilities:
                index > -1
                    ? capabilities.filter(c => c !== capability)
                    : [...capabilities, capability],
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={model.model_id ? '编辑模型' : '添加模型'}
        >
            <div className="p-6 space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        基本信息
                    </h4>
                    <Input
                        label="模型 ID"
                        value={model.model_id || ''}
                        onChange={(e) => onChange({ ...model, model_id: e.target.value })}
                        placeholder="e.g. gpt-4"
                    />
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">模型类型</label>
                        <Select
                            value={model.model_type || 'chat'}
                            onChange={(val) => onChange({ ...model, model_type: val as any })}
                            options={[
                                { label: '聊天模型', value: 'chat' },
                                { label: '嵌入模型', value: 'embedding' },
                                { label: '重排模型', value: 'rerank' },
                            ]}
                        />
                    </div>
                </div>

                {/* 模型能力 */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        模型能力
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {allCapabilities.map((cap) => (
                            <button
                                key={cap}
                                onClick={() => toggleCapability(cap)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs border transition-all",
                                    (model.capabilities || []).includes(cap)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                                )}
                            >
                                {cap.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="outline" onClick={onClose}>
                        取消
                    </Button>
                    <Button onClick={onSave} disabled={!model.model_id}>
                        保存
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
