import React, { useState } from 'react';
import { Upload, X, Loader2, FileCode } from 'lucide-react';
import { Button } from '../../ui';
import { VRMPreview } from './VRMPreview';
import { VRMThumbnailGenerator } from './VRMThumbnailGenerator';

export const VRMUploadPreview: React.FC<{
    onSave: (data: { file: File; name: string; thumbnail: Blob }) => Promise<void>;
    onCancel: () => void;
}> = ({ onSave, onCancel }) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<Blob | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setName(selectedFile.name.replace(/\.vrm$/i, ''));
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSave = async () => {
        if (!file || !name.trim() || !thumbnail) return;
        setIsSaving(true);
        try { await onSave({ file, name: name.trim(), thumbnail }); } finally { setIsSaving(false); }
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
                                <p className="text-xl font-medium text-white mb-2">点击或拖拽上传 VRM 模型</p>
                                <p className="text-sm text-slate-400">支持 .vrm 格式文件</p>
                            </div>
                            <input type="file" accept=".vrm" className="hidden" onChange={handleFileChange} />
                        </label>
                    ) : (
                        previewUrl && <VRMPreview modelUrl={previewUrl} className="w-full h-full" autoRotate />
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
                            <h2 className="text-2xl font-semibold text-foreground">导入 3D 资产</h2>
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
                            {/* 文件选择 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">模型文件</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/50 group">
                                    <div className="flex flex-col items-center justify-center p-4 text-center">
                                        <Upload className="w-8 h-8 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <p className="text-sm font-medium text-foreground">
                                            {file ? file.name : "点击选择 VRM 文件"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">仅支持 .vrm 格式</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".vrm"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>

                            {/* 模型名称 */}
                            {file && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">角色名称</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-background border border-border text-foreground text-base focus:ring-2 focus:ring-primary focus:border-primary rounded-lg px-4 py-2.5 outline-none transition-all placeholder:text-muted-foreground"
                                            placeholder="输入角色名称..."
                                        />
                                    </div>

                                    {/* 缩略图生成状态 */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">缩略图</label>
                                        <div className={`text-xs rounded-lg px-3 py-2 ${thumbnail ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted/50 text-muted-foreground'}`}>
                                            {thumbnail ? '✓ 缩略图已生成' : '⏳ 正在生成缩略图...'}
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
                                取消
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!file || !name.trim() || !thumbnail || isSaving}
                                className="flex-1"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={16} />
                                        导入中...
                                    </>
                                ) : (
                                    "完成导入"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 缩略图生成器 */}
            {file && (
                <VRMThumbnailGenerator
                    file={file}
                    onThumbnailGenerated={(blob) => setThumbnail(blob)}
                    onError={() => { }}
                />
            )}
        </div>
    );
};
