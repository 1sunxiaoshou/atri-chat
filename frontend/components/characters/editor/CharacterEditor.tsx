import React, { useState, useEffect, useRef } from 'react';
import { Save, ChevronLeft, Sparkle, Headphones, Activity, User, Upload, Camera } from 'lucide-react';
import { Character, Model, Avatar, VoiceAsset, Motion } from '../../../types';
import { buildAvatarUrl } from '../../../utils/url';
import { useLanguage } from '../../../contexts/LanguageContext';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui';
import { avatarsApi, voiceAssetsApi, motionsApi } from '../../../services/api/index';
import { PersonaTab, AppearanceTab, VoiceTab, MotionTab } from './tabs';

interface LocalMotionBinding {
    motion_id: string;
    category: 'idle' | 'thinking' | 'reply';
    weight: number;
}

interface CharacterEditorProps {
    character: Character;
    models: Model[];
    onSave: (character: Character, motionBindings?: LocalMotionBinding[]) => Promise<void>;
    onBack: () => void;
}

type TabType = 'persona' | 'voice' | 'motion' | 'appearance';

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 本地动作绑定状态（仅用于新建角色）
    const [localMotionBindings, setLocalMotionBindings] = useState<LocalMotionBinding[]>([]);

    // 新架构：加载形象、音色和动作资产
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [voiceAssets, setVoiceAssets] = useState<VoiceAsset[]>([]);
    const [motions, setMotions] = useState<Motion[]>([]);
    const [isLoadingAssets, setIsLoadingAssets] = useState(true);

    // 获取当前选中的资产
    const selectedAvatar = avatars.find(a => a.id === character.avatar_id);
    const selectedVoice = voiceAssets.find(v => v.id === character.voice_asset_id);

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
                console.error('加载资产失败:', error);
            } finally {
                setIsLoadingAssets(false);
            }
        };

        loadAssets();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 如果是新建角色，传递动作绑定
            if (!character.id && localMotionBindings.length > 0) {
                await onSave(character, localMotionBindings);
            } else {
                await onSave(character);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // 处理立绘上传
    const handlePortraitClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        // 验证文件大小（最大 5MB）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过 5MB');
            return;
        }

        // TODO: 这里应该上传到服务器，获取 URL
        // 暂时使用本地预览
        const reader = new FileReader();
        reader.onload = (event) => {
            const url = event.target?.result as string;
            setCharacter({ ...character, portrait_url: url });
        };
        reader.readAsDataURL(file);
    };

    const tabs = [
        { id: 'persona' as TabType, icon: Sparkle, label: t('admin.persona') || '人设' },
        { id: 'appearance' as TabType, icon: User, label: t('admin.appearance') || '外观' },
        { id: 'voice' as TabType, icon: Headphones, label: t('admin.voice') || '声音' },
        { id: 'motion' as TabType, icon: Activity, label: t('admin.motion') || '动作' },
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
            {/* Header with Avatar and Actions */}
            <div className="flex-shrink-0 border-b border-border bg-card">
                <div className="flex items-center gap-4 p-4">
                    {/* 返回按钮 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0"
                    >
                        <ChevronLeft size={20} />
                    </Button>

                    {/* 角色头像/立绘 */}
                    <div className="relative group shrink-0">
                        <div
                            onClick={handlePortraitClick}
                            className="w-16 h-16 rounded-xl overflow-hidden border-2 border-border bg-muted cursor-pointer transition-all group-hover:border-primary group-hover:shadow-lg"
                        >
                            {displayImageUrl ? (
                                <img
                                    src={displayImageUrl}
                                    alt={character.name || '角色头像'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <User size={32} />
                                </div>
                            )}
                        </div>

                        {/* 上传提示 */}
                        <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <div className="text-white text-center">
                                <Camera size={20} className="mx-auto mb-1" />
                                <p className="text-[10px] font-medium">上传立绘</p>
                            </div>
                        </div>

                        {/* 隐藏的文件输入 */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* 角色信息 */}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-foreground truncate">
                            {character.name || '新建角色'}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {selectedAvatar && (
                                <span className="truncate">形象: {selectedAvatar.name}</span>
                            )}
                            {selectedVoice && (
                                <>
                                    <span>·</span>
                                    <span className="truncate">音色: {selectedVoice.name}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 保存按钮 */}
                    <Button
                        onClick={handleSave}
                        disabled={!character.name || isSaving}
                        className="shrink-0"
                    >
                        <Save size={16} className="mr-2" />
                        {isSaving ? '保存中...' : (t('admin.save') || '保存')}
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
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" style={{ minHeight: 0 }}>
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'persona' && (
                        <PersonaTab
                            character={character}
                            models={models}
                            onChange={setCharacter}
                        />
                    )}

                    {activeTab === 'appearance' && (
                        <AppearanceTab
                            character={character}
                            avatars={avatars}
                            isLoadingAssets={isLoadingAssets}
                            onChange={setCharacter}
                        />
                    )}

                    {activeTab === 'voice' && (
                        <VoiceTab
                            character={character}
                            voiceAssets={voiceAssets}
                            isLoadingAssets={isLoadingAssets}
                            onChange={setCharacter}
                        />
                    )}

                    {activeTab === 'motion' && (
                        <MotionTab
                            character={character}
                            motions={motions}
                            localMotionBindings={localMotionBindings}
                            onLocalBindingsChange={setLocalMotionBindings}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
