import React from 'react';
import { Plus, Edit2, Trash } from 'lucide-react';
import { Provider } from '../../../types';
import { ProviderIcon } from '@/src/components/ProviderIcon';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

interface ProviderListProps {
    providers: Provider[];
    selectedProvider: string | null;
    onSelectProvider: (providerId: string) => void;
    onEditProvider: (provider: Provider) => void;
    onDeleteProvider: (providerId: string) => void;
    onAddProvider: () => void;
    getModelCount: (providerId: string) => number;
}

export const ProviderList: React.FC<ProviderListProps> = ({
    providers,
    selectedProvider,
    onSelectProvider,
    onEditProvider,
    onDeleteProvider,
    onAddProvider,
    getModelCount,
}) => {
    return (
        <aside className="w-full h-full flex flex-col border-r border-border bg-muted/20">
            <div className="h-16 px-4 border-b border-border flex justify-between items-center bg-background">
                <h3 className="text-sm font-bold text-foreground">模型供应商</h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {providers.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {providers.map((provider) => (
                    <div
                        key={provider.provider_id}
                        onClick={() => onSelectProvider(provider.provider_id)}
                        className={cn(
                            "group relative flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200",
                            selectedProvider === provider.provider_id
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {/* 左侧选中指示条 - 调整到容器外侧 */}
                        {selectedProvider === provider.provider_id && (
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-1 bg-primary rounded-full" />
                        )}

                        {/* Logo */}
                        <div
                            className={cn(
                                "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center border transition-colors",
                                selectedProvider === provider.provider_id
                                    ? "bg-background border-primary/20"
                                    : "bg-muted/50 border-border"
                            )}
                        >
                            <ProviderIcon
                                templateType={provider.template_type}
                                size={24}
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <span className="truncate text-sm">{provider.provider_id}</span>
                                <span className="text-[10px] bg-muted/50 px-1.5 rounded text-muted-foreground ml-2">
                                    {getModelCount(provider.provider_id)}
                                </span>
                            </div>
                        </div>

                        {/* Actions: 仅 hover 显示 */}
                        <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur rounded-md shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditProvider(provider);
                                }}
                            >
                                <Edit2 size={12} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteProvider(provider.provider_id);
                                }}
                            >
                                <Trash size={12} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-border bg-background">
                <Button onClick={onAddProvider} className="w-full" size="sm">
                    <Plus size={16} className="mr-2" />
                    添加供应商
                </Button>
            </div>
        </aside>
    );
};
