import React, { useState, useEffect } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { ConfirmDialog, Toast, ToastMessage } from '../../ui';
import { httpClient } from '../../../services/api/base';
import ProviderList from './ProviderList';
import ProviderModal from './ProviderModal';
import VoiceTable from './VoiceTable';
import VoiceToolbar from './VoiceToolbar';
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
    name: string;
    voice_config: Record<string, any>;
    created_at: string;
    updated_at: string;
    provider?: {
        id: string;
        name: string;
        provider_type: string;
    };
}

interface ProviderType {
    id: string;
    name: string;
    description: string;
}

const AdminVoice: React.FC = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [providers, setProviders] = useState<TTSProvider[]>([]);
    const [voices, setVoices] = useState<VoiceAsset[]>([]);
    const [providerTypes, setProviderTypes] = useState<ProviderType[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<TTSProvider | null>(null);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const [editingVoice, setEditingVoice] = useState<VoiceAsset | null>(null);
    const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title?: string;
        description: React.ReactNode;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info' | 'success';
    }>({
        isOpen: false,
        description: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        loadData();
    }, []);

    // 默认选中第一个供应商
    useEffect(() => {
        if (providers.length > 0 && !selectedProviderId && providers[0]) {
            setSelectedProviderId(providers[0].id);
        }
    }, [providers, selectedProviderId]);

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
            console.error('Failed to load data:', error);
            showToast(false, t('admin.loadDataFailed'));
        } finally {
            setLoading(false);
        }
    };

    const showToast = (success: boolean, message: string) => {
        setToastMessage({ success, message });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const getProviderVoiceCount = (providerId: string) => {
        return voices.filter(v => v.provider_id === providerId).length;
    };

    const filteredVoices = voices.filter(v => {
        if (selectedProviderId && v.provider_id !== selectedProviderId) return false;
        if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const handleOpenProviderModal = (provider?: TTSProvider) => {
        setEditingProvider(provider || null);
        setIsProviderModalOpen(true);
    };

    const handleEditProvider = (provider: TTSProvider) => {
        setEditingProvider(provider);
        setIsProviderModalOpen(true);
    };

    const handleDeleteProvider = async (providerId: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('admin.delete'),
            description: t('admin.confirmDeleteProviderWithVoices'),
            type: 'danger',
            onConfirm: async () => {
                try {
                    const res = await httpClient.delete(`/tts-providers/${providerId}`);
                    if (res.code === 200) {
                        showToast(true, t('admin.deleteSuccess'));
                        if (selectedProviderId === providerId) {
                            setSelectedProviderId(null);
                        }
                        loadData();
                    } else {
                        showToast(false, res.message || t('admin.deleteFailed'));
                    }
                } catch (error: any) {
                    console.error('Failed to delete provider:', error);
                    showToast(false, error?.message || t('admin.deleteFailed'));
                }
            }
        });
    };

    const handleOpenVoiceModal = (voice?: VoiceAsset) => {
        if (voice) {
            setEditingVoice(voice);
        } else {
            // 新建模式：使用当前选中的供应商
            if (!selectedProviderId) {
                showToast(false, t('admin.pleaseSelectProvider'));
                return;
            }

            const selectedProvider = providers.find(p => p.id === selectedProviderId);
            if (!selectedProvider) {
                showToast(false, t('admin.providerNotFound'));
                return;
            }

            setEditingVoice({
                id: '',
                provider_id: selectedProviderId,
                name: '',
                voice_config: {},
                created_at: '',
                updated_at: '',
                provider: {
                    id: selectedProviderId,
                    name: selectedProvider.name,
                    provider_type: selectedProvider.provider_type
                }
            });
        }
        setIsVoiceModalOpen(true);
    };

    const handleEditVoice = (voice: VoiceAsset) => {
        setEditingVoice(voice);
        setIsVoiceModalOpen(true);
    };

    const handleDeleteVoice = async (voiceId: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('admin.delete'),
            description: t('admin.confirmDeleteVoice'),
            type: 'danger',
            onConfirm: async () => {
                try {
                    const res = await httpClient.delete(`/voice-assets/${voiceId}`);
                    if (res.code === 200) {
                        showToast(true, t('admin.deleteSuccess'));
                        loadData();
                    } else {
                        showToast(false, res.message || t('admin.deleteFailed'));
                    }
                } catch (error: any) {
                    console.error('Failed to delete voice:', error);
                    showToast(false, error?.message || t('admin.deleteFailed'));
                }
            }
        });
    };

    const handleProviderModalClose = (needRefresh?: boolean) => {
        setIsProviderModalOpen(false);
        setEditingProvider(null);
        if (needRefresh) {
            loadData();
        }
    };

    const handleVoiceModalClose = (needRefresh?: boolean) => {
        setIsVoiceModalOpen(false);
        setEditingVoice(null);
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
        <div className="flex h-full bg-background overflow-hidden animate-in fade-in duration-500">
            {/* Sidebar: Providers - 占25%宽度 */}
            <div className="w-[25%] min-w-[240px] max-w-[400px]">
                <ProviderList
                    providers={providers}
                    selectedProvider={selectedProviderId}
                    onSelectProvider={setSelectedProviderId}
                    onEditProvider={handleEditProvider}
                    onDeleteProvider={handleDeleteProvider}
                    onAddProvider={() => handleOpenProviderModal()}
                    getVoiceCount={getProviderVoiceCount}
                />
            </div>

            {/* Main: Voices */}
            <main className="flex-1 flex flex-col min-w-0 bg-background relative">
                {selectedProviderId ? (
                    <>
                        <VoiceToolbar
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onAddVoice={() => handleOpenVoiceModal()}
                            hasSelectedProvider={!!selectedProviderId}
                        />

                        <VoiceTable
                            voices={filteredVoices}
                            onEditVoice={handleEditVoice}
                            onDeleteVoice={handleDeleteVoice}
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
                            <Volume2 size={40} className="text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            {t('admin.selectTTSProvider')}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            {t('admin.selectTTSProviderDesc')}
                        </p>
                    </div>
                )}
            </main>

            {/* Modals */}
            <ProviderModal
                isOpen={isProviderModalOpen}
                provider={editingProvider}
                providerTypes={providerTypes}
                onClose={handleProviderModalClose}
            />

            <VoiceModal
                isOpen={isVoiceModalOpen}
                voice={editingVoice}
                providers={providers}
                onClose={handleVoiceModalClose}
            />

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                description={confirmDialog.description}
                type={confirmDialog.type}
                confirmText={t('admin.delete')}
                cancelText={t('admin.cancel')}
            />

            <Toast message={toastMessage} />
        </div>
    );
};

export default AdminVoice;
