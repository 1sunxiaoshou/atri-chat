import React, { useRef, useState, useMemo } from 'react';
import { Camera, User } from 'lucide-react';
import { Character, Model, VoiceAsset } from '../../../../types';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../../../utils/url';
import { Input, Button } from '../../../ui';
import HierarchicalSelector, { HierarchicalItem } from '../../../ui/HierarchicalSelector';

interface PersonaTabProps {
    character: Character;
    models: Model[];
    voiceAssets: VoiceAsset[];
    onChange: (character: Character) => void;
    onPortraitUpload?: (file: File) => void;
}

export const PersonaTab: React.FC<PersonaTabProps> = ({
    character,
    models,
    voiceAssets,
    onChange,
    onPortraitUpload
}) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);

    const handlePortraitClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert(t('character.selectImageFile'));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert(t('character.imageSizeExceeded'));
            return;
        }

        if (onPortraitUpload) {
            onPortraitUpload(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                onChange({ ...character, portrait_url: url });
            };
            reader.readAsDataURL(file);
        }
    };

    const getDisplayImageUrl = () => {
        if (character.portrait_url) {
            return character.portrait_url.startsWith('data:')
                ? character.portrait_url
                : buildAvatarUrl(character.portrait_url);
        }
        return null;
    };

    const displayImageUrl = getDisplayImageUrl();

    // 转换模型列表为 HierarchicalItem 格式
    const hierarchicalModels = useMemo<HierarchicalItem[]>(() => {
        return models.map(model => ({
            id: model.id,
            label: model.model_id,
            category: model.provider_id,
            tags: model.capabilities
        }));
    }, [models]);

    // 转换语音资产列表为 HierarchicalItem 格式
    const hierarchicalVoices = useMemo<HierarchicalItem[]>(() => {
        return voiceAssets.map(voice => ({
            id: voice.id,
            label: voice.name,
            category: voice.provider?.name || voice.provider_id,
            tags: []
        }));
    }, [voiceAssets]);

    // 获取当前选中模型的显示名称
    const currentModel = models.find(m => m.id === character.primary_model_id);
    const currentModelName = currentModel
        ? `${currentModel.provider_id} / ${currentModel.model_id}`
        : t('admin.notSelected');

    // 获取当前选中语音的显示名称
    const currentVoice = voiceAssets.find(v => v.id === character.voice_asset_id);
    const currentVoiceName = currentVoice
        ? `${currentVoice.provider?.name || currentVoice.provider_id} / ${currentVoice.name}`
        : t('admin.notSelected');

    const handleModelSelect = (item: HierarchicalItem) => {
        onChange({ ...character, primary_model_id: item.id });
        setIsModelSelectorOpen(false);
    };

    const handleVoiceSelect = (item: HierarchicalItem) => {
        onChange({ ...character, voice_asset_id: item.id });
        setIsVoiceSelectorOpen(false);
    };

    return (
        <div className="h-full flex gap-6 animate-in slide-in-from-right-4 duration-300">
            {/* 左侧：立绘上传卡片保持不变，修复了重复上传Bug */}
            <div className="w-80 shrink-0">
                <div className="relative group h-full">
                    <div
                        onClick={handlePortraitClick}
                        className="h-full rounded-2xl overflow-hidden border-2 border-border bg-muted cursor-pointer transition-all group-hover:border-primary group-hover:shadow-lg flex items-center justify-center relative"
                    >
                        {displayImageUrl ? (
                            <img
                                src={displayImageUrl}
                                alt={character.name || t('character.characterPortrait')}
                                className="w-full h-full object-cover" // 改为 cover 避免留白，视你的需求而定
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                                <User size={64} className="opacity-20 mb-4" />
                                <p className="text-sm text-center">{t('character.uploadPortrait')}</p>
                                <p className="text-xs text-center mt-2 opacity-60">{t('character.supportedFormats')}<br />{t('character.maxSize')}</p>
                            </div>
                        )}

                        {/* 上传提示覆盖层 */}
                        <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity duration-200 ${displayImageUrl ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
                            <Camera size={32} className="text-white mb-2" />
                            <p className="text-sm font-medium text-white">{t('character.changePortrait')}</p>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} // 修复无法重复选相同图片的Bug
                        className="hidden"
                    />
                </div>
            </div>

            {/* 右侧：表单区域重构 */}
            <div className="flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-2 pb-2">
                {/* 1. 角色名称 */}
                <section>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-2">
                        {t('admin.name')}
                    </label>
                    <Input
                        value={character.name}
                        onChange={(e) => onChange({ ...character, name: e.target.value })}
                        placeholder="e.g. Coding Assistant"
                        required
                        className="h-12 rounded-xl text-lg bg-background border-border focus:bg-background"
                    />
                </section>

                {/* 2. 核心配置：模型与音色并排显示 */}
                <section className="grid grid-cols-2 gap-4">
                    {/* 模型选择按钮 */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                            {t('admin.defaultModel')}
                        </label>
                        <Button
                            variant="outline"
                            onClick={() => setIsModelSelectorOpen(true)}
                            className="w-full h-11 px-4 justify-start bg-muted/30 border-border/50 rounded-xl hover:bg-muted/50 hover:border-primary/30"
                        >
                            <span className="text-sm text-left truncate">
                                {currentModelName}
                            </span>
                        </Button>
                    </div>

                    {/* 音色选择按钮 */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                            {t('character.voice')}
                        </label>
                        <Button
                            variant="outline"
                            onClick={() => setIsVoiceSelectorOpen(true)}
                            className="w-full h-11 px-4 justify-start bg-muted/30 border-border/50 rounded-xl hover:bg-muted/50 hover:border-primary/30"
                        >
                            <span className="text-sm text-left truncate">
                                {currentVoiceName}
                            </span>
                        </Button>
                    </div>
                </section>

                {/* 3. 系统提示词 */}
                <section className="flex flex-col flex-1 mt-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 flex justify-between items-end">
                        <span>{t('admin.systemPrompt')}</span>
                    </label>
                    <textarea
                        value={character.system_prompt}
                        onChange={(e) => onChange({ ...character, system_prompt: e.target.value })}
                        placeholder="你是一个友好、乐于助人的AI助手..."
                        className="w-full flex-1 min-h-[220px] bg-muted/30 border border-border text-foreground rounded-xl p-5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none custom-scrollbar"
                    />
                    <p className="text-[10px] text-muted-foreground italic mt-2">
                        {t('admin.systemPromptHelp')}
                    </p>
                </section>
            </div>

            {/* Model Selector Modal */}
            <HierarchicalSelector
                isOpen={isModelSelectorOpen}
                onClose={() => setIsModelSelectorOpen(false)}
                items={hierarchicalModels}
                selectedId={character.primary_model_id}
                onSelect={handleModelSelect}
                title={t('admin.selectModel')}
                placeholder={t('admin.searchModel')}
            />

            {/* Voice Selector Modal */}
            <HierarchicalSelector
                isOpen={isVoiceSelectorOpen}
                onClose={() => setIsVoiceSelectorOpen(false)}
                items={hierarchicalVoices}
                selectedId={character.voice_asset_id}
                onSelect={handleVoiceSelect}
                title={t('character.selectVoice')}
                placeholder={t('character.searchVoice')}
                showTags={false}
            />
        </div>
    );
};