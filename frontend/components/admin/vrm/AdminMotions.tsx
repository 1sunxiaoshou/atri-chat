import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash, Upload, Edit2, Film, Clock, Search, Eye, EyeOff, Play } from 'lucide-react';
import { api } from '../../../services/api/index';
import { Modal, Button, Input, ConfirmDialog } from '../../ui';
import Toast, { ToastMessage } from '../../ui/Toast';
import { VRMViewer } from '../../vrm/r3f';
import { useLanguage } from '../../../contexts/LanguageContext';
import { cn } from '../../../utils/cn';
import { Motion } from '../../../types/motion';

interface AdminMotionsProps {
    onMotionsChange?: () => void;
}

// 默认 VRM 模型用于动作预览
const DEFAULT_VRM_MODEL = '/defaults/defaults.vrm';

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
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
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
                    setSelectedMotion(data[0] || null);
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
                    if (!isNaN(durationMs)) {
                        setFormDurationMs(durationMs);
                        console.log(t('vrm.motion.autoDetectedDuration'), durationMs, 'ms');
                    } else {
                        setFormDurationMs(2500);
                        console.log('Detected invalid duration, using default 2500ms');
                    }
                }

                URL.revokeObjectURL(url);
            } catch (error) {
                console.error(t('vrm.motion.cannotReadDuration'), error);
                // 保持默认值 2500ms
            }
        }
    };

    const handleModalSubmit = async () => {
        if (!modal.type) {return;}
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
                if (formDescription) {formData.append('description', formDescription);}
                if (formDurationMs !== undefined && !isNaN(formDurationMs)) {
                    formData.append('duration_ms', String(formDurationMs));
                }
                if (formTags) {formData.append('tags', formTags);}

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

    // 过滤动作列表
    const filteredMotions = motions.filter(motion => {
        if (!searchQuery) {return true;}
        const query = searchQuery.toLowerCase();
        return (
            motion.name.toLowerCase().includes(query) ||
            motion.description?.toLowerCase().includes(query) ||
            motion.tags?.some(tag => tag.toLowerCase().includes(query))
        );
    });

    return (
        <div className="h-full flex bg-background overflow-hidden animate-in fade-in duration-500">
            <Toast message={toastMessage} title={{ success: t('admin.operationSuccess'), error: t('admin.operationFailed') }} />

            {/* Left: Motion Preview - 25% */}
            <div className="w-[25%] min-w-[240px] max-w-[400px] flex flex-col border-r border-border">
                <div className="h-16 px-4 border-b border-border flex justify-between items-center bg-background">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{t('character.motionList')}</h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {filteredMotions.length}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsPreviewActive(!isPreviewActive)}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isPreviewActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"
                        )}
                        title={isPreviewActive ? t('admin.disablePreview') : t('admin.enablePreview')}
                    >
                        {isPreviewActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                </div>
                <div className="flex-1 relative bg-muted/10">
                    {isPreviewActive ? (
                        <VRMViewer
                            modelUrl={DEFAULT_VRM_MODEL}
                            motionUrl={selectedMotion?.animation_path || null}
                            title={selectedMotion?.name}
                            enableBlink={false}
                            lookAtMode="none"
                            loopMotion={true}
                            showGrid={true}
                            enableOrbitControls={true}
                            enableCameraFit={true}
                            className="h-full"
                        />
                    ) : (
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group hover:bg-muted/20 transition-colors"
                            onClick={() => setIsPreviewActive(true)}
                        >
                            <div className="w-16 h-16 rounded-full bg-background shadow-sm border border-border flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-primary/50 transition-all">
                                <Play size={24} className="text-muted-foreground group-hover:text-primary ml-1" />
                            </div>
                            <p className="text-sm font-medium text-foreground">{t('admin.clickToPreview')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('admin.saveResourcesTip')}</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Right: Motion List - flex-1 */}
            <main className="flex-1 flex flex-col min-w-0 bg-background relative">
                {/* Toolbar */}
                <div className="h-16 px-6 border-b border-border flex items-center justify-between gap-4 bg-background">
                    {/* 搜索框 */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input
                            type="text"
                            placeholder={t('admin.searchMotions')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    {/* 上传按钮 */}
                    <div className="flex items-center gap-2">
                        <Button onClick={openUploadModal} size="sm" title={t('admin.uploadMotion')}>
                            <Plus size={16} className="mr-2" />
                            {t('admin.uploadMotion')}
                        </Button>
                    </div>
                </div>

                {/* Motion List Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 backdrop-blur-sm sticky top-0 z-10 border-b border-border">
                            <tr>
                                <th className="pl-6 pr-4 py-3 font-medium text-muted-foreground">{t('admin.motionName')}</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground">{t('admin.tags')}</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('admin.duration')}</th>
                                <th className="pl-4 pr-6 py-3 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredMotions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                                                <Film size={32} className="text-muted-foreground" />
                                            </div>
                                            <p className="font-medium text-foreground mb-1">
                                                {motions.length === 0 ? t('admin.noMotionsYet') : t('admin.noMatchingVoices')}
                                            </p>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                {motions.length === 0 ? t('vrm.motion.uploadFirst') : t('admin.adjustSearchOrAdd')}
                                            </p>
                                            {motions.length === 0 && (
                                                <Button onClick={openUploadModal} className="gap-2">
                                                    <Upload size={18} />
                                                    {t('admin.uploadMotion')}
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredMotions.map((motion) => (
                                    <tr
                                        key={motion.id}
                                        onClick={() => handleMotionSelect(motion)}
                                        className={cn(
                                            "group cursor-pointer transition-colors",
                                            selectedMotion?.id === motion.id
                                                ? "bg-primary/10"
                                                : "hover:bg-muted/20"
                                        )}
                                    >
                                        <td className="pl-6 pr-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <Film size={16} className="text-primary flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground truncate">{motion.name}</p>
                                                    {motion.description && (
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                            {motion.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {motion.tags && motion.tags.length > 0 ? (
                                                    <>
                                                        {motion.tags.slice(0, 2).map((tag, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {motion.tags.length > 2 && (
                                                            <span className="text-xs text-muted-foreground">
                                                                +{motion.tags.length - 2}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock size={12} />
                                                <span>{(motion.duration_ms / 1000).toFixed(1)}s</span>
                                            </div>
                                        </td>
                                        <td className="pl-4 pr-6 py-4">
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditModal(motion);
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(motion.id, motion.name);
                                                    }}
                                                >
                                                    <Trash size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

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
        </div >
    );
};
