import React, { useState, useEffect } from 'react';
import { Save, ChevronLeft, Sparkle, Activity, User } from 'lucide-react';
import { Character, Model, Avatar, VoiceAsset, Motion } from '../../../types';
import { buildAvatarUrl } from '../../../utils/url';
import { useLanguage } from '../../../contexts/LanguageContext';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui';
import { avatarsApi, voiceAssetsApi, motionsApi, api } from '../../../services/api/index';
import { PersonaTab, AssetsTab, MotionTab } from './tabs';

interface LocalMotionBinding {
    motion_id: string;
    category: 'initial' | 'idle' | 'thinking' | 'reply';
}

interface CharacterEditorProps {
    character: Character;
    models: Model[];
    onSave: (character: Character, motionBindings?: LocalMotionBinding[]) => Promise<void>;
    onBack: () => void;
}

type TabType = 'persona' | 'assets' | 'motion';

export const CharacterEditor: React.FC<CharacterEditorProps> = ({
    character: initialCharacter,
    models,
    onSave,
    onBack
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabType>('persona');
    const [character, setCharacter] = useState<Character>(initialCharacter);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingPortraitFile, setPendingPortraitFile] = useState<File | null>(null);

    // 本地动作绑定状态（仅用于新建角色）
    const [localMotionBindings, setLocalMotionBindings] = useState<LocalMotionBinding[]>([]);

    // 新架构：加载形象、音色和动作资产
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [voiceAssets, setVoiceAssets] = useState<VoiceAsset[]>([]);
    const [motions, setMotions] = useState<Motion[]>([]);
    const [isLoadingAssets, setIsLoadingAssets] = useState(true);

    // 过滤已启用的模型
    const enabledModels = models.filter(m => m.enabled);

    // 获取当前选中的资产
    const selectedAvatar = avatars.find(a => a.id === character.avatar_id);

    // 加载资产数据
    useEffect(() => {
        const loadAssets = async () => {
            try {
                setIsLoadingAssets(true);
                const [avatarsRes, voicesRes, motionsRes] = await Promise.all([
                    avatarsApi.getAvatars(),
                    voiceAssetsApi.getVoiceAssets(),
                    motionsApi.getMotions()
                ]);

                if (avatarsRes.code === 200) {
                    setAvatars(avatarsRes.data || []);
                }
                if (voicesRes.code === 200) {
                    setVoiceAssets(voicesRes.data || []);
                }
                if (motionsRes.code === 200) {
                    setMotions(motionsRes.data || []);
                }
            } catch (error) {
                console.error(t('character.loadAssetsFailed'), error);
            } finally {
                setIsLoadingAssets(false);
            }
        };

        loadAssets();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 如果有待上传的立绘文件，先上传
            if (pendingPortraitFile) {
                const uploadRes = await api.uploadPortrait(pendingPortraitFile);
                if (uploadRes.code === 200 && uploadRes.data?.url) {
                    // 更新角色的 portrait_url
                    character.portrait_url = uploadRes.data.url;
                } else {
                    throw new Error(t('character.portraitUploadFailed'));
                }
            }

            // 如果是新建角色，传递动作绑定
            if (!character.id && localMotionBindings.length > 0) {
                await onSave(character, localMotionBindings);
            } else {
                await onSave(character);
            }

            // 清除待上传文件
            setPendingPortraitFile(null);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'persona' as TabType, icon: Sparkle, label: t('admin.persona') },
        { id: 'assets' as TabType, icon: User, label: t('admin.assetsAndVoice') },
        { id: 'motion' as TabType, icon: Activity, label: t('admin.motion') },
    ];

    // 获取显示的头像 URL（优先使用 portrait_url，其次使用 avatar thumbnail）
    const getDisplayImageUrl = () => {
        if (character.portrait_url) {
            return character.portrait_url.startsWith('data:')
                ? character.portrait_url
                : buildAvatarUrl(character.portrait_url);
        }
        if (selectedAvatar?.thumbnail_url) {
            return buildAvatarUrl(selectedAvatar.thumbnail_url);
        }
        return null;
    };

    const displayImageUrl = getDisplayImageUrl();

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Simplified Header */}
            <div className="flex-shrink-0 border-b border-border bg-card">
                <div className="flex items-center gap-4 px-4 py-3">
                    {/* 返回按钮 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0"
                    >
                        <ChevronLeft size={20} />
                    </Button>

                    {/* 圆形头像 */}
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted shrink-0">
                        {displayImageUrl ? (
                            <img
                                src={displayImageUrl}
                                alt={character.name || t('character.characterAvatar')}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                                <User size={64} className="opacity-20 mb-4" />
                                <p className="text-sm text-center">{t('admin.avatar')}</p>
                            </div>
                        )}
                    </div>

                    {/* 角色名称 */}
                    <h2 className="text-base font-bold text-foreground truncate flex-1">
                        {character.name || t('admin.createCharacter')}
                    </h2>

                    {/* 保存按钮 */}
                    <Button
                        onClick={handleSave}
                        disabled={!character.name || isSaving}
                        className="shrink-0"
                    >
                        <Save size={16} className="mr-2" />
                        {isSaving ? t('admin.saving') : t('admin.save')}
                    </Button>
                </div>

                {/* Tabs Nav */}
                <div className="flex border-t border-border px-4 overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                <div className={cn("h-full p-6", activeTab !== 'persona' && "hidden")}>
                    <PersonaTab
                        character={character}
                        models={enabledModels}
                        voiceAssets={voiceAssets}
                        onChange={setCharacter}
                        onPortraitUpload={(file) => {
                            // 保存文件对象，稍后上传
                            setPendingPortraitFile(file);

                            // 本地预览
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const url = event.target?.result as string;
                                setCharacter({ ...character, portrait_url: url });
                            };
                            reader.readAsDataURL(file);
                        }}
                    />
                </div>
                <div className={cn("h-full p-6", activeTab !== 'assets' && "hidden")}>
                    <AssetsTab
                        character={character}
                        avatars={avatars}
                        motions={motions}
                        isLoadingAssets={isLoadingAssets}
                        localMotionBindings={localMotionBindings}
                        onChange={setCharacter}
                        onLocalBindingsChange={setLocalMotionBindings}
                    />
                </div>
                <div className={cn("h-full p-6", activeTab !== 'motion' && "hidden")}>
                    <MotionTab
                        character={character}
                        motions={motions}
                        localMotionBindings={localMotionBindings}
                        onLocalBindingsChange={setLocalMotionBindings}
                    />
                </div>
            </div>
        </div>
    );
};
