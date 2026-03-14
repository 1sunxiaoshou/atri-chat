import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, FileCode } from 'lucide-react';
import { Button } from '../../ui';
import { VRMViewer, VRMViewerHandle } from '../../vrm/r3f';
import { useLanguage } from '../../../contexts/LanguageContext';

export const VRMUploadPreview: React.FC<{
    onSave: (data: { file: File; name: string; thumbnail: Blob; expressions: string[] }) => Promise<void>;
    onCancel: () => void;
}> = ({ onSave, onCancel }) => {
    const { t } = useLanguage();
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<Blob | null>(null);
    const [expressions, setExpressions] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

    const viewerRef = useRef<VRMViewerHandle>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setName(selectedFile.name.replace(/\.vrm$/i, ''));
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setThumbnail(null); // 重置缩略图
        }
    };

    // 当模型加载完成后，自动生成缩略图
    useEffect(() => {
        if (previewUrl && viewerRef.current) {
            // 等待模型完全加载和渲染
            const timer = setTimeout(async () => {
                try {
                    setIsGeneratingThumbnail(true);
                    const blob = await viewerRef.current!.captureScreenshot(512, 683);
                    setThumbnail(blob);
                    console.log(t('admin.thumbnailSuccess'));
                } catch (error) {
                    console.error(t('admin.thumbnailFailed'), error);
                } finally {
                    setIsGeneratingThumbnail(false);
                }
            }, 1500); // Wait 1.5s to ensure model is fully rendered

            return () => clearTimeout(timer);
        }
        return undefined;
    }, [previewUrl, t]);

    const handleSave = async () => {
        if (!file || !name.trim() || !thumbnail) return;
        setIsSaving(true);
        try {
            await onSave({ file, name: name.trim(), thumbnail, expressions });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6" style={{ pointerEvents: 'auto' }}>
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex">

                {/* 左侧：3D 预览区 */}
                <div className="flex-1 relative bg-slate-900 rounded-l-2xl overflow-hidden">
                    {!file ? (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/50 transition-all group">
                            <div className="flex flex-col items-center">
                                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Upload className="w-10 h-10 text-primary" />
                                </div>
                                <p className="text-xl font-medium text-white mb-2">{t('character.clickOrDragUpload')}</p>
                                <p className="text-sm text-slate-400">{t('character.supportVRMFormat')}</p>
                            </div>
                            <input type="file" accept=".vrm" className="hidden" onChange={handleFileChange} />
                        </label>
                    ) : (
                        previewUrl && (
                            <VRMViewer
                                ref={viewerRef}
                                modelUrl={previewUrl}
                                onModelLoaded={(exps) => setExpressions(exps)}
                                enableOrbitControls={true}
                                showGrid={true}
                                className="w-full h-full"
                            />
                        )
                    )}
                </div>

                {/* 右侧：上传表单 */}
                <div className="w-96 flex flex-col bg-card border-l border-border">
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <FileCode size={20} className="text-primary" />
                            </div>
                            <h2 className="text-2xl font-semibold text-foreground">{t('character.importAssets')}</h2>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* 上传表单 */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="space-y-6">
                            {/* 模型名称 */}
                            {file && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t('character.characterName')}</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-background border border-border text-foreground text-base focus:ring-2 focus:ring-primary focus:border-primary rounded-lg px-4 py-2.5 outline-none transition-all placeholder:text-muted-foreground"
                                            placeholder={t('character.enterCharacterName')}
                                        />
                                    </div>

                                    {/* 识别到的表情 */}
                                    {expressions.length > 0 && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground flex justify-between">
                                                <span>{t('character.expressions')}</span>
                                                <span className="text-xs text-muted-foreground">{expressions.length}</span>
                                            </label>
                                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-3 bg-muted/50 rounded-lg border border-border custom-scrollbar">
                                                {expressions.map((exp) => (
                                                    <span 
                                                        key={exp} 
                                                        className="px-2 py-0.5 bg-background border border-border rounded text-[10px] text-muted-foreground font-medium"
                                                    >
                                                        {exp}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 缩略图生成状态 */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">{t('character.thumbnail')}</label>
                                        <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${thumbnail
                                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                : isGeneratingThumbnail
                                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    : 'bg-muted/50 text-muted-foreground'
                                            }`}>
                                            {isGeneratingThumbnail && <Loader2 className="w-3 h-3 animate-spin" />}
                                            {thumbnail
                                                ? t('admin.syncSuccess')
                                                : isGeneratingThumbnail
                                                    ? t('vrm.avatar.generatingThumbnail')
                                                    : t('admin.loading')
                                            }
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 底部操作按钮 */}
                    <div className="p-6 border-t border-border bg-muted/30">
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onCancel}
                                className="flex-1"
                                disabled={isSaving}
                            >
                                {t('admin.cancel')}
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!file || !name.trim() || !thumbnail || isSaving || isGeneratingThumbnail}
                                className="flex-1"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={16} />
                                        {t('character.importing')}
                                    </>
                                ) : (
                                    t('character.completeImport')
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
