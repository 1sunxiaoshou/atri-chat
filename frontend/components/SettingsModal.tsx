import React, { useState } from 'react';
import { X, Settings, Mic, Volume2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import ASRSettings from './ASRSettings';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'general' | 'asr' | 'tts';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    if (!isOpen) return null;

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'asr', label: 'ASR', icon: Mic },
        { id: 'tts', label: 'TTS', icon: Volume2 },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
                    <h2 className="text-xl font-semibold text-white">{t('settings.title') || 'Settings'}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Sidebar (Left Column) */}
                    <div className="w-64 bg-gray-900/50 border-r border-gray-800 flex-shrink-0 overflow-y-auto p-4 space-y-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content (Right Column) */}
                    <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
                        <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto p-6 h-full">
                            {/* Content Area - No Title */}
                            <div className="flex-1 min-h-0 relative">
                                {activeTab === 'general' && (
                                    <div className="h-full overflow-y-auto">
                                        <div className="text-gray-500 italic">
                                            General settings configuration will go here.
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'asr' && <ASRSettings />}
                                {activeTab === 'tts' && (
                                    <div className="h-full overflow-y-auto">
                                        <div className="text-gray-500 italic">
                                            TTS settings configuration will go here.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
