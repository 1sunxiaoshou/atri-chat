import React from 'react';
import { Edit, Trash2, Volume2 } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Card, CardContent } from '../../ui';

interface VoiceAsset {
    id: string;
    provider_id: string;
    provider_name: string;
    provider_type: string;
    name: string;
    voice_config: Record<string, any>;
    created_at: string;
    updated_at: string;
}

interface VoiceListProps {
    voices: VoiceAsset[];
    onEdit: (voice: VoiceAsset) => void;
    onDelete: (voiceId: string) => void;
}

const VoiceList: React.FC<VoiceListProps> = ({
    voices,
    onEdit,
    onDelete
}) => {
    const { language } = useLanguage();

    if (voices.length === 0) {
        return (
            <Card className="bg-muted/20 border-dashed">
                <CardContent className="p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        {language === 'zh' ? '暂无音色资产' : 'No voice assets'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {voices.map((voice) => (
                <Card key={voice.id} className="transition-all hover:shadow-md">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <Volume2 size={16} className="text-primary" />
                                    <h4 className="font-medium">{voice.name}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {voice.provider_name} ({voice.provider_type})
                                </p>
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {language === 'zh' ? '创建于' : 'Created'}: {new Date(voice.created_at).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => onEdit(voice)}
                                    title={language === 'zh' ? '编辑' : 'Edit'}
                                >
                                    <Edit size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => onDelete(voice.id)}
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

export default VoiceList;
