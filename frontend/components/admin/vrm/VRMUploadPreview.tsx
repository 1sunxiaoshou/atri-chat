import React, { useState, useRef } from 'react';
import { Upload, Save, X, Loader2 } from 'lucide-react';
import { Button } from '../../ui';
import { VRMPreview } from './VRMPreview';
import { VRMThumbnailGenerator } from './VRMThumbnailGenerator';

interface VRMUploadPreviewProps {
    onSave: (data: { file: File; name: string; thumbnail: Blob }) => Promise<void>;
    onCancel: () => void;
}

/**
 * VRM上传和预览组件
 * 上传文件后显示3D预览，保存时自动生成缩略图
 */
export const VRMUploadPreview: React.FC<VRMUploadPreviewProps> = ({
    onSave,
    onCancel
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<Blob | null>(null);
    const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const baseName = selectedFile.name.replace(/\.vrm$/i, '');
            if (!name) {
                setName(baseName);
            }
            // 创建预览URL
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            // 开始生成缩略图
            setIsGeneratingThumbnail(true);
        }
    };

    const handleThumbnailGenerated = (blob: Blob) => {
        setThumbnail(blob);
        setIsGeneratingThumbnail(false);
    };

    const handleThumbnailError = (error: string) => {
        console.error('缩略图生成失败:', error);
        setIsGeneratingThumbnail(false);
    };

    const handleSave = async () => {
        if (!file || !name.trim() || !thumbnail) return;

        setIsSaving(true);
        try {
            await onSave({ file, name: name.trim(), thumbnail });
            // 清理URL
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        } catch (error) {
            console.error('保存失败:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        onCancel();
    };

    const canSave = file && name.trim() && thumbnail && !isGeneratingThumbnail && !isSaving;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">上传VRM模型</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCancel}
                        disabled={isSaving}
                    >
                        <X size={20} />
                    </Button>
                </div>

                {/* Content - 3D Preview only - Fixed height */}
                <div className="flex-1 overflow-hidden p-6 min-h-0">
                    <div className="w-full h-full bg-muted/30 rounded-lg overflow-hidden border-2 border-dashed border-border flex items-center justify-center">
                        {!file ? (
                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                <Upload className="w-16 h-16 text-muted-foreground mb-4" />
                                <p className="text-lg font-medium text-foreground mb-2">点击上传VRM文件</p>
                                <p className="text-sm text-muted-foreground">支持 .vrm 格式</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".vrm"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        ) : previewUrl ? (
                            <VRMPreview
                                modelUrl={previewUrl}
                                className="w-full h-full"
                                autoRotate={true}
                            />
                        ) : null}
                    </div>
                </div>

                {/* Footer - Inline label + Input + Actions */}
                <div className="border-t border-border">
                    <div className="p-6">
                        {/* Status */}
                        {isGeneratingThumbnail && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>正在生成缩略图...</span>
                            </div>
                        )}

                        {/* Inline layout: Label + Input + Buttons */}
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
                                required
                                className="flex-1 max-w-md h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex items-center gap-3 ml-auto">
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                >
                                    取消
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={!canSave}
                                    loading={isSaving}
                                    className="gap-2"
                                >
                                    <Save size={18} />
                                    {isSaving ? '保存中...' : '保存'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Thumbnail Generator */}
            {file && (
                <VRMThumbnailGenerator
                    file={file}
                    onThumbnailGenerated={handleThumbnailGenerated}
                    onError={handleThumbnailError}
                />
            )}
        </div>
    );
};
