import React from 'react';
import { Character, Model } from '../../../../types';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Input, Select } from '../../../ui';

interface PersonaTabProps {
    character: Character;
    models: Model[];
    onChange: (character: Character) => void;
}

export const PersonaTab: React.FC<PersonaTabProps> = ({
    character,
    models,
    onChange
}) => {
    const { t } = useLanguage();

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
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
                <Input
                    label={t('admin.description') || '角色描述'}
                    value={character.description || ''}
                    onChange={(e) => onChange({ ...character, description: e.target.value })}
                    placeholder="简短描述这个角色..."
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
                    value={character.primary_model_id}
                    onChange={(value) => {
                        const selectedModel = models.find(m => m.id === value);
                        onChange({
                            ...character,
                            primary_model_id: value,
                            primary_provider_id: selectedModel?.provider_id || ''
                        });
                    }}
                    options={models.filter(m => m.enabled).map(m => ({
                        label: m.model_id,
                        value: m.id, // 使用 UUID 作为 value
                        group: m.provider_id
                    }))}
                    placeholder={t('admin.selectModel') || 'Select Model'}
                    className="h-11"
                />
            </section>

            <section className="space-y-2 flex flex-col">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                    {t('admin.systemPrompt') || '系统提示词'}
                </label>
                <textarea
                    value={character.system_prompt}
                    onChange={(e) => onChange({ ...character, system_prompt: e.target.value })}
                    placeholder="你是一个友好、乐于助人的AI助手..."
                    className="w-full h-64 bg-muted/30 border border-border text-foreground rounded-2xl p-5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all resize-none custom-scrollbar"
                />
                <p className="text-[10px] text-muted-foreground italic">
                    {t('admin.systemPromptHelp') || '定义角色的性格、说话风格和行为方式'}
                </p>
            </section>
        </div>
    );
};
