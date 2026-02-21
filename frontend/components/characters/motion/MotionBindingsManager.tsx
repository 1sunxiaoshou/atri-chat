import React, { useState, useEffect } from 'react';
import { Trash, Film, ArrowRight } from 'lucide-react';
import { Motion } from '../../../types';
import { api } from '../../../services/api/index';
import { Button, Input, ConfirmDialog } from '../../ui';
import { cn } from '../../../utils/cn';

interface LocalMotionBinding {
    motion_id: string;
    category: 'idle' | 'thinking' | 'reply';
    weight: number;
}

interface Binding {
    binding_id: string;
    motion_id: string;
    motion_name: string;
    motion_file_url: string;
    motion_duration_ms: number;
    weight: number;
    created_at: string;
}

interface BindingsByCategory {
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
    { value: 'idle', label: '待机动作', icon: '🧘', color: 'border-blue-500 bg-blue-500/5 text-blue-600', activeColor: 'border-blue-500 bg-blue-500/10 text-blue-700' },
    { value: 'thinking', label: '思考动作', icon: '🤔', color: 'border-purple-500 bg-purple-500/5 text-purple-600', activeColor: 'border-purple-500 bg-purple-500/10 text-purple-700' },
    { value: 'reply', label: '回复动作', icon: '💬', color: 'border-green-500 bg-green-500/5 text-green-600', activeColor: 'border-green-500 bg-green-500/10 text-green-700' }
];

