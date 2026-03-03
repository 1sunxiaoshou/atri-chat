import React from 'react';
import { Edit2, Trash, Volume2, PackageSearch } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button } from '../../ui';

interface VoiceAsset {
    id: string;
    provider_id: string;
    name: string;
    voice_config: Record<string, any>;
    created_at: string;
    updated_at: string;
    provider?: {
        id: string;
        name: string;
        provider_type: string;
    };
}

interface VoiceTableProps {
    voices: VoiceAsset[];
    onEditVoice: (voice: VoiceAsset) => void;
    onDeleteVoice: (voiceId: string) => void;
}

const VoiceTable: React.FC<VoiceTableProps> = ({
    voices,
    onEditVoice,
    onDeleteVoice,
}) => {
    const { t } = useLanguage();

    return (
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 backdrop-blur-sm sticky top-0 z-10 border-b border-border">
                    <tr>
                        <th className="pl-6 pr-4 py-3 font-medium text-muted-foreground">
                            {t('admin.voiceName')}
                        </th>
                        <th className="px-4 py-3 font-medium text-muted-foreground">
                            {t('admin.created')}
                        </th>
                        <th className="pl-4 pr-6 py-3 w-20"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {voices.length > 0 ? (
                        voices.map((voice) => (
                            <tr
                                key={voice.id}
                                className="group hover:bg-muted/20 transition-colors"
                            >
                                <td className="pl-6 pr-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <Volume2 size={16} className="text-primary flex-shrink-0" />
                                        <span className="font-medium">{voice.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-muted-foreground">
                                    {new Date(voice.created_at).toLocaleDateString()}
                                </td>
                                <td className="pl-4 pr-6 py-4">
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => onEditVoice(voice)}
                                        >
                                            <Edit2 size={14} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => onDeleteVoice(voice.id)}
                                        >
                                            <Trash size={14} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                                        <PackageSearch size={32} className="text-muted-foreground" />
                                    </div>
                                    <p className="font-medium text-foreground mb-1">
                                        {t('admin.voicesNotFound')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('admin.adjustSearchOrAdd')}
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

export default VoiceTable;
