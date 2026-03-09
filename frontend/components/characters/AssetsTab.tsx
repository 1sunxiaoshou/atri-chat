import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Smile, Activity, Search, Info, Plus, X, User, Box } from 'lucide-react';
import { Character, Avatar, Motion } from '../../types';
import { buildAvatarUrl } from '../../utils/url';
import { useLanguage } from '../../contexts/LanguageContext';
import { Input, Button } from '../ui';
import { VRMViewer } from '../vrm/r3f';
import HierarchicalSelector, { HierarchicalItem } from '../ui/HierarchicalSelector';
import { cn } from '../../utils/cn';
import { LocalMotionBinding } from './types';
import { motionBindingsApi } from '../../services/api';

interface AssetsTabProps {
    character: Character;
    avatars: Avatar[];
    motions: Motion[];
    isLoadingAssets: boolean;
    localMotionBindings: LocalMotionBinding[];
    onChange: (character: Character) => void;
    onLocalBindingsChange: (bindings: LocalMotionBinding[] | ((prev: LocalMotionBinding[]) => LocalMotionBinding[])) => void;
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
    const [vrmExpression, setVrmExpression] = useState<string>('neutral');
    const [isMotionSelectorOpen, setIsMotionSelectorOpen] = useState(false);
    const [currentMotionCategory, setCurrentMotionCategory] = useState<LocalMotionBinding['category'] | null>(null);
    const vrmViewerRef = useRef<any>(null);
    const [currentPreviewMotionId, setCurrentPreviewMotionId] = useState<string | null>(null);

    // 如果角色已存在（有 ID），从后端加载动作绑定（仅在首次加载时）
    const hasLoadedBindings = useRef(false);
    useEffect(() => {
        if (character.id && !hasLoadedBindings.current) {
            loadMotionBindings();
            hasLoadedBindings.current = true;
        }
    }, [character.id]);

    const loadMotionBindings = async () => {
        if (!character.id) return;

        try {
            const response = await motionBindingsApi.getCharacterBindings(character.id);
            if (response.code === 200) {
                // v2 API 返回的数据格式：{ bindings_by_category: { initial: [...], idle: [...], ... } }
                const bindings: LocalMotionBinding[] = [];

                Object.entries(response.data.bindings_by_category).forEach(([category, items]) => {
                    items.forEach((item: any) => {
                        bindings.push({
                            motion_id: item.motion_id,
                            category: category as LocalMotionBinding['category']
                        });
                    });
                });

                onLocalBindingsChange(bindings);
            }
        } catch (error) {
            console.error('[AssetsTab] 加载动作绑定失败:', error);
        }
    };

    const selectedAvatar = avatars.find(a => a.id === character.avatar_id);

    // 动作绑定相关函数（需要在 useMemo 之前定义）
    const getBindingsByCategory = (category: LocalMotionBinding['category']) => {
        return localMotionBindings.filter(b => b.category === category);
    };

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

    // 转换 motions 为 HierarchicalItem 格式（单选模式下添加"空"选项）
    const hierarchicalMotions = useMemo<HierarchicalItem[]>(() => {
        let items = motions.map(motion => ({
            id: motion.id,
            label: motion.name,
            category: t('admin.animations'),
            tags: [
                `${(motion.duration_ms / 1000).toFixed(1)}s`,
                ...(motion.tags || [])
            ],
            icon: <Activity size={20} className="text-primary" />,
            metadata: {
                description: motion.description,
                duration_ms: motion.duration_ms
            }
        }));

        // 如果是 reply 多选模式，过滤掉已添加的动作
        if (currentMotionCategory === 'reply') {
            const replyMotionIds = getBindingsByCategory('reply').map(b => b.motion_id);
            items = items.filter(item => !replyMotionIds.includes(item.id));
        }

        // 如果是单选模式（initial/idle/thinking），添加"空"选项
        if (currentMotionCategory && ['initial', 'idle', 'thinking'].includes(currentMotionCategory)) {
            items.unshift({
                id: '__EMPTY__',
                label: t('character.noMotion'),
                category: t('character.systemOptions'),
                tags: [],
                icon: <X size={20} className="text-muted-foreground" />,
                metadata: {
                    description: undefined,
                    duration_ms: 0
                }
            });
        }

        return items;
    }, [motions, t, language, currentMotionCategory, localMotionBindings]);

    // 获取当前模型的表情列表（直接使用模型的 available_expressions）
    const availableExpressions = selectedAvatar?.available_expressions || [];
    const expressions = availableExpressions.map(name => ({ name }));