export const MotionBindingsManager: React.FC<MotionBindingsManagerProps> = ({
    characterId,
    motions: propMotions,
    localBindings = [],
    onLocalBindingsChange
}) => {
    // 判断是否为 API 模式（已保存角色）
    const isApiMode = !!characterId;

    // API 模式的状态
    const [bindingsByCategory, setBindingsByCategory] = useState<BindingsByCategory>({});
    const [allMotions, setAllMotions] = useState<Motion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 共享状态
    const [activeCategory, setActiveCategory] = useState<'idle' | 'thinking' | 'reply'>('idle');
    const [weight, setWeight] = useState<number>(1.0);

    // Confirm Dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        description: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        description: '',
        onConfirm: () => { }
    });

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
            console.error('获取数据失败:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // API 模式：添加绑定
    const handleAddBindingApi = async (motionId: string) => {
        if (!characterId) return;

        setIsSubmitting(true);
        try {
            await api.batchAddModelAnimations(
                characterId,
                [motionId],
                activeCategory,
                weight
            );
            await fetchData();
        } catch (error) {
            console.error('添加绑定失败:', error);
            alert('添加失败');
        } finally {
            setIsSubmitting(false);
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
            alert('该动作已在此分类中绑定');
            return;
        }

        onLocalBindingsChange([
            ...localBindings,
            {
                motion_id: motionId,
                category: activeCategory,
                weight
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

    // API 模式：删除绑定
    const handleRemoveBindingApi = (bindingId: string, motionName: string) => {
        if (!characterId) return;

        setConfirmDialog({
            isOpen: true,
            description: `确定要移除动作 "${motionName}" 吗？`,
            onConfirm: async () => {
                try {
                    await api.removeModelAnimation(characterId, bindingId);
                    await fetchData();
                } catch (error) {
                    console.error('移除绑定失败:', error);
                    alert('移除失败');
                }
            }
        });
    };

    // 本地模式：删除绑定
    const handleRemoveBindingLocal = (motionId: string, motionName: string) => {
        if (!onLocalBindingsChange) return;

        setConfirmDialog({
            isOpen: true,
            description: `确定要移除动作 "${motionName}" 吗？`,
            onConfirm: () => {
                onLocalBindingsChange(
                    localBindings.filter(b => !(b.motion_id === motionId && b.category === activeCategory))
                );
            }
        });
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

    // 获取动作信息
    const getMotionInfo = (motionId: string) => {
        const motion = getMotions().find(m => m.id === motionId);
        return {
            name: motion?.name || '未知动作',
            duration_ms: motion?.duration_ms || 0
        };
    };

    // 获取所有分类的绑定数量
    const getCategoryCount = (category: string): number => {
        if (isApiMode) {
            return (bindingsByCategory[category as keyof BindingsByCategory] || []).length;
        } else {
            return localBindings.filter(b => b.category === category).length;
        }
    };

    const activeCategoryData = CATEGORIES.find(c => c.value === activeCategory)!;
    const availableMotions = getAvailableMotions();

    return (
        <div className="h-full flex flex-col">
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                </div>
            ) : (
                <>
                    {/* 新建角色提示 */}
                    {!isApiMode && (
                        <div className="mb-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                                <strong>⚠️ 注意:</strong> 您正在创建新角色。动作绑定将在保存角色时一起创建。如果暂时不配置动作，可以保存后再编辑。
                            </p>
                        </div>
                    )}

                    <div className="flex-1 flex gap-4 min-h-0">
                        {/* 左侧：分类标签 */}
                        <div className="w-48 flex-shrink-0 space-y-2">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                                动作分类
                            </h4>
                            {CATEGORIES.map(category => {
                                const isActive = activeCategory === category.value;
                                const count = getCategoryCount(category.value);

                                return (
                                    <button
                                        key={category.value}
                                        onClick={() => setActiveCategory(category.value as 'idle' | 'thinking' | 'reply')}
                                        className={cn(
                                            "w-full text-left p-4 rounded-xl border-2 transition-all",
                                            isActive ? category.activeColor : category.color,
                                            "hover:scale-[1.02]"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{category.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{category.label}</p>
                                                <p className="text-xs opacity-70">
                                                    {count} 个动作
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {/* 权重设置 */}
                            <div className="pt-4 border-t border-border">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                                    默认权重
                                </label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={weight}
                                    onChange={(e) => setWeight(parseFloat(e.target.value) || 1.0)}
                                    className="h-9"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    添加动作时的默认权重
                                </p>
                            </div>
                        </div>

                        {/* 中间：已绑定的动作 */}
                        <div className="flex-1 border-2 border-border rounded-xl overflow-hidden flex flex-col">
                            <div className={cn(
                                "p-4 border-b-2 border-border flex items-center justify-between",
                                activeCategoryData.color
                            )}>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{activeCategoryData.icon}</span>
                                    <div>
                                        <h4 className="font-bold text-sm">{activeCategoryData.label}</h4>
                                        <p className="text-xs opacity-70">
                                            已绑定 {isApiMode ? getCurrentBindingsApi().length : getCurrentBindingsLocal().length} 个动作
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {isApiMode ? (
                                    // API 模式：显示 Binding 对象
                                    getCurrentBindingsApi().length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                            <Film size={48} className="mb-3 opacity-20" />
                                            <p className="text-sm">暂无绑定的动作</p>
                                            <p className="text-xs mt-1">从右侧列表添加动作</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {getCurrentBindingsApi().map(binding => (
                                                <div
                                                    key={binding.binding_id}
                                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group hover:bg-muted/50 transition-all border border-transparent hover:border-border"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className="p-2 bg-primary/10 rounded text-primary shrink-0">
                                                            <Film size={18} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-foreground truncate">
                                                                {binding.motion_name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {(binding.motion_duration_ms / 1000).toFixed(2)}s · 权重 {binding.weight}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveBindingApi(binding.binding_id, binding.motion_name)}
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                    >
                                                        <Trash size={16} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    // 本地模式：显示 LocalMotionBinding 对象
                                    getCurrentBindingsLocal().length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                            <Film size={48} className="mb-3 opacity-20" />
                                            <p className="text-sm">暂无绑定的动作</p>
                                            <p className="text-xs mt-1">从右侧列表添加动作</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {getCurrentBindingsLocal().map(binding => {
                                                const motionInfo = getMotionInfo(binding.motion_id);
                                                return (
                                                    <div
                                                        key={`${binding.motion_id}-${binding.category}`}
                                                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group hover:bg-muted/50 transition-all border border-transparent hover:border-border"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className="p-2 bg-primary/10 rounded text-primary shrink-0">
                                                                <Film size={18} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium text-foreground truncate">
                                                                    {motionInfo.name}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {(motionInfo.duration_ms / 1000).toFixed(2)}s · 权重 {binding.weight}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveBindingLocal(binding.motion_id, motionInfo.name)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                        >
                                                            <Trash size={16} />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* 右侧：未绑定的动作列表 */}
                        <div className="w-80 flex-shrink-0 border-2 border-border rounded-xl overflow-hidden flex flex-col">
                            <div className="p-4 bg-muted/30 border-b-2 border-border">
                                <h4 className="font-bold text-sm text-foreground">可用动作</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {availableMotions.length} 个未绑定
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {availableMotions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                                        <Film size={48} className="mb-3 opacity-20" />
                                        <p className="text-sm text-center">所有动作已绑定到此分类</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {availableMotions.map(motion => (
                                            <div
                                                key={motion.id}
                                                className="p-3 hover:bg-muted/30 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-muted rounded text-muted-foreground shrink-0">
                                                        <Film size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">
                                                            {motion.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(motion.duration_ms / 1000).toFixed(2)}s
                                                            {motion.description && ` · ${motion.description}`}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleAddBinding(motion.id)}
                                                        disabled={isSubmitting}
                                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all shrink-0 text-primary hover:bg-primary/10"
                                                        title="添加到当前分类"
                                                    >
                                                        <ArrowRight size={16} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                onConfirm={confirmDialog.onConfirm}
                title="确认移除"
                description={confirmDialog.description}
                type="danger"
                confirmText="移除"
                cancelText="取消"
            />
        </div>
    );
};
