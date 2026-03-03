import React, { useState, useMemo } from 'react';
import { User, Mic, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { Character, Avatar, VoiceAsset } from '../../../../types';
import { buildAvatarUrl } from '../../../../utils/url';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Input, Button } from '../../../ui';
import { cn } from '../../../../utils/cn';

interface AssetsTabProps {
    character: Character;
    avatars: Avatar[];
    voiceAssets: VoiceAsset[];
    isLoadingAssets: boolean;
    onChange: (character: Character) => void;
}

export const AssetsTab: React.FC<AssetsTabProps> = ({
    character,
    avatars,
    voiceAssets,
    isLoadingAssets,
    onChange
}) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredVoices = useMemo(() => {
        if (!searchQuery.trim()) return voiceAssets;
        const query = searchQuery.toLowerCase();
        return voiceAssets.filter(voice =>
            voice.name.toLowerCase().includes(query) ||
            voice.provider?.name.toLowerCase().includes(query) ||
            voice.provider?.provider_type.toLowerCase().includes(query)
        );
    }, [voiceAssets, searchQuery]);

    const selectedAvatar = avatars.find(a => a.id === character.avatar_id);
    const currentAvatarIndex = selectedAvatar ? avatars.findIndex(a => a.id === selectedAvatar.id) : -1;

    const handlePreviousAvatar = () => {
        if (avatars.length === 0) return;

        if (currentAvatarIndex === -1) {
            const firstAvatar = avatars[0];
            if (firstAvatar) {
                onChange({ ...character, avatar_id: firstAvatar.id });
            }
        } else if (currentAvatarIndex > 0) {
            const prevAvatar = avatars[currentAvatarIndex - 1];
            if (prevAvatar) {
                onChange({ ...character, avatar_id: prevAvatar.id });
            }
        } else {
            const lastAvatar = avatars[avatars.length - 1];
            if (lastAvatar) {
                onChange({ ...character, avatar_id: lastAvatar.id });
            }
        }
    };

    const handleNextAvatar = () => {
        if (avatars.length === 0) return;

        if (currentAvatarIndex === -1) {
            const firstAvatar = avatars[0];
            if (firstAvatar) {
                onChange({ ...character, avatar_id: firstAvatar.id });
            }
        } else if (currentAvatarIndex < avatars.length - 1) {
            const nextAvatar = avatars[currentAvatarIndex + 1];
            if (nextAvatar) {
                onChange({ ...character, avatar_id: nextAvatar.id });
            }
        } else {
            const firstAvatar = avatars[0];
            if (firstAvatar) {
                onChange({ ...character, avatar_id: firstAvatar.id });
            }
        }
    };

    const handleSelectVoice = (voiceId: string) => {
        if (character.voice_asset_id === voiceId) {
            onChange({ ...character, voice_asset_id: undefined });
        } else {
            onChange({ ...character, voice_asset_id: voiceId });
        }
    };

    if (isLoadingAssets) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('admin.loading')}</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
            <div className="flex gap-6 flex-1 min-h-0">
                {/* 左侧：3D 模型预览 */}
                <div className="w-[35%] flex flex-col gap-4">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                        {t('admin.avatar')}
                        <span className="text-[10px] font-normal normal-case tracking-normal ml-2 opacity-60">
                            ({t('admin.optional')})
                        </span>
                    </label>

                    {avatars.length === 0 ? (
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                <strong>⚠️ {t('admin.tip')}:</strong> {t('admin.noAvatarsAvailable')}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 rounded-xl overflow-hidden border-2 border-border bg-muted relative group">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handlePreviousAvatar}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                                >
                                    <ChevronLeft size={20} />
                                </Button>

                                {selectedAvatar ? (
                                    selectedAvatar.thumbnail_url ? (
                                        <img
                                            src={buildAvatarUrl(selectedAvatar.thumbnail_url)}
                                            alt={selectedAvatar.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            <User size={80} />
                                        </div>
                                    )
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                                                <User size={40} className="text-muted-foreground" />
                                            </div>
                                            <p className="text-xs text-muted-foreground">{t('admin.notSelected')}</p>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleNextAvatar}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                                >
                                    <ChevronRight size={20} />
                                </Button>
                            </div>

                            <div className="text-center py-2 border-t border-border">
                                <p className="text-sm font-medium">{selectedAvatar?.name || t('admin.modelName')}</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="w-px bg-border"></div>

                {/* 右侧：音色列表 */}
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                        {t('admin.voiceAsset')}
                        <span className="text-[10px] font-normal normal-case tracking-normal ml-2 opacity-60">
                            ({t('admin.optional')})
                        </span>
                    </label>

                    {voiceAssets.length === 0 ? (
                        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                <strong>⚠️ {t('admin.tip')}:</strong> {t('admin.noVoicesAvailable')}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <Input
                                    type="text"
                                    placeholder={t('admin.searchVoiceProvider')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-11"
                                />
                            </div>

                            <div className="flex-1 overflow-auto custom-scrollbar rounded-lg border border-border">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50 backdrop-blur-sm sticky top-0 z-10 border-b border-border">
                                        <tr>
                                            <th className="pl-6 pr-4 py-3 font-medium text-muted-foreground">{t('admin.name')}</th>
                                            <th className="px-4 py-3 font-medium text-muted-foreground">{t('admin.providerName')}</th>
                                            <th className="px-4 py-3 font-medium text-muted-foreground">{t('admin.providerType')}</th>
                                            <th className="pl-4 pr-6 py-3 w-20"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredVoices.length > 0 ? (
                                            filteredVoices.map((voice) => {
                                                const isSelected = character.voice_asset_id === voice.id;
                                                return (
                                                    <tr
                                                        key={voice.id}
                                                        onClick={() => handleSelectVoice(voice.id)}
                                                        className={cn(
                                                            "group cursor-pointer transition-colors",
                                                            isSelected
                                                                ? "bg-primary/5 hover:bg-primary/10"
                                                                : "hover:bg-muted/20"
                                                        )}
                                                    >
                                                        <td className="pl-6 pr-4 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                                    isSelected ? "bg-primary/10" : "bg-muted"
                                                                )}>
                                                                    <Mic size={16} className={cn(
                                                                        isSelected ? "text-primary" : "text-muted-foreground"
                                                                    )} />
                                                                </div>
                                                                <span className={cn(
                                                                    "font-medium",
                                                                    isSelected ? "text-primary" : "text-foreground"
                                                                )}>
                                                                    {voice.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-muted-foreground">
                                                            {voice.provider?.name || t('admin.unknownProvider')}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className="px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground">
                                                                {voice.provider?.provider_type || t('admin.unknown')}
                                                            </span>
                                                        </td>
                                                        <td className="pl-4 pr-6 py-4">
                                                            {isSelected && (
                                                                <ChevronRight size={20} className="text-primary" />
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center">
                                                    <p className="text-sm text-muted-foreground">{t('admin.noMatchingVoices')}</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
