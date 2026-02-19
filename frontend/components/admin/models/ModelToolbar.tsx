import React from 'react';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../../ui';
import { cn } from '../../../utils/cn';

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
}) => {
    return (
        <div className="h-16 px-6 flex items-center gap-4 border-b border-border sticky top-0 z-20 bg-background/80 backdrop-blur-sm">
            {/* 搜索框 */}
            <div className="relative w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search models..."
                    className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
            </div>

            {/* 分类筛选 */}
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
            <div className="flex items-center gap-2 border-l border-border pl-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onSync}
                    disabled={isSyncing}
                    title="Sync Models"
                >
                    <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
                </Button>
                <Button size="icon" onClick={onAddModel} title="Add Model">
                    <Plus size={16} />
                </Button>
            </div>
        </div>
    );
};
