import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash, Upload, Edit2, Film, Clock } from 'lucide-react';
import { api } from '../../../services/api/index';
import { Modal, Button, Input, ConfirmDialog, Card } from '../../ui';
import Toast, { ToastMessage } from '../../ui/Toast';
import { VRMMotionPreviewOptimized } from './VRMMotionPreviewOptimized';
import { useLanguage } from '../../../contexts/LanguageContext';

interface Motion {
    id: string;
    name: string;
    file_url: string;
    animation_path: string;
    duration_ms: number;
    description?: string;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
}

interface AdminMotionsProps {
    onMotionsChange?: () => void;
}

type ModalType = 'upload' | 'edit';

interface ModalState {
    isOpen: boolean;
    type: ModalType | null;
    data?: Motion;
}

export const AdminMotions: React.FC<AdminMotionsProps> = ({ onMotionsChange }) => {
    const { t } = useLanguage();
    const [motions, setMotions] = useState<Motion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedMotion, setSelectedMotion] = useState<Motion | null>(null);
    const [modal, setModal] = useState<ModalState>({ isOpen: false, type: null });
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
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formFile, setFormFile] = useState<File | null>(null);
    const [formDurationMs, setFormDurationMs] = useState<number>(0);
    const [formTags, setFormTags] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchMotions();
    }, []);

    const fetchMotions = async () => {
        setIsLoading(true);
        try {
            const res = await api.getVRMAnimations();
            if (res.code === 200 || (res as any).success) {
                const data = res.data || [];
                setMotions(data);
                if (data.length > 0 && !selectedMotion) {
                    setSelectedMotion(data[0]);
                }
            }
        } catch (error) {
            console.error(t('vrm.motion.fetchFailed'), error);
        } finally {
            setIsLoading(false);
        }
    };

    const openUploadModal = () => {
        setFormName('');
        setFormDescription('');
        setFormFile(null);
        setFormDurationMs(2500);
        setFormTags('');
        setModal({ isOpen: true, type: 'upload' });
    };

    const openEditModal = (motion: Motion) => {
        setFormName(motion.name);
        setFormDescription(motion.description || '');
        setFormDurationMs(motion.duration_ms);
        setFormTags(motion.tags?.join(', ') || '');
        setModal({ isOpen: true, type: 'edit', data: motion });
    };

    const closeModal = () => {
        setModal({ isOpen: false, type: null, data: undefined });
        setFormName('');
        setFormDescription('');
        setFormFile(null);
        setFormDurationMs(0);
        setFormTags('');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormFile(file);
            const baseName = file.name.replace(/\.vrma$/i, '');
            if (!formName) {
                setFormName(baseName);
            }

            // Auto-detect animation duration
            try {
                const url = URL.createObjectURL(file);
                const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
                const { VRMAnimationLoaderPlugin } = await import('@pixiv/three-vrm-animation');

                const loader = new GLTFLoader();
                loader.register((parser: any) => new VRMAnimationLoaderPlugin(parser));

                const gltf = await loader.loadAsync(url);
                const vrmAnimations = gltf.userData?.vrmAnimations;

                if (vrmAnimations && vrmAnimations.length > 0) {
                    const duration = vrmAnimations[0].duration;
                    const durationMs = Math.round(duration * 1000);
                    setFormDurationMs(durationMs);
                    console.log(t('vrm.motion.autoDetectedDuration'), durationMs, 'ms');
                }

                URL.revokeObjectURL(url);
            } catch (error) {
                console.error(t('vrm.motion.cannotReadDuration'), error);
                // 保持默认值 2500ms
            }
        }
    };

    const handleModalSubmit = async () => {
        if (!modal.type) return;
        setIsSubmitting(true);

        try {
            if (modal.type === 'upload') {
                if (!formFile) {
                    alert(t('admin.pleaseSelectFile'));
                    return;
                }

                const formData = new FormData();
                formData.append('file', formFile);
                formData.append('name', formName);
                if (formDescription) formData.append('description', formDescription);
                if (formDurationMs) formData.append('duration_ms', String(formDurationMs));
                if (formTags) formData.append('tags', formTags);

                await api.uploadVRMAnimation(formData);
                await fetchMotions();
                onMotionsChange?.();
                closeModal();
            }
            else if (modal.type === 'edit') {
                const motion = modal.data!;
                const tagArray = formTags.split(',').map(t => t.trim()).filter(t => t);
                await api.updateVRMAnimation(motion.id, {
                    name: formName,
                    description: formDescription,
                    tags: tagArray
                });
                await fetchMotions();
                onMotionsChange?.();
                closeModal();
            }
        } catch (error) {
            console.error(t('vrm.motion.operationFailed'), error);
            alert(t('admin.operationFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('admin.confirmDeleteTitle'),
            description: t('admin.confirmDeleteMotion', { name }),
            type: 'danger',
            onConfirm: async () => {
                // 清除之前的 Toast
                setToastMessage(null);

                const response = await api.deleteVRMAnimation(id);

                // 检查响应状态码
                if (response.code === 204 || response.code === 200) {
                    // 删除成功
                    if (selectedMotion?.id === id) {
                        setSelectedMotion(null);
                    }
                    await fetchMotions();
                    onMotionsChange?.();
                    setToastMessage({ success: true, message: t('admin.motionDeleteSuccess') });
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
                            message: t('vrm.motion.inUseByCharacters', { characterNames })
                        });
                        setTimeout(() => setToastMessage(null), 5000);
                    } else {
                        // 提取错误消息
                        const errorMsg = typeof detail === 'object' && detail.message
                            ? detail.message
                            : (typeof response.message === 'string' ? response.message : t('vrm.motion.inUse'));

                        setToastMessage({
                            success: false,
                            message: errorMsg
                        });
                        setTimeout(() => setToastMessage(null), 3000);
                    }
                } else {
                    // 其他错误 - 安全地提取错误消息
                    let errorMsg = t('admin.unknownError');
                    if (typeof response.message === 'string') {
                        errorMsg = response.message;
                    } else if (typeof response.message === 'object' && response.message !== null) {
                        errorMsg = (response.message as any).message || JSON.stringify(response.message);
                    }

                    setToastMessage({
                        success: false,
                        message: t('vrm.motion.deleteFailed', { errorMsg })
                    });
                    setTimeout(() => setToastMessage(null), 3000);
                }
            }
        });
    };

    const handleMotionSelect = (motion: Motion) => {
        setSelectedMotion(motion);
    };

    return (
        <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Toast message={toastMessage} title={{ success: t('admin.operationSuccess'), error: t('admin.operationFailed') }} />
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <Film size={28} className="text-primary" />
                        动作库
                        <span className="text-base font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {motions.length}
                        </span>
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        管理VRMA格式的动画资产
                    </p>
                </div>
                <Button onClick={openUploadModal} className="gap-2">
                    <Plus size={18} />
                    上传动作
                </Button>
            </div>

            {/* Main Content - Split Layout */}
            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left: Motion Preview */}
                <div className="w-1/2 flex flex-col">
                    <Card className="flex-1 overflow-hidden border-border shadow-sm">
                        <div className="h-full flex flex-col">
                            <div className="px-4 py-3 border-b border-border bg-muted/30">
                                <h3 className="font-semibold text-foreground">动作预览</h3>
                            </div>
                            <div className="flex-1 p-4">
                                {selectedMotion ? (
                                    <VRMMotionPreviewOptimized
                                        motionUrl={selectedMotion.animation_path}
                                        motionName={selectedMotion.name}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <Film size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>{t('vrm.motion.selectToPreview')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right: Motion List and Info */}
                <div className="w-1/2 flex flex-col gap-6">
                    {/* Motion List */}
                    <Card className="flex-1 overflow-hidden border-border shadow-sm">
                        <div className="h-full flex flex-col">
                            <div className="px-4 py-3 border-b border-border bg-muted/30">
                                <h3 className="font-semibold text-foreground">动作列表</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                                    </div>
                                ) : motions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                                        <Film size={48} className="text-muted-foreground mb-4 opacity-50" />
                                        <h3 className="text-lg font-semibold text-foreground mb-2">{t('admin.noMotionsYet')}</h3>
                                        <p className="text-sm text-muted-foreground mb-6">
                                            {t('vrm.motion.uploadFirst')}
                                        </p>
                                        <Button onClick={openUploadModal} className="gap-2">
                                            <Upload size={18} />
                                            上传动作
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {motions.map((motion) => (
                                            <div
                                                key={motion.id}
                                                onClick={() => handleMotionSelect(motion)}
                                                className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${selectedMotion?.id === motion.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Film size={16} className="text-primary flex-shrink-0" />
                                                            <h4 className="font-medium text-foreground truncate">
                                                                {motion.name}
                                                            </h4>
                                                        </div>
                                                        {motion.description && (
                                                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                                                {motion.description}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                            {motion.duration_ms && (
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={12} />
                                                                    {t('vrm.motion.duration', { duration: (motion.duration_ms / 1000).toFixed(2) })}
                                                                </span>
                                                            )}
                                                            {motion.tags && motion.tags.length > 0 && (
                                                                <div className="flex gap-1 flex-wrap">
                                                                    {motion.tags.slice(0, 2).map((tag, idx) => (
                                                                        <span key={idx} className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                    {motion.tags.length > 2 && (
                                                                        <span className="text-muted-foreground">
                                                                            +{motion.tags.length - 2}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Motion Info */}
                    <Card className="border-border shadow-sm">
                        <div className="px-4 py-3 border-b border-border bg-muted/30">
                            <h3 className="font-semibold text-foreground">动作信息</h3>
                        </div>
                        <div className="p-4">
                            {selectedMotion ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">名称</label>
                                        <p className="text-sm text-foreground mt-1">{selectedMotion.name}</p>
                                    </div>
                                    {selectedMotion.description && (
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground">描述</label>
                                            <p className="text-sm text-foreground mt-1">{selectedMotion.description}</p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">{t('admin.durationMs')}</label>
                                        <p className="text-sm text-foreground mt-1">
                                            {t('vrm.motion.duration', { duration: (selectedMotion.duration_ms / 1000).toFixed(2) })}
                                        </p>
                                    </div>
                                    {selectedMotion.tags && selectedMotion.tags.length > 0 && (
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground">标签</label>
                                            <div className="flex gap-1 flex-wrap mt-1">
                                                {selectedMotion.tags.map((tag, idx) => (
                                                    <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">ID</label>
                                        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                                            {selectedMotion.id}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditModal(selectedMotion)}
                                            className="flex-1 gap-2"
                                        >
                                            <Edit2 size={14} />
                                            {t('admin.edit')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(selectedMotion.id, selectedMotion.name)}
                                            className="flex-1 gap-2 text-destructive hover:text-destructive"
                                        >
                                            <Trash size={14} />
                                            {t('admin.delete')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p className="text-sm">{t('vrm.motion.selectForInfo')}</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Upload/Edit Modal */}
            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.type === 'upload' ? t('admin.uploadMotion') : t('admin.editMotion')}
            >
                <div className="p-6 space-y-5">
                    {modal.type === 'upload' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('admin.motionFile')}</label>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50">
                                <div className="flex flex-col items-center justify-center p-4 text-center">
                                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                    <p className="text-sm font-semibold">{formFile ? formFile.name : t('vrm.motion.clickUpload')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('admin.onlyVRMAFormat')}</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".vrma"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            label={t('admin.motionName')}
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={t('admin.enterMotionName')}
                            required
                        />

                        <Input
                            label={t('admin.description')}
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            placeholder={t('admin.describeMotion')}
                        />

                        <Input
                            label={t('vrm.motion.durationMs')}
                            type="number"
                            value={formDurationMs}
                            onChange={(e) => setFormDurationMs(parseInt(e.target.value) || 0)}
                            placeholder="2500"
                        />

                        <Input
                            label={t('admin.tags')}
                            value={formTags}
                            onChange={(e) => setFormTags(e.target.value)}
                            placeholder={t('admin.tagsPlaceholder')}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
                            {t('admin.cancel')}
                        </Button>
                        <Button
                            onClick={handleModalSubmit}
                            disabled={isSubmitting || (modal.type === 'upload' && !formFile) || !formName}
                            loading={isSubmitting}
                        >
                            {isSubmitting ? t('admin.processing') : t('admin.save')}
                        </Button>
                    </div>
                </div>
            </Modal>

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
