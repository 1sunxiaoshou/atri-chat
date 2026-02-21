import React from 'react';
import { Settings, Trash2, Plus, Power, PowerOff } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Card, CardContent } from '../../ui';
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
    onEdit: (provider: TTSProvider) => void;
    onDelete: (providerId: string) => void;
    onCreateVoice: (providerId: string) => void;
}

const ProviderList: React.FC<ProviderListProps> = ({
    providers,
    onEdit,
    onDelete,
    onCreateVoice
}) => {
    const { language } = useLanguage();

    if (providers.length === 0) {
        return (
            <Card className="bg-muted/20 border-dashed">
                <CardContent className="p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        {language === 'zh' ? '暂无 TTS 供应商' : 'No TTS providers'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {providers.map((provider) => (
                <Card key={provider.id} className={cn(
                    "transition-all hover:shadow-md",
                    !provider.enabled && "opacity-60"
                )}>
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{provider.name}</h4>
                                    {provider.enabled ? (
                                        <Power size={14} className="text-green-500" />
                                    ) : (
                                        <PowerOff size={14} className="text-muted-foreground" />
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {provider.provider_type}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>
                                        {language === 'zh' ? '音色数量' : 'Voices'}: {provider.voice_count}
                                    </span>
                                    <span>
                                        {language === 'zh' ? '创建于' : 'Created'}: {new Date(provider.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => onCreateVoice(provider.id)}
                                    title={language === 'zh' ? '添加音色' : 'Add voice'}
                                >
                                    <Plus size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => onEdit(provider)}
                                    title={language === 'zh' ? '编辑' : 'Edit'}
                                >
                                    <Settings size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => onDelete(provider.id)}
                                    title={language === 'zh' ? '删除' : 'Delete'}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default ProviderList;
