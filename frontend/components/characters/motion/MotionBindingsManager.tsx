import React, { useState, useEffect } from 'react';
import { Film, ArrowRight } from 'lucide-react';
import { Motion } from '../../../types';
import { api } from '../../../services/api/index';
import { Button, RadioGroup } from '../../ui';
import { VRMMotionPreviewOptimized } from '../../admin/vrm/VRMMotionPreviewOptimized';
import { useLanguage } from '../../../contexts/LanguageContext';

interface LocalMotionBinding {
    motion_id: string;
    category: 'initial' | 'idle' | 'thinking' | 'reply';
}

interface Binding {
    binding_id: string;
    motion_id: string;
    motion_name: string;
    motion_file_url: string;
    motion_duration_ms: number;
    created_at: string;
}

interface BindingsByCategory {
    initial?: Binding[];
    idle?: Binding[];
    thinking?: Binding[];
    reply?: Binding[];
}

interface MotionBindingsManagerProps {
    // 模式1：已保存角色（使用 API）
    characterId?: string;

    // 模式2：新建角色（使用本地状态）
    motions?: Motion[];
    localBindings?: LocalMotionBinding[];
    onLocalBindingsChange?: (bindings: LocalMotionBinding[]) => void;
}

const CATEGORIES = [
    { value: 'initial', labelKey: 'character.motionCategories.idle', icon: '🎬', descriptionKey: 'character.motionCategories.idleDesc' },
    { value: 'idle', labelKey: 'character.motionCategories.standby', icon: '🧘', descriptionKey: 'character.motionCategories.standbyDesc' },
    { value: 'thinking', labelKey: 'character.motionCategories.thinking', icon: '🤔', descriptionKey: 'character.motionCategories.thinkingDesc' },
    { value: 'reply', labelKey: 'character.motionCategories.reply', icon: '💬', descriptionKey: 'character.motionCategories.replyDesc' }
];

