import React, { useState } from 'react';
import { Settings, Mic, Volume2, ChevronLeft, Menu } from 'lucide-react';
import { Button } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import GeneralSettings from './GeneralSettings';
import ASRSettings from './ASRSettings';
import TTSSettings from './TTSSettings';
import { cn } from '../../utils/cn';

interface SettingsViewProps {
    onBack: () => void;
    onOpenMobileSidebar: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onBack, onOpenMobileSidebar }) => {
    const { language } = useLanguage();
    const [activeTab, setActiveTab] = useState<'general' | 'asr' | 'tts'>('general');

    const menuItems = [
        { id: 'general', label: language === 'zh' ? '常规设置' : 'General', icon: Settings },
        { id: 'asr', label: language === 'zh' ? '语音识别' : 'ASR', icon: Mic },
        { id: 'tts', label: language === 'zh' ? '语音合成' : 'TTS', icon: Volume2 },
    ];

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
            {/* 顶部导航栏 */}
            <header className="h-16 border-b flex items-center justify-between px-4 md:px-8 shrink-0 bg-background/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenMobileSidebar}
                        className="lg:hidden"
                    >
                        <Menu size={20} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="gap-2"
                    >
                        <ChevronLeft size={16} />
                        {language === 'zh' ? '返回聊天' : 'Back'}
                    </Button>
                    <div className="h-4 w-[1px] bg-border mx-2 hidden md:block" />
                    <h1 className="text-lg font-bold tracking-tight">
                        {language === 'zh' ? '系统设置' : 'Settings'}
                    </h1>
                </div>
            </header>

            {/* 下方内容区 */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* 移动端顶部选项卡 */}
                <div className="md:hidden w-full border-b bg-background/50 backdrop-blur-md shrink-0">
                    <div className="flex p-2 gap-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                    activeTab === item.id
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon size={16} />
                                <span className="hidden sm:inline">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 左侧选项列表 - 桌面端 */}
                <aside className="w-64 border-r bg-muted/10 hidden md:flex flex-col p-4 gap-2 shrink-0">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                activeTab === item.id
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </aside>

                {/* 右侧设置详情 */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-6 md:p-10">
                        {activeTab === 'general' && <GeneralSettings />}
                        {activeTab === 'asr' && <ASRSettings />}
                        {activeTab === 'tts' && <TTSSettings />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
