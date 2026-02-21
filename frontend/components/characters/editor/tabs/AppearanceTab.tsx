import React from 'react';
import { User } from 'lucide-react';
import { Character, Avatar } from '../../../../types';
import { buildAvatarUrl } from '../../../../utils/url';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Select } from '../../../ui';

interface AppearanceTabProps {
    character: Character;
    avatars: Avatar[];
    isLoadingAssets: boolean;
    onChange: (character: Character) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
    character,
    avatars,
    isLoadingAssets,
    onChange
}) => {
    const { t } = useLanguage();
    const selectedAvatar = avatars.find(a => a.id === character.avatar_id);

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <section>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-3">
                    {t('admin.avatar') || '形象资产'}
                    <span className="text-[10px] font-normal normal-case tracking-normal ml-2 opacity-60">
                        (可选)
                    </span>
                </label>

                {isLoadingAssets ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">加载中...</p>
                    </div>
                ) : avatars.length === 0 ? (
                    <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                            <strong>⚠️ 提示:</strong> 暂无可用形象资产，请先在管理面板的"VRM 3D"标签页中上传 VRM 模型。
                        </p>
                    </div>
                ) : (
                    <>
                        <Select
                            value={character.avatar_id || ''}
                            onChange={(value) => onChange({ ...character, avatar_id: value })}
                            options={avatars.map(a => ({
                                label: a.name,
                                value: a.id
                            }))}
                            placeholder="选择形象资产"
                            className="h-11"
                        />

                        {character.avatar_id && selectedAvatar && (
                            <div className="mt-4 mx-auto w-40 h-40">
                                <div className="w-full h-full rounded-2xl overflow-hidden ring-4 ring-background shadow-2xl bg-muted">
                                    {selectedAvatar.thumbnail_url ? (
                                        <img
                                            src={buildAvatarUrl(selectedAvatar.thumbnail_url)}
                                            alt={selectedAvatar.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            <User size={48} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            <section>
                <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                        <strong>💡 提示:</strong> 形象资产是角色的 3D VRM 模型。在管理面板的"VRM 3D"标签页中上传和管理。
                    </p>
                </div>
            </section>
        </div>
    );
};
