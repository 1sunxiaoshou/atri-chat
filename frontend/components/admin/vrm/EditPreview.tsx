import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '../../ui';
import { VRMViewer } from '../../vrm/r3f';
import { useLanguage } from '../../../contexts/LanguageContext';

export const VRMEditPreview: React.FC<{
    avatar: { id: string; name: string; model_path: string };
    onSave: (id: string, name: string) => Promise<void>;
    onClose: () => void;
}> = ({ avatar, onSave, onClose }) => {
    const { t } = useLanguage();
    const [name, setName] = useState(avatar.name);
    const [isSaving, setIsSaving] = useState(false);
    const hasChanges = name.trim() !== avatar.name && name.trim() !== '';

    const handleSave = async () => {
        if (!hasChanges) return onClose();
        setIsSaving(true);
        try { await onSave(avatar.id, name.trim()); onClose(); } finally { setIsSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6" style={{ pointerEvents: 'auto' }}>
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex">

                {/* 左侧：3D 预览区 */}
                <div className="flex-1 relative bg-slate-900 rounded-l-2xl overflow-hidden">
                    <VRMViewer
                        modelUrl={avatar.model_path}
                        enableOrbitControls={true}
                        showGrid={true}
                        className="w-full h-full"
                    />
                </div>

                {/* 右侧：编辑面板 */}
                <div className="w-96 flex flex-col bg-card border-l border-border">
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <h2 className="text-2xl font-semibold text-foreground">{t('admin.editModel')}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* 编辑表单 */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">{t('admin.name')}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-background border border-border text-foreground text-base focus:ring-2 focus:ring-primary focus:border-primary rounded-lg px-4 py-2.5 outline-none transition-all placeholder:text-muted-foreground"
                                    placeholder="输入角色名称..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">模型路径</label>
                                <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg px-3 py-2 break-all">
                                    {avatar.model_path}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">角色 ID</label>
                                <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg px-3 py-2 break-all">
                                    {avatar.id}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 底部操作按钮 */}
                    <div className="p-6 border-t border-border bg-muted/30">
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="flex-1"
                                disabled={isSaving}
                            >
                                {t('admin.cancel')}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving}
                                className="flex-1"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={16} />
                                        {t('admin.saving')}
                                    </>
                                ) : (
                                    t('admin.save')
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