export const MotionBindingsManager: React.FC<MotionBindingsManagerProps> = ({
    characterId,
    motions: propMotions,
    localBindings = [],
    onLocalBindingsChange
}) => {
    const { t } = useLanguage();

    // 判断是否为 API 模式（已保存角色）
    const isApiMode = !!characterId;

    // API 模式的状态
    const [bindingsByCategory, setBindingsByCategory] = useState<BindingsByCategory>({});
    const [allMotions, setAllMotions] = useState<Motion[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // 共享状态
    const [activeCategory, setActiveCategory] = useState<'initial' | 'idle' | 'thinking' | 'reply'>('initial');
    const [previewMotionUrl, setPreviewMotionUrl] = useState<string | null>(null);
    const [previewMotionName, setPreviewMotionName] = useState<string | null>(null);

    // 获取当前分类的第一个动作用于预览
    const getPreviewMotion = (): Motion | null => {
        if (isApiMode) {
            const bindings = getCurrentBindingsApi();
            if (bindings.length > 0) {
                const binding = bindings[0];
                if (binding) {
                    const motion = allMotions.find(m => m.id === binding.motion_id);
                    return motion || null;
                }
            }
        } else {
            const bindings = getCurrentBindingsLocal();
            if (bindings.length > 0) {
                const binding = bindings[0];
                if (binding) {
                    const motionId = binding.motion_id;
                    const motion = getMotions().find(m => m.id === motionId);
                    return motion || null;
                }
            }
        }
        return null;
    };

    // 更新预览动作
    useEffect(() => {
        const motion = getPreviewMotion();
        if (motion) {
            setPreviewMotionUrl(motion.file_url);
            setPreviewMotionName(motion.name);
        } else {
            setPreviewMotionUrl(null);
            setPreviewMotionName(null);
        }
    }, [activeCategory, bindingsByCategory, localBindings, allMotions, propMotions, isApiMode]);

    // API 模式：加载数据
    useEffect(() => {
        if (isApiMode) {
            fetchData();
        }
    }, [characterId]);

    const fetchData = async () => {
        if (!characterId) return;

        setIsLoading(true);
        try {
            const [bindingsRes, motionsRes] = await Promise.all([
                api.getModelAnimations(characterId),
                api.getVRMAnimations()
            ]);

            if (bindingsRes.code === 200) {
                const grouped: BindingsByCategory = {};
                const data = bindingsRes.data?.bindings_by_category || {};
                Object.keys(data).forEach(category => {
                    grouped[category as keyof BindingsByCategory] = data[category] as Binding[];
                });
                setBindingsByCategory(grouped);
            }

            if (motionsRes.code === 200) {
                setAllMotions(motionsRes.data || []);
            }
        } catch (error) {
            console.error(t('character.fetchDataFailed'), error);
        } finally {
            setIsLoading(false);
        }
    };

    // API 模式：添加绑定（乐观更新）
    const handleAddBindingApi = async (motionId: string) => {
        if (!characterId) return;

        // 找到要添加的动作
        const motion = allMotions.find(m => m.id === motionId);
        if (!motion) return;

        // 乐观更新：立即更新本地状态
        const newBinding: Binding = {
            binding_id: `temp-${Date.now()}`, // 临时 ID
            motion_id: motionId,
            motion_name: motion.name,
            motion_file_url: motion.file_url,
            motion_duration_ms: motion.duration_ms,
            created_at: new Date().toISOString()
        };

        setBindingsByCategory(prev => ({
            ...prev,
            [activeCategory]: [...(prev[activeCategory] || []), newBinding]
        }));

        try {
            // 后台发送请求
            const response = await api.batchAddModelAnimations(
                characterId,
                [motionId],
                activeCategory
            );

            // 请求成功，但不重新获取数据，保持当前状态
            if (response.code !== 200) {
                throw new Error(t('character.addBindingFailed'));
            }
        } catch (error) {
            console.error(t('character.addBindingError'), error);
            // 失败时回滚
            setBindingsByCategory(prev => ({
                ...prev,
                [activeCategory]: (prev[activeCategory] || []).filter(b => b.binding_id !== newBinding.binding_id)
            }));
            alert(t('character.addBindingFailed'));
        }
    };

    // 本地模式：添加绑定
    const handleAddBindingLocal = (motionId: string) => {
        if (!onLocalBindingsChange) return;

        // 检查是否已存在
        const exists = localBindings.some(
            b => b.motion_id === motionId && b.category === activeCategory
        );

        if (exists) {
            alert(t('character.motionAlreadyBound'));
            return;
        }

        onLocalBindingsChange([
            ...localBindings,
            {
                motion_id: motionId,
                category: activeCategory
            }
        ]);
    };

    // 统一的添加处理
    const handleAddBinding = (motionId: string) => {
        if (isApiMode) {
            handleAddBindingApi(motionId);
        } else {
            handleAddBindingLocal(motionId);
        }
    };

    // API 模式：删除绑定（乐观更新）
    const handleRemoveBindingApi = async (bindingId: string) => {
        if (!characterId) return;

        // 乐观更新：立即从本地状态移除
        const previousBindings = bindingsByCategory[activeCategory] || [];
        setBindingsByCategory(prev => ({
            ...prev,
            [activeCategory]: (prev[activeCategory] || []).filter(b => b.binding_id !== bindingId)
        }));

        try {
            // 后台发送请求
            await api.removeModelAnimation(characterId, bindingId);
        } catch (error) {
            console.error(t('character.removeBindingFailed'), error);
            // 失败时回滚
            setBindingsByCategory(prev => ({
                ...prev,
                [activeCategory]: previousBindings
            }));
            alert(t('character.removeBindingFailed'));
        }
    };

    // 本地模式：删除绑定
    const handleRemoveBindingLocal = (motionId: string) => {
        if (!onLocalBindingsChange) return;
        onLocalBindingsChange(
            localBindings.filter(b => !(b.motion_id === motionId && b.category === activeCategory))
        );
    };

    // 获取当前分类的绑定（API 模式）
    const getCurrentBindingsApi = (): Binding[] => {
        return bindingsByCategory[activeCategory] || [];
    };

    // 获取当前分类的绑定（本地模式）
    const getCurrentBindingsLocal = () => {
        return localBindings.filter(b => b.category === activeCategory);
    };

    // 获取动作列表
    const getMotions = (): Motion[] => {
        return isApiMode ? allMotions : (propMotions || []);
    };

    // 获取当前分类已绑定的动作ID
    const getBoundMotionIds = (): string[] => {
        if (isApiMode) {
            return getCurrentBindingsApi().map(b => b.motion_id);
        } else {
            return getCurrentBindingsLocal().map(b => b.motion_id);
        }
    };

    // 获取可用动作（未绑定到当前分类）
    const getAvailableMotions = (): Motion[] => {
        const boundIds = getBoundMotionIds();
        return getMotions().filter(m => !boundIds.includes(m.id));
    };

    // 获取所有分类的绑定数量
    const getCategoryCount = (category: string): number => {
        if (isApiMode) {
            return (bindingsByCategory[category as keyof BindingsByCategory] || []).length;
        } else {
            return localBindings.filter(b => b.category === category).length;
        }
    };

    // 点击动作加载到预览
    const handlePreviewMotion = (motion: Motion) => {
        setPreviewMotionUrl(motion.file_url);
        setPreviewMotionName(motion.name);
    };

    const availableMotions = getAvailableMotions();

    return (
        <div className="h-full flex flex-col gap-4">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
                    {/* 1. 预览区 - 移动端顶部，桌面端左侧 */}
                    <div className="w-full lg:w-[280px] xl:w-[320px] flex flex-col shrink-0">
                        {/* 3D 预览 */}
                        <div className="relative rounded-2xl border border-border bg-slate-900 overflow-hidden shadow-inner aspect-[9/16] lg:flex-1">
                            {previewMotionUrl ? (
                                <VRMMotionPreviewOptimized
                                    motionUrl={previewMotionUrl}
                                    motionName={previewMotionName || undefined}
                                    className="w-full h-full"
                                    autoPlay={true}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <Film size={48} className="opacity-20 mb-4" />
                                    <p className="text-xs">{t('character.selectMotionToPreview')}</p>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* 2. 动作管理区 */}
                    <div className="flex-1 flex flex-col min-w-0 bg-muted/30 rounded-2xl p-3 md:p-4 border border-border">
                        {/* 分类切换 */}
                        <div className="mb-4">
                            <RadioGroup
                                value={activeCategory}
                                onChange={(value: string) => setActiveCategory(value as any)}
                                options={CATEGORIES.map(cat => ({
                                    value: cat.value,
                                    label: `${cat.icon} ${t(cat.labelKey)} (${getCategoryCount(cat.value)})`
                                }))}
                                variant="segmented"
                            />
                        </div>

                        {/* 动作网格区 - 内部可滚动 */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 min-h-0">
                            {/* 2.1 可选动作 (资源池) */}
                            <div className="flex flex-col min-h-0">
                                <h4 className="px-2 mb-2 md:mb-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between shrink-0">
                                    {t('character.motionPool')} <span>{availableMotions.length}</span>
                                </h4>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                    {availableMotions.map(motion => (
                                        <div
                                            key={motion.id}
                                            onClick={() => handlePreviewMotion(motion)}
                                            className={`group flex items-center justify-between p-2.5 md:p-3 rounded-xl border transition-all cursor-pointer
                                                ${previewMotionUrl === motion.file_url ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-background border-transparent hover:border-border'}`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{motion.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{(motion.duration_ms / 1000).toFixed(1)}s</p>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                onClick={(e) => { e.stopPropagation(); handleAddBinding(motion.id); }}
                                                className="h-7 w-7 md:h-8 md:w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                                            >
                                                <ArrowRight size={14} className="text-primary" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 2.2 已绑定动作 (决策结果) */}
                            <div className="flex flex-col min-h-0">
                                <h4 className="px-2 mb-2 md:mb-3 text-[11px] font-bold text-primary uppercase tracking-wider flex justify-between shrink-0">
                                    {t('character.boundToCategory')} <span>{isApiMode ? getCurrentBindingsApi().length : getCurrentBindingsLocal().length}</span>
                                </h4>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                    {(isApiMode ? getCurrentBindingsApi() : getCurrentBindingsLocal()).map((binding: any) => {
                                        const motion = getMotions().find(m => m.id === (binding.motion_id || binding.id));
                                        const bId = isApiMode ? binding.binding_id : binding.motion_id;

                                        return (
                                            <div
                                                key={bId}
                                                onClick={() => motion && handlePreviewMotion(motion)}
                                                className={`group flex items-center justify-between p-2.5 md:p-3 rounded-xl border bg-background transition-all cursor-pointer
                                                    ${previewMotionUrl === motion?.file_url ? 'ring-2 ring-primary/20 border-primary' : 'border-border'}`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold truncate">{binding.motion_name || motion?.name}</p>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground italic">已激活</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        isApiMode ? handleRemoveBindingApi(bId) : handleRemoveBindingLocal(bId);
                                                    }}
                                                    className="h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0"
                                                >
                                                    <ArrowRight size={14} className="rotate-180" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
