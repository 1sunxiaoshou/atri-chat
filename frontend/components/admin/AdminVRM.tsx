import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash, X, Box, Film, Link as LinkIcon, Upload, Edit2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api/index';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal, Button, Input, ConfirmDialog } from '../ui';
import { getAnimationDuration } from '../../utils/vrmUtils';
import { extractExpressions } from '../../utils/vrmMetadataExtractor';

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
        onConfirm: () => {}
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
        if (!modal.type) {return;}
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
                if (formDescription) {formData.append('description', formDescription);}
                if (formDuration) {formData.append('duration', String(formDuration));}

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
                if (formDuration) {updates.duration = formDuration;}

                await api.updateVRMAnimation(anim.animation_id, updates);
                await fetchData();
                if (selectedModel) {fetchModelAnimations(selectedModel.vrm_model_id);} // Refresh if bound
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
                if (formDescription) {formData.append('description', formDescription);}
                if (formDuration) {formData.append('duration', String(formDuration));}

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
                if (selectedModel?.vrm_model_id === id) {setSelectedModel(null);}
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
                if (selectedModel) {fetchModelAnimations(selectedModel.vrm_model_id);}
            }
        });
    };

    const handleBindAnimation = async (animationId: string) => {
        if (!selectedModel) {return;}
        await api.addModelAnimation(selectedModel.vrm_model_id, animationId);
        await fetchModelAnimations(selectedModel.vrm_model_id);
    };

    const handleUnbindAnimation = async (animationId: string) => {
        if (!selectedModel) {return;}
        await api.removeModelAnimation(selectedModel.vrm_model_id, animationId);
        await fetchModelAnimations(selectedModel.vrm_model_id);
    };

    // --- Renders ---

    return (
        <div className="flex h-full gap-6 animate-fadeIn font-sans">
            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedModel ? 'md:w-2/3' : 'w-full'}`}>
                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => { setActiveTab('models'); setSelectedModel(null); }}
                        className={`pb-3 px-4 text-sm font-medium transition-all relative ${activeTab === 'models'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        {t('admin.vrmModels')}
                        {activeTab === 'models' && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('animations')}
                        className={`pb-3 px-4 text-sm font-medium transition-all relative ${activeTab === 'animations'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        {t('admin.animationsLibrary')}
                        {activeTab === 'animations' && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : activeTab === 'models' ? (
                        /* Models Grid */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {/* Upload Card */}
                            <button
                                onClick={openUploadModelModal}
                                className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all min-h-[200px] cursor-pointer"
                            >
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{t('admin.uploadVRM')}</span>
                                <span className="text-xs text-gray-500 mt-2">{t('admin.vrmFilesSupported')}</span>
                            </button>

                            {models.map(model => (
                                <div
                                    key={model.vrm_model_id}
                                    onClick={() => setSelectedModel(model)}
                                    className={`bg-white dark:bg-gray-800 border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg group relative flex flex-col
                                        ${selectedModel?.vrm_model_id === model.vrm_model_id
                                            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                                            : 'border-gray-200 dark:border-gray-700 shadow-sm'}`}
                                >
                                    <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative flex items-center justify-center overflow-hidden">
                                        {model.thumbnail_path ? (
                                            <img src={model.thumbnail_path} alt={model.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        ) : (
                                            <Box size={48} className="text-gray-300 dark:text-gray-600" />
                                        )}
                                        {/* Action Overlay */}
                                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openEditModelModal(model); }}
                                                className="p-2 bg-white/90 dark:bg-black/90 text-gray-700 dark:text-gray-300 rounded-lg hover:text-blue-500 shadow-sm backdrop-blur-sm"
                                                title={t('admin.edit')}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.vrm_model_id, model.name); }}
                                                className="p-2 bg-white/90 dark:bg-black/90 text-red-500 rounded-lg hover:text-red-600 shadow-sm backdrop-blur-sm"
                                                title={t('admin.delete')}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 truncate" title={model.name}>{model.name}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1 truncate">{model.vrm_model_id}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Animations List */
                        <div className="space-y-4">
                            <div className="flex justify-between items-end pb-2">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Film size={20} className="text-gray-400" />
                                    <span>{t('admin.animationsLibrary')}</span>
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                        {animations.length}
                                    </span>
                                </h3>
                                <Button
                                    onClick={openUploadAnimationModal}
                                    icon={<Plus size={16} />}
                                    className="shadow-sm hover:shadow-md transition-all"
                                >
                                    {t('admin.uploadAnimation')}
                                </Button>
                            </div>

                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="px-6 py-4">{t('admin.name')} (ID)</th>
                                            <th className="px-6 py-4">{t('admin.animationDescription')}</th>
                                            <th className="px-6 py-4">{t('admin.animationDuration')}</th>
                                            <th className="px-6 py-4 text-right">{t('admin.status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {animations.map((anim) => (
                                            <tr key={anim.animation_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-500">
                                                            <Film size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-gray-100">{anim.name_cn || anim.name}</p>
                                                            <p className="text-xs text-gray-500 font-mono">{anim.animation_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                                                    {anim.description || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {anim.duration ? `${anim.duration}s` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditAnimationModal(anim)}
                                                            className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                                            title={t('admin.edit')}
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAnimation(anim.animation_id)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                            title={t('admin.delete')}
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {animations.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                                    {t('admin.noAnimationsFound')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Model Details */}
            {activeTab === 'models' && selectedModel && (
                <div className="w-[400px] flex-shrink-0 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Box className="text-blue-500" size={24} />
                                    {selectedModel.name}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{selectedModel.vrm_model_id}</p>
                            </div>
                            <button onClick={() => setSelectedModel(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            {/* Bound Animations */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <LinkIcon size={16} /> {t('admin.boundAnimations')} ({modelAnimations.length})
                                    </h4>
                                    <button
                                        onClick={() => openBindUploadAnimationModal(selectedModel.vrm_model_id)}
                                        className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer font-medium flex items-center gap-1 hover:underline"
                                    >
                                        <Plus size={14} /> {t('admin.uploadAndBind')}
                                    </button>
                                </div>

                                {modelAnimations.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                                        <p className="text-sm text-gray-500">{t('admin.noAnimationsBound')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {modelAnimations.map(anim => (
                                            <div key={anim.animation_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400">
                                                        <Film size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{anim.name_cn || anim.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{anim.animation_id}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUnbindAnimation(anim.animation_id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                                    title={t('admin.unbind')}
                                                >
                                                    <LinkIcon size={16} className="text-red-500 line-through" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Bind Existing Animation */}
                            <div>
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                    <Plus size={16} /> {t('admin.addExistingAnimation')}
                                </h4>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                        {animations.length === 0 && (
                                            <p className="p-4 text-center text-sm text-gray-500">{t('admin.noAvailableAnimations')}</p>
                                        )}
                                        {animations
                                            .filter(a => !modelAnimations.some(ma => ma.animation_id === a.animation_id))
                                            .map(anim => (
                                                <div key={anim.animation_id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-500">
                                                            <Film size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{anim.name_cn || anim.name}</p>
                                                            {anim.description && <p className="text-xs text-gray-500 truncate">{anim.description}</p>}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost" // Assuming 'ghost' exists or defaults to plain
                                                        onClick={() => handleBindAnimation(anim.animation_id)}
                                                        className="ml-2 text-xs"
                                                    >
                                                        {t('admin.bind')}
                                                    </Button>
                                                </div>
                                            ))}
                                        {animations.filter(a => !modelAnimations.some(ma => ma.animation_id === a.animation_id)).length === 0 && animations.length > 0 && (
                                            <p className="p-4 text-center text-sm text-gray-500">{t('admin.noAvailableAnimations')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                <div className="p-6 space-y-4">
                    {/* File Input (Upload modes only) */}
                    {(modal.type?.includes('upload')) && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {modal.type === 'model_upload' ? t('admin.vrmFile') : t('admin.animationFile')}
                            </label>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-3 text-gray-400" />
                                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-semibold">Click to upload</span>
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {modal.type === 'model_upload' ? 'VRM' : 'VRMA'}
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
                            {formFile && (
                                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <AlertCircle size={14} /> Selected: {formFile.name}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Thumbnail Upload (Model upload only) */}
                    {modal.type === 'model_upload' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('admin.thumbnail')} ({t('admin.optional')})
                            </label>
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 transition-colors">
                                <div className="flex flex-col items-center justify-center py-3">
                                    <Upload className="w-6 h-6 mb-2 text-gray-400" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        PNG / JPG
                                    </p>
                                </div>
                                <input
                                    ref={thumbnailInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    className="hidden"
                                    onChange={handleThumbnailChange}
                                />
                            </label>
                            {formThumbnail && (
                                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <AlertCircle size={14} /> Selected: {formThumbnail.name}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Name Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {modal.type?.includes('model') ? t('admin.modelName') : t('admin.animationEnglishId')}
                        </label>
                        <Input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={modal.type?.includes('model') ? "Enter model name" : "e.g. wave_hand"}
                            disabled={modal.type === 'anim_edit'}
                        />
                        {modal.type === 'anim_edit' && <p className="text-xs text-yellow-600 dark:text-yellow-500">{t('admin.animationIdCannotBeEdited')}</p>}
                    </div>

                    {/* Chinese Name (Animations only) */}
                    {(modal.type?.includes('anim')) && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.animationChineseName')}</label>
                            <Input
                                value={formNameCn}
                                onChange={(e) => setFormNameCn(e.target.value)}
                                placeholder={t('admin.animationChineseNamePlaceholder')}
                            />
                        </div>
                    )}

                    {/* Description (Animations only) */}
                    {(modal.type?.includes('anim')) && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.animationDescription')}</label>
                            <Input
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder={t('admin.animationDescriptionPlaceholder')}
                            />
                        </div>
                    )}

                    {/* Duration (Animations only) */}
                    {(modal.type?.includes('anim')) && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.animationDuration')}</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formDuration}
                                onChange={(e) => setFormDuration(parseFloat(e.target.value))}
                                placeholder="Duration in seconds"
                            />
                            {modal.type?.includes('upload') && formDuration === 0 && formFile && (
                                <p className="text-xs text-yellow-500 animate-pulse">Calculating duration...</p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>
                            {t('admin.cancel')}
                        </Button>
                        <Button
                            onClick={handleModalSubmit}
                            disabled={isSubmitting || (modal.type?.includes('upload') && !formFile)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
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
