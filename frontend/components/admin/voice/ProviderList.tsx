import React from 'react';
import { Plus, Edit2, Trash, Volume2, Power, PowerOff } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

interface TTSProvider {
    id: string;
    provider_type: string;
    name: string;
    config_payload: Record<string, any>;
    enabled: boolean;
    voice_count: number;
    created_at: string;
    updated_at: string;
}

interface ProviderListProps {
    providers: TTSProvider[];
    selectedProvider: string | null;
    onSelectProvider: (providerId: string) => void;
    onEditProvider: (provider: TTSProvider) => void;
    onDeleteProvider: (providerId: string) => void;
    onAddProvider: () => void;
    getVoiceCount: (providerId: string) => number;
}

const ProviderList: React.FC<ProviderListProps> = ({
    providers,
    selectedProvider,
    onSelectProvider,
    onEditProvider,
    onDeleteProvider,
    onAddProvider,
    getVoiceCount,
}) => {
    const { language } = useLanguage();

    return (
        <aside className="w-full h-full flex flex-col border-r border-border bg-muted/20">
            <div className="h-16 px-4 border-b border-border flex justify-between items-center bg-background">
                <h3 className="text-sm font-bold text-foreground">
                    {language === 'zh' ? 'TTS 供应商' : 'TTS Providers'}
                </h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {providers.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {providers.map((provider) => (
                    <div
                        key={provider.id}
                        onClick={() => onSelectProvider(provider.id)}
                        className={cn(
                            "group relative flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200",
                            selectedProvider === provider.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            !provider.enabled && "opacity-60"
                        )}
                    >
                        {/* 左侧选中指示条 */}
                        {selectedProvider === provider.id && (
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-1 bg-primary rounded-full" />
                        )}

                        {/* Icon */}
                        <div
                            className={cn(
                                "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center border transition-colors",
                                selectedProvider === provider.id
                                    ? "bg-background border-primary/20"
                                    : "bg-muted/50 border-border"
                            )}
                        >
                            <Volume2 size={16} className={cn(
                                selectedProvider === provider.id ? "text-primary" : "text-muted-foreground"
                            )} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm">{provider.name}</span>
                                {provider.enabled ? (
                                    <Power size={10} className="text-green-500 flex-shrink-0" />
                                ) : (
                                    <PowerOff size={10} className="text-muted-foreground flex-shrink-0" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground truncate">
                                    {provider.provider_type}
                                </span>
                                <span className="text-[10px] bg-muted/50 px-1.5 rounded text-muted-foreground">
                                    {getVoiceCount(provider.id)}
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
                                    onDeleteProvider(provider.id);
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
                    {language === 'zh' ? '添加供应商' : 'Add Provider'}
                </Button>
            </div>
        </aside>
    );
};

export default ProviderList;
