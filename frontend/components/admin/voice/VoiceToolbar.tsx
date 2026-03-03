import React from 'react';
import { Plus, Search } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Input } from '../../ui';

interface VoiceToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onAddVoice: () => void;
    hasSelectedProvider: boolean;
}

const VoiceToolbar: React.FC<VoiceToolbarProps> = ({
    searchQuery,
    onSearchChange,
    onAddVoice,
    hasSelectedProvider,
}) => {
    const { language } = useLanguage();

    return (
        <div className="h-16 px-6 border-b border-border flex items-center justify-between gap-4 bg-background">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                    type="text"
                    placeholder={language === 'zh' ? '搜索音色...' : 'Search voices...'}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 h-9"
                />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Button
                    onClick={onAddVoice}
                    size="sm"
                    disabled={!hasSelectedProvider}
                    title={!hasSelectedProvider ? (language === 'zh' ? '请先选择供应商' : 'Please select a provider first') : ''}
                >
                    <Plus size={16} className="mr-2" />
                    {language === 'zh' ? '添加音色' : 'Add Voice'}
                </Button>
            </div>
        </div>
    );
};

export default VoiceToolbar;
