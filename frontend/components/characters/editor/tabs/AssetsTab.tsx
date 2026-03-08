import React, { useState, useMemo, useRef } from 'react';
import { Smile, Activity, Search, Info, Plus, X, ChevronRight, ChevronLeft, User, Box } from 'lucide-react';
import { Character, Avatar, Motion } from '../../../../types';
import { buildAvatarUrl } from '../../../../utils/url';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Input, Button } from '../../../ui';
import { VRMPreviewWithExpression, VRMPreviewWithExpressionHandle } from '../VRMPreviewWithExpression';
import HierarchicalSelector, { HierarchicalItem } from '../../../ui/HierarchicalSelector';
import { cn } from '../../../../utils/cn';

interface LocalMotionBinding {
    motion_id: string;
    category: 'initial' | 'idle' | 'thinking' | 'reply';
}

interface AssetsTabProps {
    character: Character;
    avatars: Avatar[];
    motions: Motion[];
    isLoadingAssets: boolean;
    localMotionBindings: LocalMotionBinding[];
    onChange: (character: Character) => void;
    onLocalBindingsChange: (bindings: LocalMotionBinding[]) => void;
}

export const AssetsTab: React.FC<AssetsTabProps> = ({
    character,
    avatars,
    motions,
    isLoadingAssets,
    localMotionBindings,
    onChange,
    onLocalBindingsChange
}) => {
    const { t, language } = useLanguage();
    const [activeTab, setActiveTab] = useState<'expressions' | 'motions'>('expressions');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedExpression, setSelectedExpression] = useState<string>('neutral');
    const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
    const vrmPreviewRef = useRef<VRMPreviewWithExpressionHandle | null>(null);

    const selectedAvatar = avatars.find(a => a.id === character.avatar_id);
    const currentAvatarIndex = selectedAvatar ? avatars.findIndex(a => a.id === selectedAvatar.id) : -1;

    // 转换 avatars 为 HierarchicalItem 格式
    const hierarchicalAvatars = useMemo<HierarchicalItem[]>(() => {
        return avatars.map(avatar => ({
            id: avatar.id,
            label: avatar.name,
            category: t('admin.vrm3d'),
            tags: avatar.available_expressions ? [`${avatar.available_expressions.length} ${t('character.expressions')}`] : [],
            icon: <Box size={20} className="text-primary" />
        }));
    }, [avatars, t, language]);

    // 获取表情标签的辅助函数（移除，不再需要翻译）
    // const getExpressionLabel = (name: string): string => {
    //     const labelMap = EXPRESSION_LABELS[name];
    //     if (!labelMap) return name;
    //     return language === 'zh' ? labelMap.zh : labelMap.en;
    // };

    // 获取当前模型的表情列表（直接使用模型的 available_expressions）
    const availableExpressions = selectedAvatar?.available_expressions || [];
    const expressions = availableExpressions.map(name => ({
        name
    }));

    const handleExpressionClick = (expName: string) => {
        setSelectedExpression(expName);
        // 通知 VRMPreview 加载表情
        if (vrmPreviewRef.current) {
            vrmPreviewRef.current.loadExpression(expName);
        }
    };

    const handleAvatarSelect = (item: HierarchicalItem) => {
        onChange({ ...character, avatar_id: item.id });
        setIsAvatarSelectorOpen(false);
    };

    const handlePreviousAvatar = () => {
        if (avatars.length === 0) return;

        if (currentAvatarIndex === -1) {
            onChange({ ...character, avatar_id: avatars[0]?.id });
        } else if (currentAvatarIndex > 0) {
            onChange({ ...character, avatar_id: avatars[currentAvatarIndex - 1]?.id });
        } else {
            onChange({ ...character, avatar_id: avatars[avatars.length - 1]?.id });
        }
    };

    const handleNextAvatar = () => {
        if (avatars.length === 0) return;

        if (currentAvatarIndex === -1) {
            onChange({ ...character, avatar_id: avatars[0]?.id });
        } else if (currentAvatarIndex < avatars.length - 1) {
            onChange({ ...character, avatar_id: avatars[currentAvatarIndex + 1]?.id });
        } else {
            onChange({ ...character, avatar_id: avatars[0]?.id });
        }
    };

    // 移除 toggleExpression，不再需要

    // 动作绑定相关函数
    const getBindingsByCategory = (category: LocalMotionBinding['category']) => {
        return localMotionBindings.filter(b => b.category === category);
    };

    const addMotionBinding = (motionId: string, category: LocalMotionBinding['category']) => {
        const newBinding: LocalMotionBinding = { motion_id: motionId, category };
        onLocalBindingsChange([...localMotionBindings, newBinding]);
    };

    const removeMotionBinding = (motionId: string, category: LocalMotionBinding['category']) => {
        onLocalBindingsChange(
            localMotionBindings.filter(b => !(b.motion_id === motionId && b.category === category))
        );
    };

    const getMotionName = (motionId: string) => {
        return motions.find(m => m.id === motionId)?.name || motionId;
    };

    if (isLoadingAssets) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{t('admin.loading')}</p>
            </div>
        );
    }

    return (
        <div className="h-full flex gap-6 animate-in slide-in-from-right-4 duration-300">
            {/* 左侧：3D 模型实时渲染 */}
            <div className="w-[400px] flex-shrink-0 flex flex-col gap-4">
                <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden h-[600px] relative group">
                    {selectedAvatar ? (
                        <>
                            <VRMPreviewWithExpression
                                ref={vrmPreviewRef}
                                modelUrl={buildAvatarUrl(selectedAvatar.file_url)}
                                className="w-full h-full"
                                autoRotate
                            />
                            {/* 顶部悬浮信息 */}
                            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                                <div className="bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs font-medium text-muted-foreground">
                                    {t('character.currentModel')}: {selectedAvatar.name}
                                </div>
                            </div>

                            {/* 切换按钮 */}
                            {avatars.length > 1 && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handlePreviousAvatar}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                                    >
                                        <ChevronLeft size={20} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleNextAvatar}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                                    >
                                        <ChevronRight size={20} />
                                    </Button>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                            <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                                    <User size={40} className="text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">{t('admin.notSelected')}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 模型选择按钮 */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAvatarSelectorOpen(true)}
                    className="w-full"
                >
                    {selectedAvatar ? t('character.changeModel') : t('character.selectModel')}
                </Button>
            </div>

            {/* 右侧：配置区 */}
            <div className="flex-1 flex flex-col bg-background rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Header / Tabs */}
                <div className="border-b border-border px-6 pt-6 pb-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-foreground">{t('character.modelConfig')}</h2>
                    </div>
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('expressions')}
                            className={cn(
                                "pb-3 text-sm font-medium transition-colors border-b-2",
                                activeTab === 'expressions'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Smile size={16} />
                                {t('character.expressions')}
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('motions')}
                            className={cn(
                                "pb-3 text-sm font-medium transition-colors border-b-2",
                                activeTab === 'motions'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Activity size={16} />
                                {t('character.motionBindings')}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-muted/30 custom-scrollbar">
                    {/* Tab 1: 表情配置 */}
                    {activeTab === 'expressions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400 flex gap-2">
                                <Info size={14} className="mt-0.5 flex-shrink-0" />
                                <p>{t('character.expressionTip')}</p>
                            </div>

                            {!selectedAvatar ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Smile size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">{t('character.selectAvatarFirst')}</p>
                                </div>
                            ) : (
                                <>
                                    {/* 搜索框 */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder={t('character.searchExpression')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>

                                    {/* 表情网格列表 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {expressions
                                            .filter(exp =>
                                                exp.name.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((exp) => {
                                                const isSelected = selectedExpression === exp.name;
                                                return (
                                                    <button
                                                        key={exp.name}
                                                        onClick={() => handleExpressionClick(exp.name)}
                                                        className={cn(
                                                            "group bg-background border-2 rounded-xl p-4 flex items-center justify-center transition-all text-left",
                                                            isSelected
                                                                ? "border-primary bg-primary/5 shadow-sm"
                                                                : "border-border hover:border-primary/50 hover:shadow-sm"
                                                        )}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className={cn(
                                                                "font-medium text-sm truncate",
                                                                isSelected ? "text-primary" : "text-foreground"
                                                            )}>
                                                                {exp.name}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tab 2: 动作绑定 */}
                    {activeTab === 'motions' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Section 1: 基础姿态 */}
                            <section>
                                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1 h-4 bg-blue-500 rounded-full" />
                                    {t('character.basePose')}
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {/* 初始姿态 */}
                                    <MotionBindingRow
                                        title={t('character.initialPose')}
                                        description={t('character.initialPoseDesc')}
                                        bindings={getBindingsByCategory('initial')}
                                        motions={motions}
                                        onAdd={(id) => addMotionBinding(id, 'initial')}
                                        onRemove={(id) => removeMotionBinding(id, 'initial')}
                                        getMotionName={getMotionName}
                                        singleSelect
                                    />
                                    {/* 待机动作 */}
                                    <MotionBindingRow
                                        title={t('character.idleLoop')}
                                        description={t('character.idleLoopDesc')}
                                        bindings={getBindingsByCategory('idle')}
                                        motions={motions}
                                        onAdd={(id) => addMotionBinding(id, 'idle')}
                                        onRemove={(id) => removeMotionBinding(id, 'idle')}
                                        getMotionName={getMotionName}
                                        singleSelect
                                    />
                                </div>
                            </section>

                            {/* Section 2: 交互动作 */}
                            <section>
                                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1 h-4 bg-purple-500 rounded-full" />
                                    {t('character.interactionFeedback')}
                                </h3>
                                {/* 思考动作 */}
                                <div className="mb-4">
                                    <MotionBindingRow
                                        title={t('character.thinkingMotion')}
                                        description={t('character.thinkingMotionDesc')}
                                        bindings={getBindingsByCategory('thinking')}
                                        motions={motions}
                                        onAdd={(id) => addMotionBinding(id, 'thinking')}
                                        onRemove={(id) => removeMotionBinding(id, 'thinking')}
                                        getMotionName={getMotionName}
                                        singleSelect
                                    />
                                </div>

                                {/* 回复动作池 */}
                                <div className="bg-background border border-border rounded-xl p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="font-medium text-foreground">{t('character.replyActions')}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {t('character.replyActionsDesc')}
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" className="text-xs h-8 gap-1">
                                            <Plus size={14} /> {t('character.addMotion')}
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {getBindingsByCategory('reply').map((binding) => (
                                            <div
                                                key={binding.motion_id}
                                                className="group flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground hover:border-primary hover:bg-primary/5 transition-all cursor-default"
                                            >
                                                <span>{getMotionName(binding.motion_id)}</span>
                                                <button
                                                    onClick={() => removeMotionBinding(binding.motion_id, 'reply')}
                                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {getBindingsByCategory('reply').length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">
                                                {t('character.noMotionsAdded')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {/* Avatar Selector Modal */}
            <HierarchicalSelector
                isOpen={isAvatarSelectorOpen}
                onClose={() => setIsAvatarSelectorOpen(false)}
                items={hierarchicalAvatars}
                selectedId={character.avatar_id}
                onSelect={handleAvatarSelect}
                title={t('character.selectModel')}
                placeholder={t('character.searchModel')}
                variant="card"
                showTags={false}
            />
        </div>
    );
};

// 辅助组件：动作绑定行
interface MotionBindingRowProps {
    title: string;
    description: string;
    bindings: LocalMotionBinding[];
    motions: Motion[];
    onAdd: (motionId: string) => void;
    onRemove: (motionId: string) => void;
    getMotionName: (motionId: string) => string;
    singleSelect?: boolean;
}

const MotionBindingRow: React.FC<MotionBindingRowProps> = ({
    title,
    description,
    bindings,
    getMotionName,
    singleSelect
}) => {
    const { t } = useLanguage();
    const currentBinding = singleSelect ? bindings[0] : null;

    return (
        <div className="bg-background border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
                <div className="font-medium text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground mt-1">{description}</div>
            </div>
            <div className="flex items-center gap-3">
                {currentBinding ? (
                    <div className="px-3 py-1.5 bg-muted rounded-md text-sm text-foreground font-medium">
                        {getMotionName(currentBinding.motion_id)}
                    </div>
                ) : (
                    <div className="px-3 py-1.5 bg-muted/50 rounded-md text-sm text-muted-foreground italic">
                        {t('admin.notSelected')}
                    </div>
                )}
                <Button variant="ghost" size="sm" className="text-primary">
                    {t('character.change')}
                </Button>
            </div>
        </div>
    );
};
