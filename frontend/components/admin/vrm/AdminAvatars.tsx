import React, { useState, useEffect } from 'react';
import { Plus, Trash, Box } from 'lucide-react';
import { api } from '../../../services/api/index';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, ConfirmDialog } from '../../ui';
import Toast, { ToastMessage } from '../../ui/Toast';
import { VRMUploadPreview } from './VRMUploadPreview';
import { VRMEditPreview } from './VRMEditPreview';

interface Avatar {
    id: string;
    name: string;
    file_url: string;
    model_path: string;
    thumbnail_url?: string;
    thumbnail_path?: string;
    created_at?: string;
    updated_at?: string;
}

interface AdminAvatarsProps {
    onAvatarsChange?: () => void;
}

export const AdminAvatars: React.FC<AdminAvatarsProps> = ({ onAvatarsChange }) => {
    const { t } = useLanguage();

    // Data States
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // UI States
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
    const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

    // Confirm Dialog State
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
        fetchAvatars();
    }, []);

    const fetchAvatars = async () => {
        setIsLoading(true);
        try {
            const res = await api.getVRMModels();
            if (res.code === 200 || (res as any).success) {
                setAvatars(res.data || []);
            }
        } catch (error) {
            console.error('Failed to get 3D avatars:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadSave = async (data: { file: File; name: string; thumbnail: Blob; expressions: string[] }) => {
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('name', data.name);
        formData.append('thumbnail', data.thumbnail, 'thumbnail.jpg');
        formData.append('expressions', JSON.stringify(data.expressions));

        await api.uploadVRMModel(formData);
        await fetchAvatars();
        onAvatarsChange?.();
        setShowUploadPreview(false);
    };

    const handleEditSave = async (id: string, name: string) => {
        await api.updateVRMModel(id, { name });
        await fetchAvatars();
        onAvatarsChange?.();
        setEditingAvatar(null);
    };

    const handleDelete = async (id: string, name: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('admin.delete'),
            description: t('admin.confirmDeleteVRM', { name }),
            type: 'danger',
            onConfirm: async () => {
                // 清除之前的 Toast
                setToastMessage(null);

                const response = await api.deleteVRMModel(id);

                // 检查响应状态码
                if (response.code === 204 || response.code === 200) {
                    // 删除成功
                    await fetchAvatars();
                    onAvatarsChange?.();
                    setToastMessage({ success: true, message: t('vrm.avatar.deleteSuccess') });
                    setTimeout(() => setToastMessage(null), 3000);
                } else if (response.code === 409) {
                    // 409 冲突错误（资源正在使用）
                    const detail = response.data as any;

                    if (detail && typeof detail === 'object' && detail.referenced_by) {
                        const referencedBy = detail.referenced_by || [];
                        const characterNames = referencedBy
                            .map((ref: any) => ref.name)
                            .join('、');

                        setToastMessage({
                            success: false,
                            message: t('vrm.avatar.inUseByCharacters', { characterNames })
                        });
                        setTimeout(() => setToastMessage(null), 5000);
                    } else {
                        // 提取错误消息
                        const errorMsg = typeof detail === 'object' && detail.message
                            ? detail.message
                            : (typeof response.message === 'string' ? response.message : t('vrm.avatar.inUse'));

                        setToastMessage({
                            success: false,
                            message: errorMsg
                        });
                        setTimeout(() => setToastMessage(null), 3000);
                    }
                } else {
                    // 其他错误 - 安全地提取错误消息
                    let errorMsg = t('vrm.avatar.unknownError');
                    if (typeof response.message === 'string') {
                        errorMsg = response.message;
                    } else if (typeof response.message === 'object' && response.message !== null) {
                        errorMsg = (response.message as any).message || JSON.stringify(response.message);
                    }

                    setToastMessage({
                        success: false,
                        message: t('vrm.avatar.deleteFailed', { errorMsg })
                    });
                    setTimeout(() => setToastMessage(null), 3000);
                }
            }
        });
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Toast message={toastMessage} title={{ success: t('vrm.avatar.operationSuccess'), error: t('vrm.avatar.operationFailed') }} />
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between bg-background border-b border-border">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-foreground">{t('admin.avatar3DLibrary')}</h2>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {avatars.length}
                    </span>
                </div>
                <Button onClick={() => setShowUploadPreview(true)} size="sm" className="gap-2">
                    <Plus size={16} />
                    {t('admin.uploadVRMModel')}
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                    </div>
                ) : avatars.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
                            <Box size={40} className="text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">{t('admin.noAvatarsYet')}</h3>
                        <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                            {t('admin.uploadFirstVRM')}
                        </p>
                        <Button onClick={() => setShowUploadPreview(true)} className="gap-2">
                            <Plus size={18} />
                            {t('admin.uploadVRMModel')}
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {avatars.map(avatar => (
                            <div
                                key={avatar.id}
                                onClick={() => setEditingAvatar(avatar)}
                                className="group relative bg-card border border-border rounded-xl p-3 
                                       transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/50 cursor-pointer hover:z-10"
                            >
                                {/* Thumbnail - 3:4 ratio */}
                                <div className="relative w-full rounded-md overflow-hidden bg-muted/30 will-change-transform" style={{ paddingBottom: '133.33%' }}>
                                    {avatar.thumbnail_path ? (
                                        <img
                                            src={avatar.thumbnail_path}
                                            alt={avatar.name}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Box size={48} className="text-muted/60" />
                                        </div>
                                    )}

                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(avatar.id, avatar.name);
                                        }}
                                        className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center 
                                               text-primary rounded-md
                                               opacity-0 group-hover:opacity-100 transition-all duration-200
                                               hover:text-destructive hover:scale-110"
                                    >
                                        <Trash size={16} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Info */}
                                <div className="mt-3">
                                    <h3 className="text-lg font-bold text-foreground truncate leading-tight" title={avatar.name}>
                                        {avatar.name}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Preview Modal */}
            {showUploadPreview && (
                <VRMUploadPreview
                    onSave={handleUploadSave}
                    onCancel={() => setShowUploadPreview(false)}
                />
            )}

            {/* Edit Preview Modal */}
            {editingAvatar && (
                <VRMEditPreview
                    avatar={editingAvatar}
                    onSave={handleEditSave}
                    onClose={() => setEditingAvatar(null)}
                />
            )}

            {/* Confirm Dialog */}
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
        </div>
    );
};
