import React, { useState } from 'react';
import { Settings, Mic, Menu, PanelLeftOpen } from 'lucide-react';
import { Button } from '../ui';
import { useLanguage } from '../../contexts/LanguageContext';
import GeneralSettings from './GeneralSettings';
import ASRSettings from './ASRSettings';
import { cn } from '../../utils/cn';

interface SettingsViewProps {
    onBack: () => void;
    onOpenMobileSidebar?: () => void;
    isSidebarHidden?: boolean;
    onShowSidebar?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    onBack: _onBack,
    onOpenMobileSidebar,
    isSidebarHidden,
    onShowSidebar
}) => {
    const { language } = useLanguage();
    const [activeTab, setActiveTab] = useState<'general' | 'asr'>('general');

    const tabs = [
        {
            id: 'general',
            label: language === 'zh' ? '常规设置' : 'General',
            icon: Settings
        },
        {
            id: 'asr',
            label: language === 'zh' ? '语音识别' : 'ASR',
            icon: Mic
        },
    ];

    return (
        <div className="flex flex-col h-full bg-muted/30 relative">
            {/* Header & Tabs */}
            <header className="bg-background border-b border-border px-4 lg:px-2">
                <div className="h-16 md:h-18 flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenMobileSidebar}
                        className="lg:hidden"
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </Button>

                    {/* Desktop Show Sidebar Button */}
                    <div
                        className={cn(
                            "hidden lg:flex items-center transition-all duration-300 ease-in-out overflow-hidden",
                            isSidebarHidden ? "w-10 opacity-100 -ml-1 mr-1" : "w-0 opacity-0 m-0"
                        )}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onShowSidebar}
                            className="h-9 w-9 gap-0 text-muted-foreground hover:text-primary hover:bg-transparent rounded-lg [&_svg]:size-5"
                            title={language === 'zh' ? '显示侧边栏' : 'Show sidebar'}
                        >
                            <PanelLeftOpen size={20} />
                        </Button>
                    </div>

                    <h2 className={cn(
                        "text-2xl font-bold tracking-tight text-foreground transition-all duration-300",
                        !isSidebarHidden && "lg:ml-2"
                    )}>
                        {language === 'zh' ? '系统设置' : 'Settings'}
                    </h2>
                </div>

                {/* Tab Navigation */}
                <nav className={cn(
                    "flex gap-6 lg:gap-10 overflow-x-auto scrollbar-hide -mx-4 px-4 transition-all duration-300",
                    "lg:mx-0",
                    isSidebarHidden ? "lg:px-12" : "lg:px-2"
                )}>
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "group pb-4 px-1 flex items-center gap-2 font-medium transition-colors duration-300 relative whitespace-nowrap flex-shrink-0 text-sm",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon size={18} className={cn("transition-transform duration-300", isActive && "scale-110")} />
                                <span>{tab.label}</span>

                                {/* Bottom indicator */}
                                <span className={cn(
                                    "absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full transition-all duration-300 ease-out transform origin-center",
                                    isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0 group-hover:scale-x-50 group-hover:opacity-30"
                                )} />
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-hidden custom-scrollbar">
                <div className="h-full">
                    <div
                        key={activeTab}
                        className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out overflow-y-auto"
                    >
                        <div className="max-w-6xl mx-auto p-6 lg:p-8">
                            {activeTab === 'general' && <GeneralSettings />}
                            {activeTab === 'asr' && <ASRSettings />}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SettingsView;
