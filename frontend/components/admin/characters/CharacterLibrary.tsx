import React from 'react';
import { Plus, Trash2, ArrowRight, Mic2, Cpu } from 'lucide-react';
import { Character } from '../../../types';
import { buildAvatarUrl } from '../../../utils/url';
import { useLanguage } from '../../../contexts/LanguageContext';

interface CharacterLibraryProps {
    characters: Character[];
    onEdit: (character: Character) => void;
    onCreate: () => void;
    onDelete: (characterId: number) => void;
}

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({
    characters,
    onEdit,
    onCreate,
    onDelete
}) => {
    const { t } = useLanguage();

    return (
        <>
            {/* 1. 标题栏 - 匹配 HTML 的间距和字体 */}
            <div className="flex items-center gap-3 mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {t('admin.characterList') || '角色管理'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700">
                    {characters.length} 个角色
                </span>
            </div>

            {/* 2. 网格布局 - 完全一致的响应式列数 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">

                {/* 角色卡片循环 */}
                {characters.map((char) => (
                    <div
                        key={char.character_id}
                        onClick={() => onEdit(char)}
                        className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 
                                   transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer"
                    >
                        {/* 3. 立绘区域 - 3/4 比例和内切圆角 */}
                        <div className="relative w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 will-change-transform" style={{ paddingBottom: '133.33%' }}>
                            <img
                                src={buildAvatarUrl(char.avatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`}
                                alt={char.name}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />

                            {/* 删除按钮 - 悬浮效果和位置完全匹配 HTML */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(char.character_id);
                                }}
                                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center 
                                           bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-400
                                           opacity-0 group-hover:opacity-100 transition-all duration-200
                                           hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 hover:border-red-200 shadow-sm"
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
                                    {/* 语音标签 (紫色系) - 仅在有 TTS 时显示 */}
                                    {char.tts_id && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
                                            <Mic2 size={10} strokeWidth={3} /> {char.tts_id === 'preset' ? 'Preset' : 'Clone'}
                                        </span>
                                    )}
                                    {/* 模型标签 (灰色系) */}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 uppercase">
                                        {char.primary_model_id?.split('-')[0] || 'AI'}
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

                {/* 6. 新建卡片 - 虚线边框，与角色卡片统一比例 */}
                <div
                    onClick={onCreate}
                    className="group relative border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 flex flex-col items-center justify-center
                               hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all duration-300 cursor-pointer"
                >
                    {/* 内部容器保持 3:4 比例 */}
                    <div className="relative w-full flex flex-col items-center justify-center" style={{ paddingBottom: '133.33%' }}>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-3
                                            group-hover:bg-white dark:group-hover:bg-gray-700 group-hover:border-blue-200 group-hover:text-blue-600 group-hover:scale-110 group-hover:shadow-md transition-all">
                                <Plus size={28} className="text-gray-400 group-hover:text-blue-600" strokeWidth={3} />
                            </div>
                            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400 group-hover:text-blue-700">
                                {t('admin.createCharacter') || '新建角色'}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};