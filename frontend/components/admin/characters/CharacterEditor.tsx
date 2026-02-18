import React, { useState } from 'react';
import { Save, ChevronLeft, Sparkle, Headphones, Activity, User } from 'lucide-react';
import { Character, Model, VRMModel, VRMAnimation } from '../../../types';
import { buildAvatarUrl } from '../../../utils/url';
import { useLanguage } from '../../../contexts/LanguageContext';
import { cn } from '../../../utils/cn';
import { Button, Input, Select } from '../../ui';
import { AvatarEditor } from '../../shared/AvatarEditor';
import { api } from '../../../services/api/index';

interface CharacterEditorProps {
    character: Character;
    models: Model[];
    vrmModels: VRMModel[];
    ttsProviders: any[];
    onSave: (character: Character) => Promise<void>;
    onBack: () => void;
}

type TabType = 'persona' | 'voice' | 'motion' | 'appearance';

export const CharacterEditor: React.FC<CharacterEditorProps> = ({
    character: initialCharacter,
    models,
    vrmModels,
    ttsProviders,
    onSave,
    onBack
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabType>('persona');
    const [character, setCharacter] = useState<Character>(initialCharacter);
    const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Get animations for selected VRM model
    const selectedVrmModel = vrmModels.find(m => m.vrm_model_id === character.vrm_model_id);
    const animations = selectedVrmModel?.animations || [];

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(character);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'persona' as TabType, icon: Sparkle, label: t('admin.persona') || '人设' },
        { id: 'appearance' as TabType, icon: User, label: t('admin.appearance') || '外观' },
        { id: 'voice' as TabType, icon: Headphones, label: t('admin.voice') || '声音' },
        { id: 'motion' as TabType, icon: Activity, label: t('admin.motion') || '动作' },
    ];

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Left: Preview Area */}
            <div className="relative flex-1 bg-slate-900 overflow-hidden">
                {/* Top Actions */}
                <div className="absolute top-6 left-6 z-10">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-white/70 hover:text-white transition-colors bg-black/20 backdrop-blur-lg px-4 py-2 rounded-xl border border-white/10"
                    >
                        <ChevronLeft size={18} strokeWidth={2.5} />
                        {t('admin.back') || '返回'}
                    </button>
                </div>

                {/* Character Preview */}
                <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                        {/* Avatar Display */}
                        <div className="w-64 h-64 mx-auto rounded-3xl overflow-hidden ring-4 ring-white/10 shadow-2xl bg-slate-800 mb-6">
                            <img
                                src={buildAvatarUrl(character.avatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name}`}
                                alt={character.name}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Character Info */}
                        <h2 className="text-2xl font-bold text-white mb-2">{character.name || 'Unnamed Character'}</h2>
                        <p className="text-white/50 text-sm font-mono tracking-widest uppercase">
                            {character.vrm_model_id ? `VRM: ${character.vrm_model_id}` : 'No VRM Model'}
                        </p>
                    </div>
                </div>

                {/* Floating Animation Test Bar */}
                {animations.length > 0 && (
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 max-w-[90%] overflow-x-auto">
                        {animations.slice(0, 6).map(anim => (
                            <button
                                key={anim.animation_id}
                                className="px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/20 rounded-xl transition-all whitespace-nowrap"
                                title={anim.name}
                            >
                                {anim.name_cn || anim.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: Config Area */}
            <div className="w-[500px] flex flex-col border-l border-border shadow-2xl z-20 bg-card">
                {/* Tabs Nav */}
                <div className="flex border-b border-border px-4">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex-1 flex flex-col items-center py-4 gap-1 text-xs font-bold border-b-2 transition-all",
                                    activeTab === tab.id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {/* Persona Tab */}
                    {activeTab === 'persona' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <section>
                                <Input
                                    label={t('admin.name') || '角色名称'}
                                    value={character.name}
                                    onChange={(e) => setCharacter({ ...character, name: e.target.value })}
                                    placeholder="e.g. Coding Assistant"
                                    required
                                    className="h-11"
                                />
                            </section>

                            <section>
                                <Input
                                    label={t('admin.description') || '角色描述'}
                                    value={character.description || ''}
                                    onChange={(e) => setCharacter({ ...character, description: e.target.value })}
                                    placeholder="Short description..."
                                    className="h-11"
                                />
                            </section>

                            <section>
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-2">
                                    {t('admin.defaultModel') || '默认模型'}
                                </label>
                                <Select
                                    value={character.primary_model_id}
                                    onChange={(value) => {
                                        const selectedModel = models.find(m => m.model_id === value);
                                        setCharacter({
                                            ...character,
                                            primary_model_id: value,
                                            primary_provider_id: selectedModel?.provider_id || ''
                                        });
                                    }}
                                    options={models.filter(m => m.enabled).map(m => ({
                                        label: m.model_id,
                                        value: m.model_id,
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
                                    onChange={(e) => setCharacter({ ...character, system_prompt: e.target.value })}
                                    placeholder="You are a helpful AI assistant..."
                                    className="w-full h-64 bg-muted/30 border border-border text-foreground rounded-2xl p-5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all resize-none custom-scrollbar"
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    {t('admin.systemPromptHelp') || '定义角色的性格、说话风格和行为方式'}
                                </p>
                            </section>
                        </div>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <section>
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-3">
                                    {t('admin.avatar') || '头像'}
                                </label>
                                <div
                                    className="relative group cursor-pointer mx-auto w-40 h-40"
                                    onClick={() => setIsAvatarEditorOpen(true)}
                                >
                                    <div className="w-full h-full rounded-2xl overflow-hidden ring-4 ring-background shadow-2xl bg-muted group-hover:ring-primary/20 transition-all">
                                        <img
                                            src={buildAvatarUrl(character.avatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name}`}
                                            alt={character.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    </div>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 backdrop-blur-[2px]">
                                        <Save size={18} className="text-white mb-1" />
                                        <span className="text-white text-[10px] font-black uppercase tracking-widest">
                                            {t('admin.clickEdit') || '点击编辑'}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-2">
                                    VRM Model
                                </label>
                                <Select
                                    value={character.vrm_model_id || ''}
                                    onChange={(value) => setCharacter({ ...character, vrm_model_id: value })}
                                    options={[
                                        { label: 'None', value: '' },
                                        ...vrmModels.map(m => ({
                                            label: m.name || m.vrm_model_id,
                                            value: m.vrm_model_id
                                        }))
                                    ]}
                                    placeholder="Select VRM"
                                    className="h-11"
                                />
                            </section>

                            <section>
                                <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                                        <strong>💡 提示:</strong> VRM 模型用于 3D 角色展示。上传 VRM 文件后可在此选择。
                                    </p>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* Voice Tab */}
                    {activeTab === 'voice' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <section>
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] block mb-2">
                                    {t('admin.ttsConfig') || 'TTS 配置'}
                                </label>
                                <Select
                                    value={character.tts_id || ''}
                                    onChange={(value) => setCharacter({ ...character, tts_id: value })}
                                    options={[
                                        { label: 'None', value: '' },
                                        ...ttsProviders.map((p: any) => ({
                                            label: p.name || p.id,
                                            value: p.id
                                        }))
                                    ]}
                                    placeholder="Select TTS"
                                    className="h-11"
                                />
                            </section>

                            <section>
                                <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                    <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
                                        <strong>💡 提示:</strong> 选择 TTS 引擎后，角色的回复将自动转换为语音。
                                    </p>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* Motion Tab */}
                    {activeTab === 'motion' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                                    <strong>💡 提示:</strong> 动作映射允许 AI 根据对话的情感内容自动触发 VRM 模型动画。
                                </p>
                            </div>

                            {/* Motion Mapping List */}
                            {character.vrm_model_id && animations.length > 0 ? (
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                                        情感动作映射
                                    </label>
                                    {['开心', '难过', '愤怒', '惊讶', '思考', '害羞'].map(emotion => (
                                        <div
                                            key={emotion}
                                            className="flex items-center justify-between p-3 border border-border rounded-xl hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="text-sm font-bold text-foreground">{emotion}</span>
                                            <select className="text-xs bg-background border border-border rounded-lg p-1.5 outline-none font-medium text-primary">
                                                <option value="">未设置</option>
                                                {animations.map(anim => (
                                                    <option key={anim.animation_id} value={anim.animation_id}>
                                                        {anim.name_cn || anim.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Activity size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">
                                        {character.vrm_model_id
                                            ? '该 VRM 模型暂无动画'
                                            : '请先选择 VRM 模型'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-border flex gap-3 bg-muted/10 shrink-0">
                    <Button
                        variant="outline"
                        onClick={onBack}
                        className="flex-1"
                        disabled={isSaving}
                    >
                        {t('admin.cancel') || '取消'}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!character.name || !character.primary_model_id || isSaving}
                        className="flex-1"
                    >
                        <Save size={18} className="mr-2" />
                        {isSaving ? '保存中...' : (t('admin.save') || '保存')}
                    </Button>
                </div>
            </div>

            {/* Avatar Editor Modal */}
            {isAvatarEditorOpen && (
                <AvatarEditor
                    currentAvatar={character.avatar || ''}
                    onSave={async (avatarUrl) => {
                        try {
                            let finalAvatarUrl = avatarUrl;

                            // If it's a base64 data URL, upload it first
                            if (avatarUrl.startsWith('data:')) {
                                const response = await fetch(avatarUrl);
                                const blob = await response.blob();
                                const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
                                const result = await api.uploadAvatar(file);
                                if (result.code === 200) {
                                    finalAvatarUrl = result.data.url;
                                } else {
                                    alert('头像上传失败');
                                    return;
                                }
                            }

                            setCharacter({ ...character, avatar: finalAvatarUrl });
                            setIsAvatarEditorOpen(false);
                        } catch (error) {
                            console.error('头像保存失败:', error);
                            alert('头像保存失败，请重试');
                        }
                    }}
                    onCancel={() => setIsAvatarEditorOpen(false)}
                />
            )}
        </div>
    );
};
