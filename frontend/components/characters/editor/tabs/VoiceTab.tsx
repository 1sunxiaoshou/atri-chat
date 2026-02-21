import React from 'react';
import { Character, VoiceAsset } from '../../../../types';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Select } from '../../../ui';

interface VoiceTabProps {
    character: Character;
    voiceAssets: VoiceAsset[];
    isLoadingAssets: boolean;
    onChange: (character: Character) => void;
}

export const VoiceTab: React.FC<VoiceTabProps> = ({
    character,
    voiceAssets,
    isLoadingAssets,
    onChange
}) => {
    const { t } = useLanguage();
    const selectedVoice = voiceAssets.find(v => v.id === character.voice_asset_id);

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <section>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-3">
                    {t('admin.voiceAsset') || '音色资产'}
                    <span className="text-[10px] font-normal normal-case tracking-normal ml-2 opacity-60">
                        (可选)
                    </span>
                </label>

                {isLoadingAssets ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">加载中...</p>
                    </div>
                ) : voiceAssets.length === 0 ? (
                    <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                            <strong>⚠️ 提示:</strong> 暂无可用音色资产，请先在管理面板的"语音"标签页中创建音色。
                        </p>
                    </div>
                ) : (
                    <>
                        <Select
                            value={character.voice_asset_id || ''}
                            onChange={(value) => onChange({ ...character, voice_asset_id: value })}
                            options={voiceAssets.map(v => ({
                                label: `${v.name} (${v.provider?.name || v.provider_id})`,
                                value: v.id,
                                group: v.provider?.provider_type
                            }))}
                            placeholder="选择音色资产"
                            className="h-11"
                        />

                        {selectedVoice && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                                <div className="text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">供应商:</span>
                                        <span className="font-medium">{selectedVoice.provider?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">类型:</span>
                                        <span className="font-medium">{selectedVoice.provider?.provider_type}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            <section>
                <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
                        <strong>💡 提示:</strong> 选择音色资产后，角色的回复将自动转换为语音。音色资产在管理面板的"语音"标签页中配置。
                    </p>
                </div>
            </section>
        </div>
    );
};
