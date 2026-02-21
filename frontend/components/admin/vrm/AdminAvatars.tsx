import React, { useState, useEffect } from 'react';
import { Plus, Trash, Box } from 'lucide-react';
import { api } from '../../../services/api/index';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button, ConfirmDialog } from '../../ui';
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
            console.error('获取3D形象失败:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadSave = async (data: { file: File; name: string; thumbnail: Blob }) => {
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('name', data.name);
        formData.append('thumbnail', data.thumbnail, 'thumbnail.jpg');

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
                try {
                    await api.deleteVRMModel(id);
                    await fetchAvatars();
                    onAvatarsChange?.();
                } catch (error) {
                    console.error('删除失败:', error);
                    alert('删除失败，该形象可能正在被角色使用');
                }
            }
        });
    };

    return (
        <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">3D形象库</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        管理VRM格式的3D模型资产
                    </p>
                </div>
                <Button onClick={() => setShowUploadPreview(true)} className="gap-2">
                    <Plus size={18} />
                    上传VRM模型
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                    </div>
                ) : avatars.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
                            <Box size={40} className="text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">还没有3D形象</h3>
                        <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                            上传第一个VRM模型，开始创建你的虚拟角色
                        </p>
                        <Button onClick={() => setShowUploadPreview(true)} className="gap-2">
                            <Plus size={18} />
                            上传VRM模型
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {avatars.map(avatar => (
                            <div
                                key={avatar.id}
                                className="bg-card border border-border rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 group relative flex flex-col cursor-pointer"
                                onClick={() => setEditingAvatar(avatar)}
                            >
                                {/* Thumbnail */}
                                <div className="aspect-square bg-muted/30 relative flex items-center justify-center overflow-hidden">
                                    {avatar.thumbnail_path ? (
                                        <img
                                            src={avatar.thumbnail_path}
                                            alt={avatar.name}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                    ) : (
                                        <Box size={48} className="text-muted/60" />
                                    )}

                                    {/* Delete Button */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(avatar.id, avatar.name);
                                            }}
                                            className="h-8 w-8 bg-background/90 backdrop-blur-sm border-none shadow-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                                            title="删除"
                                        >
                                            <Trash size={14} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4 flex-1">
                                    <h4 className="font-bold text-foreground truncate text-sm mb-1" title={avatar.name}>
                                        {avatar.name}
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground font-mono truncate opacity-70">
                                        {avatar.id}
                                    </p>
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
