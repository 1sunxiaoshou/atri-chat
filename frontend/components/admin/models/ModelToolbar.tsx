import React, { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, Plus, Filter, Check } from 'lucide-react';
import { Button, Input } from '../../ui';
import { cn } from '../../../utils/cn';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getCapabilityDefinitions } from '../../../utils/modelCapabilities';

interface Category {
    id: string;
    label: string;
}

interface ModelToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    categories: Category[];
    activeCategory: string;
    onCategoryChange: (categoryId: string) => void;
    onSync: () => void;
    onAddModel: () => void;
    isSyncing: boolean;
    showEnabledOnly: boolean;
    onToggleEnabledFilter: () => void;
    selectedCapabilities: Set<string>;
    onToggleCapability: (cap: string) => void;
}

export const ModelToolbar: React.FC<ModelToolbarProps> = ({
    searchQuery,
    onSearchChange,
    categories,
    activeCategory,
    onCategoryChange,
    onSync,
    onAddModel,
    isSyncing,
    showEnabledOnly,
    onToggleEnabledFilter,
    selectedCapabilities,
    onToggleCapability,
}) => {
    const { t } = useLanguage();
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const filterOptions = getCapabilityDefinitions(t).map(({ filterKey, label }) => ({
        key: filterKey,
        label,
    }));

    // 点击外部关闭滤镜菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasActiveFilters = showEnabledOnly || selectedCapabilities.size > 0;

    return (
        <div className="h-16 px-6 flex items-center gap-4 border-b border-border sticky top-0 z-20 bg-background">
            {/* 搜索框 */}
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                    type="text"
                    placeholder={t('admin.searchModel')}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 h-9"
                />
            </div>

            {/* 分类筛选 (基础类型) */}
            <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => onCategoryChange(cat.id)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                            activeCategory === cat.id
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-muted/50 text-muted-foreground border-transparent hover:border-border'
                        )}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 border-l border-border pl-4 relative" ref={filterRef}>
                <div className="relative">
                    <Button
                        variant={hasActiveFilters ? "default" : "outline"}
                        size="icon"
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        title={t('admin.filterOptions')}
                        className={cn(
                            "transition-all",
                            hasActiveFilters && "bg-primary text-primary-foreground border-primary"
                        )}
                    >
                        <Filter size={16} />
                        {hasActiveFilters && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />
                        )}
                    </Button>

                    {/* Filter Dropdown */}
                    {isFilterOpen && (
                        <div className="absolute right-0 mt-2 w-56 p-2 bg-popover border border-border rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                            <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {t('admin.status')}
                            </div>
                            <button
                                onClick={onToggleEnabledFilter}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                            >
                                <span>{t('admin.enabledOnly')}</span>
                                {showEnabledOnly && <Check size={14} className="text-primary" />}
                            </button>

                            <div className="my-2 h-px bg-border/50" />

                            <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {t('admin.capabilities')}
                            </div>
                            <div className="space-y-0.5">
                                {filterOptions.map((opt) => (
                                    <button
                                        key={opt.key}
                                        onClick={() => onToggleCapability(opt.key)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <span>{opt.label}</span>
                                        {selectedCapabilities.has(opt.key) && <Check size={14} className="text-primary" />}
                                    </button>
                                ))}
                            </div>
                            
                            {hasActiveFilters && (
                                <>
                                    <div className="my-2 h-px bg-border/50" />
                                    <button
                                        onClick={() => {
                                            if (showEnabledOnly) {onToggleEnabledFilter();}
                                            selectedCapabilities.forEach(c => onToggleCapability(c));
                                            setIsFilterOpen(false);
                                        }}
                                        className="w-full px-3 py-2 text-xs text-center text-primary font-medium hover:bg-primary/5 rounded-lg transition-colors"
                                    >
                                        {t('admin.clearAllFilters')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={onSync}
                    disabled={isSyncing}
                    title={t('admin.syncModels')}
                >
                    <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
                </Button>
                <Button size="icon" onClick={onAddModel} title={t('admin.addModel')}>
                    <Plus size={16} />
                </Button>
            </div>
        </div>
    );
};
