import React from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { Character } from '../../../types';
import { buildAvatarUrl } from '../../../utils/url';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button } from '../../ui/Button';

interface CharacterLibraryProps {
    characters: Character[];
    onEdit: (character: Character) => void;
    onCreate: () => void;
    onDelete: (characterId: string) => void;
    hideHeader?: boolean;
}

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({
    characters,
    onEdit,
    onCreate,
    onDelete,
    hideHeader = false
}) => {
    const { t } = useLanguage();

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6">
                {/* 1. 标题栏 - 可选显示 */}
                {!hideHeader && (
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {t('admin.characterList') || '角色管理'}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700">
                                {characters.length} 个角色
                            </span>
                        </div>
                        <Button onClick={onCreate} size="default">
                            <Plus size={16} />
                            {t('admin.createCharacter') || '新建角色'}
                        </Button>
                    </div>
                )}

                {/* 2. 网格布局 - 完全一致的响应式列数 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">

                    {/* 角色卡片循环 */}
                    {characters.map((char) => (
                        <div
                            key={char.id}
                            onClick={() => onEdit(char)}
                            className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 
                                   transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer"
                        >
                            {/* 3. 立绘区域 - 3/4 比例和内切圆角 */}
                            <div className="relative w-full rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 will-change-transform" style={{ paddingBottom: '133.33%' }}>
                                <img
                                    src={buildAvatarUrl(char.portrait_url || char.avatar?.thumbnail_url || `/uploads/vrm_thumbnails/${char.avatar_id}.jpg`)}
                                    alt={char.name}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />

                                {/* 删除按钮 - 靠右上角，无背景 */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(char.id);
                                    }}
                                    className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center 
                                           text-primary rounded-md
                                           opacity-0 group-hover:opacity-100 transition-all duration-200
                                           hover:text-red-500 hover:scale-110"
                                >
                                    <Trash2 size={16} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* 4. 底部信息区域 - 匹配 mt-3 和 flex 布局 */}
                            <div className="mt-3 flex justify-between items-end">
                                <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
                                    {/* 名字 - text-lg font-bold */}
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                                        {char.name}
                                    </h3>

                                    {/* 标签组 - 10px 字体和特定的颜色系 */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {/* 模型标签 (灰色系) */}
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                            {char.primary_model?.model_id || 'AI'}
                                        </span>
                                    </div>
                                </div>

                                {/* 5. 进入按钮 - 10x10 大小，跟随主题色 */}
                                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center 
                                            bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700
                                            group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary group-hover:shadow-md
                                            transition-all duration-300 ml-2">
                                    <ArrowRight size={18} strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};