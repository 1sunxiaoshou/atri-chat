import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from "../../utils/cn";
import Modal from './Modal';
import { useLanguage } from '@/contexts/LanguageContext';

export interface HierarchicalItem {
    id: string;
    label: string;
    category: string;
    tags?: string[];
    icon?: React.ReactNode;
    // 移除了具体业务逻辑，保持通用
    metadata?: Record<string, any>;
}

interface HierarchicalSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    items: HierarchicalItem[];
    selectedId?: string;
    selectedIds?: string[];
    onSelect: (item: HierarchicalItem) => void;
    onMultiSelect?: (items: HierarchicalItem[]) => void;
    title?: string;
    placeholder?: string;
    showTags?: boolean;
    variant?: 'list' | 'card';
    className?: string;
    multiSelect?: boolean;
}

const HierarchicalSelector: React.FC<HierarchicalSelectorProps> = ({
    isOpen,
    onClose,
    items,
    selectedId,
    selectedIds = [],
    onSelect,
    onMultiSelect,
    title,
    placeholder,
    showTags = true,
    variant = 'list',
    className,
    multiSelect = false
}) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [tempSelectedIds, setTempSelectedIds] = useState<Set<string>>(new Set(selectedIds));

    // 提取所有可用的标签
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        items.forEach(item => {
            item.tags?.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }, [items]);

    // 过滤并分组项目
    const filteredGroupedItems = useMemo(() => {
        let filtered = items;

        // 按标签过滤
        if (selectedTags.size > 0) {
            filtered = filtered.filter(item =>
                item.tags?.some(tag => selectedTags.has(tag))
            );
        }

        // 按搜索关键词过滤
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.label.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query) ||
                item.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // 按分类(category)重新分组
        const groups: Record<string, HierarchicalItem[]> = {};
        filtered.forEach(item => {
            if (!groups[item.category]) {
                groups[item.category] = [];
            }
            groups[item.category]!.push(item);
        });

        return groups;
    }, [items, selectedTags, searchQuery]);

    const handleSelect = (item: HierarchicalItem) => {
        if (multiSelect) {
            // 多选模式：切换选中状态
            const newSelected = new Set(tempSelectedIds);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
            } else {
                newSelected.add(item.id);
            }
            setTempSelectedIds(newSelected);
        } else {
            // 单选模式：立即选择并关闭
            onSelect(item);
            onClose();
            // 延迟重置状态，避免弹窗关闭动画期间看到内容跳动
            setTimeout(() => {
                setSearchQuery('');
                setSelectedTags(new Set());
            }, 200);
        }
    };

    const handleConfirm = () => {
        if (multiSelect && onMultiSelect) {
            const selectedItems = items.filter(item => tempSelectedIds.has(item.id));
            onMultiSelect(selectedItems);
        }
        onClose();
        // 延迟重置状态
        setTimeout(() => {
            setSearchQuery('');
            setSelectedTags(new Set());
            setTempSelectedIds(new Set(selectedIds));
        }, 200);
    };

    const handleCancel = () => {
        setTempSelectedIds(new Set(selectedIds));
        onClose();
        setTimeout(() => {
            setSearchQuery('');
            setSelectedTags(new Set());
        }, 200);
    };

    const toggleTag = (tag: string) => {
        const newTags = new Set(selectedTags);
        if (newTags.has(tag)) {
            newTags.delete(tag);
        } else {
            newTags.add(tag);
        }
        setSelectedTags(newTags);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={multiSelect ? handleCancel : onClose}
            title={title || t('hierarchicalSelector.selectItem')}
            size="2xl"
            className={cn("p-0 overflow-hidden", className)}
        >
            <div className="flex flex-col h-[650px] bg-white">

                {/* 1. 顶部搜索栏 */}
                <div className="px-5 border-b border-border/40">
                    <div className="relative flex items-center h-14">
                        <Search className="text-muted-foreground/60 shrink-0" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={placeholder || t('hierarchicalSelector.search')}
                            className="w-full h-full pl-3 pr-10 bg-transparent text-[15px] focus:outline-none placeholder:text-muted-foreground/50"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-0 p-2 text-muted-foreground/50 hover:text-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. 标签筛选栏 (完美复刻图片横向布局) */}
                {showTags && allTags.length > 0 && (
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-[#fafafa]">
                        <span className="text-[13px] text-muted-foreground shrink-0">{t('hierarchicalSelector.filterByTags')}</span>
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                            {allTags.map(tag => {
                                const isSelected = selectedTags.has(tag);
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={cn(
                                            "flex items-center px-3 py-1.5 rounded-full text-[13px] transition-all whitespace-nowrap border",
                                            isSelected
                                                ? "bg-white text-foreground border-border shadow-sm"
                                                : "bg-transparent text-muted-foreground border-transparent hover:bg-black/5"
                                        )}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 3. 列表/卡片区域 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
                    {Object.keys(filteredGroupedItems).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
                            <Search size={40} className="mb-4 opacity-20" />
                            <p className="text-sm">{t('hierarchicalSelector.noResults')}</p>
                        </div>
                    ) : variant === 'card' ? (
                        // 卡片变体
                        <div className="py-4">
                            {Object.entries(filteredGroupedItems).map(([category, categoryItems]) => (
                                <div key={category} className="mb-6 last:mb-0">
                                    {/* 分类标题 */}
                                    <div className="px-5 mb-3 text-[13px] font-medium text-muted-foreground/70">
                                        {category}
                                    </div>

                                    {/* 卡片网格 */}
                                    <div className="px-5 grid grid-cols-2 gap-3">
                                        {categoryItems.map(item => {
                                            const isSelected = multiSelect
                                                ? tempSelectedIds.has(item.id)
                                                : selectedId === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleSelect(item)}
                                                    className={cn(
                                                        "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                                                        isSelected
                                                            ? "bg-primary/5 border-primary shadow-sm"
                                                            : "bg-background border-border hover:border-primary/50 hover:shadow-sm"
                                                    )}
                                                >
                                                    {/* 选中指示器 */}
                                                    {isSelected && (
                                                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    )}

                                                    {/* 图标 */}
                                                    {item.icon && (
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                                                            isSelected ? "bg-primary/10" : "bg-muted"
                                                        )}>
                                                            {item.icon}
                                                        </div>
                                                    )}

                                                    {/* 名称 */}
                                                    <div className={cn(
                                                        "text-sm font-medium mb-1 line-clamp-2",
                                                        isSelected ? "text-primary" : "text-foreground"
                                                    )}>
                                                        {item.label}
                                                    </div>

                                                    {/* 标签 */}
                                                    {item.tags && item.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {item.tags.slice(0, 2).map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            {item.tags.length > 2 && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                                                                    +{item.tags.length - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // 列表变体（原有实现）
                        <div className="py-2">
                            {Object.entries(filteredGroupedItems).map(([category, categoryItems]) => (
                                <div key={category} className="mb-4 last:mb-0">
                                    {/* 分类标题 (复刻图片灰色小字) */}
                                    <div className="px-5 py-2 text-[13px] text-muted-foreground/70">
                                        {category}
                                    </div>

                                    {/* 该分类下的项目列表 */}
                                    <div className="flex flex-col">
                                        {categoryItems.map(item => {
                                            const isSelected = multiSelect
                                                ? tempSelectedIds.has(item.id)
                                                : selectedId === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleSelect(item)}
                                                    className={cn(
                                                        "relative flex items-center justify-between px-5 py-3 cursor-pointer group transition-colors",
                                                        isSelected
                                                            ? "bg-[#f3f4f6]"
                                                            : "hover:bg-[#fafafa]"
                                                    )}
                                                >
                                                    {/* 图片中选中状态的左侧红/粉色竖条指示器 */}
                                                    {isSelected && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-rose-400 rounded-r-md" />
                                                    )}

                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {/* 左侧图标 */}
                                                        {item.icon && (
                                                            <div className="w-6 h-6 flex items-center justify-center shrink-0">
                                                                {item.icon}
                                                            </div>
                                                        )}
                                                        {/* 名称 */}
                                                        <span className="text-[15px] text-foreground truncate">
                                                            {item.label}
                                                        </span>
                                                    </div>

                                                    {/* 右侧标签组 (简化为带有微弱背景的圆角矩形) */}
                                                    {item.tags && item.tags.length > 0 && (
                                                        <div className="flex items-center gap-1.5 shrink-0 ml-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                                            {item.tags.map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="px-2 py-0.5 rounded-full text-[11px] bg-[#eef2f6] text-muted-foreground"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. 底部按钮栏（仅多选模式） */}
                {multiSelect && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/30">
                        <div className="text-sm text-muted-foreground">
                            {t('hierarchicalSelector.selectedCount', { count: tempSelectedIds.size })}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                            >
                                {t('admin.cancel')}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={tempSelectedIds.size === 0}
                                className={cn(
                                    "px-4 py-2 text-sm rounded-lg transition-colors",
                                    tempSelectedIds.size > 0
                                        ? "bg-primary text-white hover:bg-primary/90"
                                        : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                {t('hierarchicalSelector.confirm')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default HierarchicalSelector;