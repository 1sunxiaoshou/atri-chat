import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash, X, Box, Film, Link as LinkIcon, Upload, Edit2, PackageOpen } from 'lucide-react';
import { api } from '../../../services/api/index';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Modal, Button, Input, ConfirmDialog, Card, CardContent } from '../../ui';
import { getAnimationDuration } from '../../../utils/vrmUtils';
import { extractExpressions } from '../../../utils/vrmMetadataExtractor';
import { cn } from '../../../utils/cn';

// Define types based on API
interface VRMModel {
    vrm_model_id: string;
    name: string;
    model_path: string;
    thumbnail_path?: string;
    created_at?: string;
}

interface VRMAnimation {
    animation_id: string;
    name: string;
    name_cn?: string;
    description?: string;
    duration?: number;
    created_at?: string;
}

interface AdminVRMProps {
    onModelsChange?: () => void;
}

type ModalType = 'model_upload' | 'model_edit' | 'anim_upload' | 'anim_edit' | 'bind_anim_upload';

interface ModalState {
    isOpen: boolean;
    type: ModalType | null;
    data?: any; // For edit, this will be the item. For bind upload, it might be the modelId.
}

export const AdminVRM: React.FC<AdminVRMProps> = ({ onModelsChange }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'models' | 'animations'>('models');

    // Data States
    const [models, setModels] = useState<VRMModel[]>([]);
    const [animations, setAnimations] = useState<VRMAnimation[]>([]);
    const [selectedModel, setSelectedModel] = useState<VRMModel | null>(null);
    const [modelAnimations, setModelAnimations] = useState<VRMAnimation[]>([]);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [modal, setModal] = useState<ModalState>({ isOpen: false, type: null });

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

    // Form States (for Modal)
    const [formName, setFormName] = useState('');
    const [formNameCn, setFormNameCn] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formFile, setFormFile] = useState<File | null>(null);
    const [formThumbnail, setFormThumbnail] = useState<File | null>(null);
    const [formDuration, setFormDuration] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    useEffect(() => {
        if (selectedModel) {
            fetchModelAnimations(selectedModel.vrm_model_id);
            // 如果动画列表为空，加载全部动画以显示未绑定列表
            if (animations.length === 0) {
                api.getVRMAnimations().then(res => {
                    if (res.code === 200 || (res as any).success) {
                        setAnimations(res.data || []);
                    }
                });
            }
        }
    }, [selectedModel]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'models') {
                const res = await api.getVRMModels();
                if (res.code === 200 || (res as any).success) {
                    setModels(res.data || []);
                }
            } else {
                const res = await api.getVRMAnimations();
                if (res.code === 200 || (res as any).success) {
                    setAnimations(res.data || []);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchModelAnimations = async (modelId: string) => {
        const res = await api.getModelAnimations(modelId);
        if (res.code === 200 || (res as any).success) {
            setModelAnimations(res.data);
        }
    };

    // --- Modal Handlers ---

    const openUploadModelModal = () => {
        setFormName('');
        setFormFile(null);
        setFormThumbnail(null);
        setFormDuration(0);
        setModal({ isOpen: true, type: 'model_upload' });
    };

    const openEditModelModal = (model: VRMModel) => {
        setFormName(model.name);
        setModal({ isOpen: true, type: 'model_edit', data: model });
    };

    const openUploadAnimationModal = () => {
        setFormName('');
        setFormNameCn('');
        setFormDescription('');
        setFormFile(null);
        setFormDuration(0);
        setModal({ isOpen: true, type: 'anim_upload' });
    };

    const openEditAnimationModal = (anim: VRMAnimation) => {
        setFormName(anim.name);
        setFormNameCn(anim.name_cn || '');
        setFormDescription(anim.description || '');
        setFormDuration(anim.duration || 0);
        setModal({ isOpen: true, type: 'anim_edit', data: anim });
    };

    const openBindUploadAnimationModal = (modelId: string) => {
        setFormName('');
        setFormNameCn('');
        setFormFile(null);
        setFormDuration(0);
        setModal({ isOpen: true, type: 'bind_anim_upload', data: modelId });
    };

    const closeModal = () => {
        setModal({ isOpen: false, type: null, data: null });
        setFormName('');
        setFormNameCn('');
        setFormDescription('');
        setFormFile(null);
        setFormThumbnail(null);
        setFormDuration(0);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormFile(file);
            // Auto-fill name if empty
            const baseName = file.name.replace(/\.(vrm|vrma|fbx|bvh|vmd)$/i, '');
            if (!formName) {
                setFormName(baseName);
            }
            // Auto-fill Chinese name if empty (for animations)
            if ((modal.type === 'anim_upload' || modal.type === 'bind_anim_upload') && !formNameCn) {
                setFormNameCn(baseName);
            }

            // Calculate duration for animations
            if (modal.type === 'anim_upload' || modal.type === 'bind_anim_upload') {
                try {
                    const duration = await getAnimationDuration(file);
                    setFormDuration(Number(duration.toFixed(2)));
                } catch (error) {
                    console.error('Failed to get animation duration', error);
                }
            }
        }
    };

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormThumbnail(file);
        }
    };

    const handleModalSubmit = async () => {
        if (!modal.type) { return; }
        setIsSubmitting(true);

        try {
            if (modal.type === 'model_upload') {
                if (!formFile) {
                    alert('Please select a file');
                    return;
                }

                // 先解析VRM文件获取表情列表（轻量级提取）
                let availableExpressions: string[] = [];
                try {
                    availableExpressions = await extractExpressions(formFile);
                    console.log('✅ 解析到表情列表:', availableExpressions);
                } catch (error) {
                    console.warn('⚠️ 解析VRM表情列表失败:', error);
                    // 继续上传，只是没有表情列表
                }

                const formData = new FormData();
                formData.append('file', formFile);
                formData.append('name', formName);
                if (formThumbnail) {
                    formData.append('thumbnail', formThumbnail);
                }
                // 添加表情列表
                if (availableExpressions.length > 0) {
                    formData.append('available_expressions', JSON.stringify(availableExpressions));
                }

                await api.uploadVRMModel(formData);
                // 刷新当前组件的数据
                await fetchData();
                // 通知父组件更新（用于其他地方的VRM模型列表）
                onModelsChange?.();
                closeModal();
            }
            else if (modal.type === 'model_edit') {
                const model = modal.data as VRMModel;
                await api.updateVRMModel(model.vrm_model_id, { name: formName });
                // Update selected model if it's the one being edited
                if (selectedModel?.vrm_model_id === model.vrm_model_id) {
                    setSelectedModel({ ...selectedModel, name: formName });
                }
                // 刷新当前组件的数据
                await fetchData();
                // 通知父组件更新
                onModelsChange?.();
                closeModal();
            }
            else if (modal.type === 'anim_upload') {
                if (!formFile) {
                    alert('Please select a file');
                    return;
                }
                const formData = new FormData();
                formData.append('file', formFile);
                formData.append('name', formName);
                formData.append('name_cn', formNameCn);
                if (formDescription) { formData.append('description', formDescription); }
                if (formDuration) { formData.append('duration', String(formDuration)); }

                await api.uploadVRMAnimation(formData);
                await fetchData();
                closeModal();
            }
            else if (modal.type === 'anim_edit') {
                const anim = modal.data as VRMAnimation;
                // Update name_cn, description and duration
                const updates: any = {
                    name_cn: formNameCn,
                    description: formDescription
                };
                if (formDuration) { updates.duration = formDuration; }

                await api.updateVRMAnimation(anim.animation_id, updates);
                await fetchData();
                if (selectedModel) { fetchModelAnimations(selectedModel.vrm_model_id); } // Refresh if bound
                closeModal();
            }
            else if (modal.type === 'bind_anim_upload') {
                if (!formFile) {
                    alert('Please select a file');
                    return;
                }
                const modelId = modal.data as string;
                const formData = new FormData();
                formData.append('file', formFile);
                formData.append('name', formName);
                formData.append('name_cn', formNameCn);
                if (formDescription) { formData.append('description', formDescription); }
                if (formDuration) { formData.append('duration', String(formDuration)); }

                await api.uploadAndBindModelAnimation(modelId, formData);
                await fetchModelAnimations(modelId);
                closeModal();
            }
        } catch (error) {
            console.error('Operation failed:', error);
            alert(t('admin.uploadFailed')); // Simple alert for now
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Direct Handlers ---

    const handleDeleteModel = async (id: string, name: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('admin.delete'),
            description: t('admin.confirmDeleteVRM', { name }),
            type: 'danger',
            onConfirm: async () => {
                await api.deleteVRMModel(id);
                if (selectedModel?.vrm_model_id === id) { setSelectedModel(null); }
                // 刷新当前组件的数据
                await fetchData();
                // 通知父组件更新
                onModelsChange?.();
            }
        });
    };

    const handleDeleteAnimation = async (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: t('admin.delete'),
            description: t('admin.confirmDeleteAnimation'),
            type: 'danger',
            onConfirm: async () => {
                await api.deleteVRMAnimation(id);
                await fetchData();
                if (selectedModel) { fetchModelAnimations(selectedModel.vrm_model_id); }
            }
        });
    };

    const handleBindAnimation = async (animationId: string) => {
        if (!selectedModel) { return; }
        await api.addModelAnimation(selectedModel.vrm_model_id, animationId);
        await fetchModelAnimations(selectedModel.vrm_model_id);
    };

    const handleUnbindAnimation = async (animationId: string) => {
        if (!selectedModel) { return; }
        await api.removeModelAnimation(selectedModel.vrm_model_id, animationId);
        await fetchModelAnimations(selectedModel.vrm_model_id);
    };

    // --- Renders ---

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-border">
                    <button
                        onClick={() => { setActiveTab('models'); setSelectedModel(null); }}
                        className={cn(
                            "pb-3 px-4 text-sm font-medium transition-all relative whitespace-nowrap",
                            activeTab === 'models'
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t('admin.vrmModels')}
                        {activeTab === 'models' && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('animations')}
                        className={cn(
                            "pb-3 px-4 text-sm font-medium transition-all relative whitespace-nowrap",
                            activeTab === 'animations'
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t('admin.animationsLibrary')}
                        {activeTab === 'animations' && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                        </div>
                    ) : activeTab === 'models' ? (
                        /* Models Grid */
                        models.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-6">
                                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
                                    <PackageOpen size={40} className="text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">{t('admin.noVRMModels')}</h3>
                                <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                                    {t('admin.uploadFirstVRM')}
                                </p>
                                <Button onClick={openUploadModelModal} className="gap-2">
                                    <Upload size={18} />
                                    {t('admin.uploadVRM')}
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {/* Upload Card */}
                                <button
                                    onClick={openUploadModelModal}
                                    className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all min-h-[220px] cursor-pointer"
                                >
                                    <div className="bg-primary/10 p-4 rounded-full mb-4 text-primary group-hover:scale-110 transition-transform">
                                        <Upload size={32} />
                                    </div>
                                    <span className="font-medium text-foreground">{t('admin.uploadVRM')}</span>
                                    <span className="text-xs text-muted-foreground mt-2">{t('admin.vrmFilesSupported')}</span>
                                </button>

                                {models.map(model => (
                                    <div
                                        key={model.vrm_model_id}
                                        onClick={() => setSelectedModel(model)}
                                        className={cn(
                                            "bg-card border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg group relative flex flex-col",
                                            selectedModel?.vrm_model_id === model.vrm_model_id
                                                ? "border-primary ring-2 ring-primary/20 shadow-md"
                                                : "border-border shadow-sm"
                                        )}
                                    >
                                        <div className="aspect-square bg-muted/30 relative flex items-center justify-center overflow-hidden">
                                            {model.thumbnail_path ? (
                                                <img src={model.thumbnail_path} alt={model.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            ) : (
                                                <Box size={48} className="text-muted/60" />
                                            )}
                                            {/* Action Overlay */}
                                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); openEditModelModal(model); }}
                                                    className="h-8 w-8 bg-background/90 backdrop-blur-sm border-none shadow-sm hover:text-primary"
                                                    title={t('admin.edit')}
                                                >
                                                    <Edit2 size={14} />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.vrm_model_id, model.name); }}
                                                    className="h-8 w-8 bg-background/90 backdrop-blur-sm border-none shadow-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    title={t('admin.delete')}
                                                >
                                                    <Trash size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1">
                                            <h4 className="font-bold text-foreground truncate text-sm" title={model.name}>{model.name}</h4>
                                            <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate opacity-70">{model.vrm_model_id}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        /* Animations List */
                        animations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-6">
                                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-background shadow-2xl">
                                    <Film size={40} className="text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">{t('admin.noAnimationsFound')}</h3>
                                <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                                    {t('admin.uploadFirstAnimation')}
                                </p>
                                <Button onClick={openUploadAnimationModal} className="gap-2">
                                    <Upload size={18} />
                                    {t('admin.uploadAnimation')}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2">
                                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                        <Film size={20} className="text-primary" />
                                        <span>{t('admin.animationsLibrary')}</span>
                                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                            {animations.length}
                                        </span>
                                    </h3>
                                    <Button
                                        size="sm"
                                        onClick={openUploadAnimationModal}
                                        className="gap-2"
                                    >
                                        <Plus size={16} />
                                        {t('admin.uploadAnimation')}
                                    </Button>
                                </div>

                                <Card className="overflow-hidden border-border shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                                                    <th className="px-6 py-3 font-medium">{t('admin.name')} (ID)</th>
                                                    <th className="px-6 py-3 font-medium">{t('admin.animationDescription')}</th>
                                                    <th className="px-6 py-3 font-medium">{t('admin.animationDuration')}</th>
                                                    <th className="px-6 py-3 text-right font-medium">{t('admin.status')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {animations.map((anim) => (
                                                    <tr key={anim.animation_id} className="hover:bg-muted/30 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                                    <Film size={18} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-foreground truncate">{anim.name_cn || anim.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground font-mono truncate opacity-70">{anim.animation_id}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                                                            {anim.description || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-muted-foreground">
                                                            {anim.duration ? `${anim.duration}s` : '-'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => openEditAnimationModal(anim)}
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                    title={t('admin.edit')}
                                                                >
                                                                    <Edit2 size={16} />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteAnimation(anim.animation_id)}
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                    title={t('admin.delete')}
                                                                >
                                                                    <Trash size={16} />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Right Panel - Model Details */}
            {activeTab === 'models' && selectedModel && (
                <Card className="w-full lg:w-96 shrink-0 flex flex-col h-[500px] lg:h-full animate-in slide-in-from-right-4 duration-300 overflow-hidden shadow-lg border-primary/20">
                    <div className="p-4 border-b border-border flex justify-between items-start bg-muted/30">
                        <div className="min-w-0">
                            <h3 className="font-bold text-foreground flex items-center gap-2 truncate">
                                <Box className="text-primary shrink-0" size={20} />
                                {selectedModel.name}
                            </h3>
                            <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate opacity-70">{selectedModel.vrm_model_id}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedModel(null)}
                            className="h-8 w-8 shrink-0"
                        >
                            <X size={18} />
                        </Button>
                    </div>

                    <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {/* Bound Animations */}
                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <LinkIcon size={14} className="text-primary" />
                                    {t('admin.boundAnimations')}
                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{modelAnimations.length}</span>
                                </h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openBindUploadAnimationModal(selectedModel.vrm_model_id)}
                                    className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <Plus size={12} className="mr-1" /> {t('admin.uploadAndBind')}
                                </Button>
                            </div>

                            {modelAnimations.length === 0 ? (
                                <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
                                    <p className="text-xs text-muted-foreground italic">{t('admin.noAnimationsBound')}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {modelAnimations.map(anim => (
                                        <div key={anim.animation_id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg group hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-1.5 bg-background rounded text-primary ring-1 ring-border shrink-0">
                                                    <Film size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate">{anim.name_cn || anim.name}</p>
                                                    <p className="text-[9px] text-muted-foreground font-mono truncate opacity-70">{anim.animation_id}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleUnbindAnimation(anim.animation_id)}
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                                title={t('admin.unbind')}
                                            >
                                                <LinkIcon size={14} className="text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Bind Existing Animation */}
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                <Plus size={14} className="text-primary" /> {t('admin.addExistingAnimation')}
                            </h4>
                            <Card className="border-border bg-muted/10">
                                <div className="max-h-[300px] overflow-y-auto divide-y divide-border custom-scrollbar">
                                    {animations
                                        .filter(a => !modelAnimations.some(ma => ma.animation_id === a.animation_id))
                                        .map(anim => (
                                            <div key={anim.animation_id} className="flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="shrink-0 p-1.5 bg-background rounded text-muted-foreground ring-1 ring-border">
                                                        <Film size={14} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-foreground truncate">{anim.name_cn || anim.name}</p>
                                                        {anim.description && <p className="text-[9px] text-muted-foreground truncate">{anim.description}</p>}
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleBindAnimation(anim.animation_id)}
                                                    className="h-7 text-[10px] text-primary hover:bg-primary/10 ml-2"
                                                >
                                                    {t('admin.bind')}
                                                </Button>
                                            </div>
                                        ))}
                                    {animations.filter(a => !modelAnimations.some(ma => ma.animation_id === a.animation_id)).length === 0 && (
                                        <p className="p-6 text-center text-xs text-muted-foreground italic">
                                            {animations.length > 0 ? "所有动画已绑定" : t('admin.noAvailableAnimations')}
                                        </p>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Modal */}
            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={
                    modal.type === 'model_upload' ? t('admin.uploadVRM') :
                        modal.type === 'model_edit' ? t('admin.editVRM') :
                            modal.type === 'anim_upload' ? t('admin.uploadAnimation') :
                                modal.type === 'anim_edit' ? t('admin.editAnimation') :
                                    modal.type === 'bind_anim_upload' ? t('admin.uploadAndBind') : ''
                }
            >
                <div className="p-6 space-y-5">
                    {/* File Input (Upload modes only) */}
                    {(modal.type?.includes('upload')) && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {modal.type === 'model_upload' ? t('admin.vrmFile') : t('admin.animationFile')}
                            </label>
                            <label className={cn(
                                "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all",
                                formFile
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50"
                            )}>
                                <div className="flex flex-col items-center justify-center p-4 text-center">
                                    <Upload className={cn("w-8 h-8 mb-2", formFile ? "text-primary" : "text-muted-foreground")} />
                                    <p className="text-sm font-semibold">{formFile ? formFile.name : "点击上传文件"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {modal.type === 'model_upload' ? '仅支持 .vrm 格式' : '仅支持 .vrma 格式'}
                                    </p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={modal.type === 'model_upload' ? ".vrm" : ".vrma"}
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>
                    )}

                    {/* Thumbnail Upload (Model upload only) */}
                    {modal.type === 'model_upload' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {t('admin.thumbnail')} <span className="text-muted-foreground font-normal">({t('admin.optional')})</span>
                            </label>
                            <label className={cn(
                                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all",
                                formThumbnail
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50"
                            )}>
                                <div className="flex flex-col items-center justify-center p-2 text-center">
                                    <Upload className={cn("w-6 h-6 mb-1", formThumbnail ? "text-primary" : "text-muted-foreground")} />
                                    <p className="text-xs font-medium">{formThumbnail ? formThumbnail.name : "PNG / JPG"}</p>
                                </div>
                                <input
                                    ref={thumbnailInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    className="hidden"
                                    onChange={handleThumbnailChange}
                                />
                            </label>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            label={modal.type?.includes('model') ? t('admin.modelName') : t('admin.animationEnglishId')}
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={modal.type?.includes('model') ? "Enter model name" : "e.g. wave_hand"}
                            disabled={modal.type === 'anim_edit'}
                            description={modal.type === 'anim_edit' ? t('admin.animationIdCannotBeEdited') : undefined}
                            required
                        />

                        {(modal.type?.includes('anim')) && (
                            <>
                                <Input
                                    label={t('admin.animationChineseName')}
                                    value={formNameCn}
                                    onChange={(e) => setFormNameCn(e.target.value)}
                                    placeholder={t('admin.animationChineseNamePlaceholder')}
                                />
                                <Input
                                    label={t('admin.animationDescription')}
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder={t('admin.animationDescriptionPlaceholder')}
                                />
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{t('admin.animationDuration')}</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formDuration}
                                        onChange={(e) => setFormDuration(parseFloat(e.target.value))}
                                        placeholder="Duration in seconds"
                                    />
                                    {modal.type?.includes('upload') && formDuration === 0 && formFile && (
                                        <p className="text-[10px] text-primary animate-pulse font-medium">自动计算时长中...</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
                            {t('admin.cancel')}
                        </Button>
                        <Button
                            onClick={handleModalSubmit}
                            disabled={isSubmitting || (modal.type?.includes('upload') && !formFile) || !formName}
                            loading={isSubmitting}
                        >
                            {isSubmitting ? t('admin.uploading') : t('admin.save')}
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