    const handleExpressionClick = (expName: string) => {
        setSelectedExpression(expName);
        setVrmExpression(expName);
    };

    const handleAvatarSelect = (item: HierarchicalItem) => {
        onChange({ ...character, avatar_id: item.id });
        setIsAvatarSelectorOpen(false);
    };

    const handleMotionSelect = (item: HierarchicalItem) => {
        if (!currentMotionCategory) return;

        onLocalBindingsChange((prevBindings: LocalMotionBinding[]) => {
            // 移除该类别的所有旧绑定
            const filtered = prevBindings.filter((b: LocalMotionBinding) => b.category !== currentMotionCategory);

            // 如果选择的是"空"选项，则不添加新绑定
            if (item.id === '__EMPTY__') {
                return filtered;
            }

            // 添加新绑定
            return [...filtered, { motion_id: item.id, category: currentMotionCategory }];
        });

        setIsMotionSelectorOpen(false);
        setCurrentMotionCategory(null);
    };

    const handleMultiMotionSelect = (items: HierarchicalItem[]) => {
        if (!currentMotionCategory || currentMotionCategory !== 'reply') return;

        onLocalBindingsChange((prevBindings: LocalMotionBinding[]) => {
            // 添加新选择的绑定（选择器已过滤掉已存在的，无需去重）
            const newBindings: LocalMotionBinding[] = items.map(item => ({
                motion_id: item.id,
                category: 'reply'
            }));

            return [...prevBindings, ...newBindings];
        });

        // 关闭选择器
        setIsMotionSelectorOpen(false);
        setCurrentMotionCategory(null);
    };

    const getMotionName = (motionId: string) => {
        return motions.find(m => m.id === motionId)?.name || motionId;
    };

    // 播放动作预览
    const playMotionPreview = (motionId: string, shouldLoop: boolean = true) => {
        const motion = motions.find(m => m.id === motionId);
        if (!motion || !vrmViewerRef.current) return;

        // 如果点击了正在播放的动作，切换到待机动作
        if (currentPreviewMotionId === motionId) {
            const idleBinding = getBindingsByCategory('idle')[0];
            if (idleBinding && idleBinding.motion_id !== motionId) {
                const idleMotion = motions.find(m => m.id === idleBinding.motion_id);
                if (idleMotion) {
                    vrmViewerRef.current.playMotion(idleMotion.file_url, true, 0.3);
                    setCurrentPreviewMotionId(idleBinding.motion_id);
                    return;
                }
            }
            return;
        }

        // 播放新动作
        vrmViewerRef.current.playMotion(motion.file_url, shouldLoop, 0.3);
        setCurrentPreviewMotionId(motionId);
    };

