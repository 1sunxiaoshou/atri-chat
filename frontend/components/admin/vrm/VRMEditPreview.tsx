import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../../ui';
import { VRMPreview } from './VRMPreview';

interface Avatar {
    id: string;
    name: string;
    model_path: string;
    thumbnail_path?: string;
}

interface VRMEditPreviewProps {
    avatar: Avatar;
    onSave: (id: string, name: string) => Promise<void>;
    onClose: () => void;
}

/**
 * VRM编辑和预览组件
 * 点击模型卡片后显示，支持预览和编辑名称
 */
export const VRMEditPreview: React.FC<VRMEditPreviewProps> = ({
    avatar,
    onSave,
    onClose
}) => {
    const [name, setName] = useState(avatar.name);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setHasChanges(name.trim() !== avatar.name && name.trim() !== '');
    }, [name, avatar.name]);

    const handleSave = async () => {
        if (!hasChanges) {
            onClose();
            return;
        }

        setIsSaving(true);
        try {
            await onSave(avatar.id, name.trim());
            onClose();
        } catch (error) {
            console.error('保存失败:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        // 如果有未保存的更改，恢复原名称
        if (hasChanges) {
            setName(avatar.name);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">模型预览</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        disabled={isSaving}
                    >
                        <X size={20} />
                    </Button>
                </div>

                {/* Content - 3D Preview only - Fixed height */}
                <div className="flex-1 overflow-hidden p-6 min-h-0">
                    <div className="w-full h-full bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
                        <VRMPreview
                            modelUrl={avatar.model_path}
                            className="w-full h-full"
                            autoRotate={true}
                        />
                    </div>
                </div>

                {/* Footer - Inline label + Input + Actions */}
                <div className="border-t border-border">
                    <div className="p-6">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium text-foreground whitespace-nowrap">
                                模型名称
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="输入模型名称"
                                disabled={isSaving}
                                className="flex-1 max-w-md h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex items-center gap-3 ml-auto">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={isSaving}
                                >
                                    {hasChanges ? '取消' : '关闭'}
                                </Button>
                                {hasChanges && (
                                    <Button
                                        onClick={handleSave}
                                        loading={isSaving}
                                        className="gap-2"
                                    >
                                        <Save size={18} />
                                        {isSaving ? '保存中...' : '保存'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
