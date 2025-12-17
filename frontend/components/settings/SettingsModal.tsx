import React, { useState } from 'react';
import { Settings, Mic, Volume2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal } from '../ui';
import ASRSettings from './ASRSettings';
import TTSSettings from './TTSSettings';
import GeneralSettings from './GeneralSettings';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'general' | 'asr' | 'tts';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    if (!isOpen) {return null;}

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'asr', label: 'ASR', icon: Mic },
        { id: 'tts', label: 'TTS', icon: Volume2 },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('settings.title') || 'Settings'}
            size="4xl"
            className="h-[600px]"
        >
            <div className="flex h-full overflow-hidden">

                    {/* Sidebar (Left Column) */}
                    <div className="w-64 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-y-auto p-4 space-y-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 dark:shadow-blue-900/20'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content (Right Column) */}
                    <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
                        <div className="w-full max-w-2xl mx-auto p-6">
                            {activeTab === 'general' && <GeneralSettings />}
                            {activeTab === 'asr' && <ASRSettings />}
                            {activeTab === 'tts' && <TTSSettings />}
                        </div>
                    </div>
            </div>
        </Modal>
    );
};

export default SettingsModal;