    // 动作播放完成回调（单次播放的动作播完后自动回到待机）
    const handleMotionComplete = () => {
        const idleBinding = getBindingsByCategory('idle')[0];
        if (idleBinding) {
            const idleMotion = motions.find(m => m.id === idleBinding.motion_id);
            if (idleMotion && vrmViewerRef.current) {
                vrmViewerRef.current.playMotion(idleMotion.file_url, true, 0.5);
                setCurrentPreviewMotionId(idleBinding.motion_id);
            }
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
        <div className="h-full flex gap-6 animate-in slide-in-from-right-4 duration-300">
            {/* 左侧：3D 模型实时渲染 */}
            <div className="w-[400px] flex-shrink-0 flex flex-col gap-4">
                <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden h-[600px] relative group">
                    {selectedAvatar ? (
                        <>
                            <VRMViewer
                                ref={vrmViewerRef}
                                modelUrl={buildAvatarUrl(selectedAvatar.file_url)}
                                expression={vrmExpression}
                                enableBlink={true}
                                lookAtMode="mouse"
                                autoRotate={false}
                                showGrid={true}
                                enableOrbitControls={true}
                                enableCameraFit={false}
                                loopMotion={true}
                                onMotionComplete={handleMotionComplete}
                                className="w-full h-full"
                            />
                            {/* 顶部悬浮信息 */}
                            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                                <div className="bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs font-medium text-muted-foreground">
                                    {t('character.currentModel')}: {selectedAvatar.name}
                                </div>
                            </div>
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
                                        getMotionName={getMotionName}
                                        onChangeClick={() => {
                                            setCurrentMotionCategory('initial');
                                            setIsMotionSelectorOpen(true);
                                        }}
                                        onMotionClick={(id) => playMotionPreview(id, true)}
                                        currentPreviewMotionId={currentPreviewMotionId}
                                        singleSelect
                                    />
                                    {/* 待机动作 */}
                                    <MotionBindingRow
                                        title={t('character.idleLoop')}
                                        description={t('character.idleLoopDesc')}
                                        bindings={getBindingsByCategory('idle')}
                                        getMotionName={getMotionName}
                                        onChangeClick={() => {
                                            setCurrentMotionCategory('idle');
                                            setIsMotionSelectorOpen(true);
                                        }}
                                        onMotionClick={(id) => playMotionPreview(id, true)}
                                        currentPreviewMotionId={currentPreviewMotionId}
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
                                        getMotionName={getMotionName}
                                        onChangeClick={() => {
                                            setCurrentMotionCategory('thinking');
                                            setIsMotionSelectorOpen(true);
                                        }}
                                        onMotionClick={(id) => playMotionPreview(id, true)}
                                        currentPreviewMotionId={currentPreviewMotionId}
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
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-8 gap-1"
                                            onClick={() => {
                                                setCurrentMotionCategory('reply');
                                                setIsMotionSelectorOpen(true);
                                            }}
                                        >
                                            <Plus size={14} /> {t('character.addMotion')}
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {getBindingsByCategory('reply').map((binding) => {
                                            const isPlaying = currentPreviewMotionId === binding.motion_id;
                                            return (
                                                <div
                                                    key={binding.motion_id}
                                                    className={cn(
                                                        "group flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-all cursor-pointer",
                                                        isPlaying
                                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                            : "bg-muted border-border text-foreground hover:border-primary hover:bg-primary/5"
                                                    )}
                                                    onClick={() => playMotionPreview(binding.motion_id, false)}
                                                >
                                                    <span>{getMotionName(binding.motion_id)}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onLocalBindingsChange(
                                                                localMotionBindings.filter(
                                                                    b => !(b.motion_id === binding.motion_id && b.category === 'reply')
                                                                )
                                                            );
                                                        }}
                                                        className={cn(
                                                            "transition-opacity",
                                                            isPlaying
                                                                ? "text-primary-foreground/70 hover:text-primary-foreground"
                                                                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                                        )}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
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

            {/* Motion Selector Modal */}
            <HierarchicalSelector
                isOpen={isMotionSelectorOpen}
                onClose={() => {
                    setIsMotionSelectorOpen(false);
                    setCurrentMotionCategory(null);
                }}
                items={hierarchicalMotions}
                selectedId={
                    currentMotionCategory && ['initial', 'idle', 'thinking'].includes(currentMotionCategory)
                        ? getBindingsByCategory(currentMotionCategory)[0]?.motion_id
                        : undefined
                }
                selectedIds={[]}
                onSelect={handleMotionSelect}
                onMultiSelect={handleMultiMotionSelect}
                title={t('character.selectMotion')}
                placeholder={t('character.searchMotion')}
                variant="card"
                showTags={true}
                multiSelect={currentMotionCategory === 'reply'}
            />
        </div>
    );
};

// 辅助组件：动作绑定行
interface MotionBindingRowProps {
    title: string;
    description: string;
    bindings: LocalMotionBinding[];
    getMotionName: (motionId: string) => string;
    onChangeClick: () => void;
    onMotionClick?: (motionId: string) => void;
    currentPreviewMotionId?: string | null;
    singleSelect?: boolean;
}

const MotionBindingRow: React.FC<MotionBindingRowProps> = ({
    title,
    description,
    bindings,
    getMotionName,
    onChangeClick,
    onMotionClick,
    currentPreviewMotionId,
    singleSelect
}) => {
    const { t } = useLanguage();
    const currentBinding = singleSelect ? bindings[0] : null;
    const isPlaying = currentBinding && currentPreviewMotionId === currentBinding.motion_id;

    return (
        <div className="bg-background border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
                <div className="font-medium text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground mt-1">{description}</div>
            </div>
            <div className="flex items-center gap-3">
                {currentBinding ? (
                    <div
                        className={cn(
                            "px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all",
                            isPlaying
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted text-foreground hover:bg-muted/80"
                        )}
                        onClick={() => onMotionClick?.(currentBinding.motion_id)}
                    >
                        {getMotionName(currentBinding.motion_id)}
                    </div>
                ) : (
                    <div className="px-3 py-1.5 bg-muted/50 rounded-md text-sm text-muted-foreground italic">
                        {t('admin.notSelected')}
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={onChangeClick}
                >
                    {t('character.change')}
                </Button>
            </div>
        </div>
    );
};
