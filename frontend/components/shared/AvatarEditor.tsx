import React, { useState, useRef } from 'react';
import { Check, Upload, Link, Image as ImageIcon } from 'lucide-react';
import { Modal, Button, Input } from '../ui';
import { cn } from '../../utils/cn';
import { useLanguage } from '../../contexts/LanguageContext';

interface AvatarEditorProps {
  currentAvatar: string;
  onSave: (avatarUrl: string) => void;
  onCancel: () => void;
}

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ currentAvatar, onSave, onCancel }) => {
  const { t } = useLanguage();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || '');
  const [previewUrl, setPreviewUrl] = useState(currentAvatar || '');
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setPreviewUrl(url);
        setAvatarUrl(url);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setAvatarUrl(url);
    setPreviewUrl(url);
  };

  const handleSave = () => {
    if (!avatarUrl) { return; }
    onSave(avatarUrl);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={t('app.setAvatar')}
      size="md"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Preview Area */}
        <div className="p-8 bg-muted/30 flex justify-center border-b border-border">
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-background shadow-xl bg-muted shrink-0">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover animate-in fade-in duration-300"
                  onError={() => setPreviewUrl('')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                  <ImageIcon size={40} />
                </div>
              )}
            </div>
            {isUploading && (
              <div className="absolute inset-0 rounded-full bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Upload Mode Tabs */}
        <div className="px-6 pt-6">
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setUploadMode('url')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all",
                uploadMode === 'url'
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Link size={14} />
              URL地址
            </button>
            <button
              onClick={() => setUploadMode('file')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all",
                uploadMode === 'file'
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Upload size={14} />
              本地上传
            </button>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 flex-1 min-h-[120px]">
          {uploadMode === 'url' ? (
            <Input
              label={t('app.imageUrl')}
              type="text"
              value={avatarUrl}
              onChange={handleUrlChange}
              placeholder="https://example.com/avatar.jpg"
              className="w-full"
            />
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">本地文件</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-border rounded-xl p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-2"
              >
                <Upload size={24} className="opacity-50" />
                <span className="font-medium">{isUploading ? t('app.processing') : t('app.uploadImage')}</span>
                <span className="text-[10px] opacity-60">{t('app.supportedFormats')}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-border flex gap-3 bg-muted/10 shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!avatarUrl || isUploading}
            className="flex-1"
          >
            <Check size={18} className="mr-2" />
            确认
          </Button>
        </div>
      </div>
    </Modal>
  );
};
