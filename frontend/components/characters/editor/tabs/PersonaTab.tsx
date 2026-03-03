import React, { useRef } from 'react';
import { Camera, User } from 'lucide-react';
import { Character, Model } from '../../../../types';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../../../utils/url';
import { Input, Select } from '../../../ui';

interface PersonaTabProps {
    character: Character;
    models: Model[];
    onChange: (character: Character) => void;
    onPortraitUpload?: (file: File) => void;
}

export const PersonaTab: React.FC<PersonaTabProps> = ({
    character,
    models,
    onChange,
    onPortraitUpload
}) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        if (onPortraitUpload) {
            onPortraitUpload(file);
        } else {
            // 默认行为：本地预览
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                onChange({ ...character, portrait_url: url });
            };
            reader.readAsDataURL(file);
        }
    };

    // 获取显示的立绘 URL
    const getDisplayImageUrl = () => {
        if (character.portrait_url) {
            return character.portrait_url.startsWith('data:')
                ? character.portrait_url
                : buildAvatarUrl(character.portrait_url);
        }
        return null;
    };

    const displayImageUrl = getDisplayImageUrl();

    return (
        <div className="h-full flex gap-6 animate-in slide-in-from-right-4 duration-300">
            {/* 左侧：立绘上传卡片 */}
            <div className="w-80 shrink-0">
                <div className="relative group h-full">
                    <div
                        onClick={handlePortraitClick}
                        className="h-full rounded-2xl overflow-hidden border-2 border-border bg-muted cursor-pointer transition-all group-hover:border-primary group-hover:shadow-lg flex items-center justify-center"
                    >
                        {displayImageUrl ? (
                            <img
                                src={displayImageUrl}
                                alt={character.name || '角色立绘'}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                                <User size={64} className="opacity-20 mb-4" />
                                <p className="text-sm text-center">点击上传角色立绘</p>
                                <p className="text-xs text-center mt-2 opacity-60">支持 JPG、PNG 格式<br />最大 5MB</p>
                            </div>
                        )}
                    </div>

                    {/* 上传提示覆盖层 */}
                    {displayImageUrl && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <div className="text-white text-center">
                                <Camera size={32} className="mx-auto mb-2" />
                                <p className="text-sm font-medium">更换立绘</p>
                            </div>
                        </div>
                    )}

                    {/* 隐藏的文件输入 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>
            </div>

            {/* 右侧：表单区域 */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                <section>
                    <Input
                        label={t('admin.name') || '角色名称'}
                        value={character.name}
                        onChange={(e) => onChange({ ...character, name: e.target.value })}
                        placeholder="e.g. Coding Assistant"
                        required
                        className="h-11"
                    />
                </section>

                <section>
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-2">
                        {t('admin.defaultModel') || '默认模型'}
                        <span className="text-[10px] font-normal normal-case tracking-normal ml-2 opacity-60">
                            (可选，留空使用系统默认)
                        </span>
                    </label>
                    <Select
                        value={character.primary_model_id || ''}
                        onChange={(value) => {
                            const selectedModel = models.find(m => m.id === value);
                            onChange({
                                ...character,
                                primary_model_id: value || undefined,
                                primary_provider_id: selectedModel?.provider_id || ''
                            });
                        }}
                        options={models.filter(m => m.enabled).map(m => ({
                            label: m.model_id,
                            value: m.id,
                            group: m.provider_id
                        }))}
                        placeholder={t('admin.selectModel') || 'Select Model'}
                        className="h-11"
                    />
                </section>

                <section className="space-y-2 flex flex-col flex-1">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                        {t('admin.systemPrompt') || '系统提示词'}
                    </label>
                    <textarea
                        value={character.system_prompt}
                        onChange={(e) => onChange({ ...character, system_prompt: e.target.value })}
                        placeholder="你是一个友好、乐于助人的AI助手..."
                        className="w-full flex-1 min-h-[200px] bg-muted/30 border border-border text-foreground rounded-2xl p-5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all resize-none custom-scrollbar"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                        {t('admin.systemPromptHelp') || '定义角色的性格、说话风格和行为方式'}
                    </p>
                </section>
            </div>
        </div>
    );
};
