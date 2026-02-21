import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, Toast, ToastMessage } from '../../ui';
import { httpClient } from '../../../services/api/base';
import ProviderList from './ProviderList';
import ProviderModal from './ProviderModal';
import VoiceList from './VoiceList';
import VoiceModal from './VoiceModal';

interface TTSProvider {
    id: string;
    provider_type: string;
    name: string;
    config_payload: Record<string, any>;
    enabled: boolean;
    voice_count: number;
    created_at: string;
    updated_at: string;
}

interface VoiceAsset {
    id: string;
    provider_id: string;
    provider_name: string;
    provider_type: string;
    name: string;
    voice_config: Record<string, any>;
    created_at: string;
    updated_at: string;
}

interface ProviderType {
    id: string;
    name: string;
    description: string;
}

const AdminVoice: React.FC = () => {
    const { language } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [providers, setProviders] = useState<TTSProvider[]>([]);
    const [voices, setVoices] = useState<VoiceAsset[]>([]);
    const [providerTypes, setProviderTypes] = useState<ProviderType[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<TTSProvider | null>(null);
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<VoiceAsset | null>(null);
    const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [providersRes, voicesRes, typesRes] = await Promise.all([
                httpClient.get<TTSProvider[]>('/tts-providers'),
                httpClient.get<VoiceAsset[]>('/voice-assets'),
                httpClient.get<ProviderType[]>('/tts-providers/types/list')
            ]);

            if (providersRes.code === 200) {
                setProviders(providersRes.data);
            }
            if (voicesRes.code === 200) {
                setVoices(voicesRes.data);
            }
            if (typesRes.code === 200) {
                setProviderTypes(typesRes.data);
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            showToast(false, '加载数据失败');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (success: boolean, message: string) => {
        setToastMessage({ success, message });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleCreateProvider = () => {
        setSelectedProvider(null);
        setIsProviderModalOpen(true);
    };

    const handleEditProvider = (provider: TTSProvider) => {
        setSelectedProvider(provider);
        setIsProviderModalOpen(true);
    };

    const handleDeleteProvider = async (providerId: string) => {
        if (!confirm(language === 'zh' ? '确定要删除此供应商吗？这将同时删除其下的所有音色。' : 'Delete this provider? All voices will be deleted.')) {
            return;
        }

        try {
            const res = await httpClient.delete(`/tts-providers/${providerId}`);
            if (res.code === 200) {
                showToast(true, language === 'zh' ? '删除成功' : 'Deleted');
                loadData();
            } else {
                showToast(false, res.message || (language === 'zh' ? '删除失败' : 'Delete failed'));
            }
        } catch (error: any) {
            console.error('删除供应商失败:', error);
            showToast(false, error?.message || (language === 'zh' ? '删除失败' : 'Delete failed'));
        }
    };

    const handleCreateVoice = (providerId?: string) => {
        setSelectedVoice(null);
        setIsVoiceModalOpen(true);
        if (providerId) {
            // 可以预设供应商
        }
    };

    const handleEditVoice = (voice: VoiceAsset) => {
        setSelectedVoice(voice);
        setIsVoiceModalOpen(true);
    };

    const handleDeleteVoice = async (voiceId: string) => {
        if (!confirm(language === 'zh' ? '确定要删除此音色吗？' : 'Delete this voice?')) {
            return;
        }

        try {
            const res = await httpClient.delete(`/voice-assets/${voiceId}`);
            if (res.code === 200) {
                showToast(true, language === 'zh' ? '删除成功' : 'Deleted');
                loadData();
            } else {
                showToast(false, res.message || (language === 'zh' ? '删除失败' : 'Delete failed'));
            }
        } catch (error: any) {
            console.error('删除音色失败:', error);
            showToast(false, error?.message || (language === 'zh' ? '删除失败' : 'Delete failed'));
        }
    };

    const handleProviderModalClose = (needRefresh?: boolean) => {
        setIsProviderModalOpen(false);
        setSelectedProvider(null);
        if (needRefresh) {
            loadData();
        }
    };

    const handleVoiceModalClose = (needRefresh?: boolean) => {
        setIsVoiceModalOpen(false);
        setSelectedVoice(null);
        if (needRefresh) {
            loadData();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <>
            <Toast message={toastMessage} />

            <div className="h-full flex flex-col bg-background">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">
                                {language === 'zh' ? 'TTS 音色配置' : 'TTS Voice Configuration'}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {language === 'zh'
                                    ? '管理 TTS 供应商和音色资产'
                                    : 'Manage TTS providers and voice assets'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreateProvider} size="sm">
                                <Plus size={16} className="mr-1" />
                                {language === 'zh' ? '添加供应商' : 'Add Provider'}
                            </Button>
                            <Button onClick={() => handleCreateVoice()} variant="outline" size="sm">
                                <Plus size={16} className="mr-1" />
                                {language === 'zh' ? '添加音色' : 'Add Voice'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                        {/* Left: Providers */}
                        <div className="flex flex-col h-full">
                            <h3 className="text-lg font-medium mb-4">
                                {language === 'zh' ? 'TTS 供应商' : 'TTS Providers'}
                            </h3>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <ProviderList
                                    providers={providers}
                                    onEdit={handleEditProvider}
                                    onDelete={handleDeleteProvider}
                                    onCreateVoice={handleCreateVoice}
                                />
                            </div>
                        </div>

                        {/* Right: Voices */}
                        <div className="flex flex-col h-full">
                            <h3 className="text-lg font-medium mb-4">
                                {language === 'zh' ? '音色资产' : 'Voice Assets'}
                            </h3>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <VoiceList
                                    voices={voices}
                                    onEdit={handleEditVoice}
                                    onDelete={handleDeleteVoice}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isProviderModalOpen && (
                <ProviderModal
                    provider={selectedProvider}
                    providerTypes={providerTypes}
                    onClose={handleProviderModalClose}
                />
            )}

            {isVoiceModalOpen && (
                <VoiceModal
                    voice={selectedVoice}
                    providers={providers}
                    onClose={handleVoiceModalClose}
                />
            )}
        </>
    );
};

export default AdminVoice;
