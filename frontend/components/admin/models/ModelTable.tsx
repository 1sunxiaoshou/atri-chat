import React from 'react';
import { Edit2, Trash, PackageSearch, Eye, FileText, Video, Mic, Brain, Wrench, LucideIcon } from 'lucide-react';
import { Model } from '../../../types';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

interface ModelTableProps {
    models: Model[];
    onEditModel: (model: Model) => void;
    onDeleteModel: (id: number) => void;
    onToggleModel: (model: Model) => void;
}

const capabilityIcons: Record<string, LucideIcon> = {
    has_vision: Eye,
    has_document: FileText,
    has_video: Video,
    has_audio: Mic,
    has_reasoning: Brain,
    has_tool_use: Wrench,
};

export const ModelTable: React.FC<ModelTableProps> = ({
    models,
    onEditModel,
    onDeleteModel,
    onToggleModel,
}) => {
    // 获取模型的能力列表
    const getModelCapabilities = (model: Model): Array<{ key: string; label: string }> => {
        const capabilities: Array<{ key: string; label: string }> = [];

        if (model.has_vision) capabilities.push({ key: 'has_vision', label: 'Vision' });
        if (model.has_audio) capabilities.push({ key: 'has_audio', label: 'Audio' });
        if (model.has_video) capabilities.push({ key: 'has_video', label: 'Video' });
        if (model.has_reasoning) capabilities.push({ key: 'has_reasoning', label: 'Reasoning' });
        if (model.has_tool_use) capabilities.push({ key: 'has_tool_use', label: 'Tool Use' });
        if (model.has_document) capabilities.push({ key: 'has_document', label: 'Document' });
        return capabilities;
    };

    return (
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 backdrop-blur-sm sticky top-0 z-10 border-b border-border">
                    <tr>
                        <th className="pl-6 pr-4 py-3 font-medium text-muted-foreground">模型 ID</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground">能力</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground w-20">状态</th>
                        <th className="pl-4 pr-6 py-3 w-20"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {models.length > 0 ? (
                        models.map((model) => {
                            const capabilities = getModelCapabilities(model);
                            return (
                                <tr
                                    key={model.id}
                                    className="group hover:bg-muted/20 transition-colors"
                                >
                                    <td className="pl-6 pr-4 py-4 font-medium">{model.model_id}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-1.5 flex-wrap">
                                            {capabilities.length > 0 ? (
                                                capabilities.map((cap) => {
                                                    const Icon = capabilityIcons[cap.key];
                                                    return Icon ? (
                                                        <div
                                                            key={cap.key}
                                                            className="group/icon relative p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-help"
                                                        >
                                                            <Icon size={14} />
                                                            {/* Tooltip */}
                                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] bg-popover text-popover-foreground rounded shadow-sm opacity-0 group-hover/icon:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                                                {cap.label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            key={cap.key}
                                                            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20"
                                                        >
                                                            {cap.label}
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-xs text-muted-foreground">无能力</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <button
                                            onClick={() => onToggleModel(model)}
                                            className={cn(
                                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                                                model.enabled ? 'bg-emerald-500' : 'bg-muted'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                                                    model.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                                )}
                                            />
                                        </button>
                                    </td>
                                    <td className="pl-4 pr-6 py-4">
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => onEditModel(model)}
                                            >
                                                <Edit2 size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => onDeleteModel(model.id)}
                                            >
                                                <Trash size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={4} className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                                        <PackageSearch size={32} className="text-muted-foreground" />
                                    </div>
                                    <p className="font-medium text-foreground mb-1">未找到模型</p>
                                    <p className="text-xs text-muted-foreground">
                                        尝试调整搜索条件或分类筛选
                                    </p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
