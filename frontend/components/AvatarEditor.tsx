import React, { useState, useRef } from 'react';
import { X, Check, Upload, Link, Image } from 'lucide-react';

interface AvatarEditorProps {
  currentAvatar: string;
  onSave: (avatarUrl: string) => void;
  onCancel: () => void;
}

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ currentAvatar, onSave, onCancel }) => {
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
    if (!avatarUrl) {return;}
    onSave(avatarUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="font-bold text-gray-800 text-lg">设置头像</h3>
          <button 
            onClick={onCancel} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white/50 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200">
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-full h-full object-cover"
                onError={() => setPreviewUrl('')}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Image size={48} />
              </div>
            )}
          </div>
        </div>

        {/* Upload Mode Tabs */}
        <div className="px-6 pt-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setUploadMode('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                uploadMode === 'url' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Link size={16} />
              URL地址
            </button>
            <button
              onClick={() => setUploadMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                uploadMode === 'file' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Upload size={16} />
              本地上传
            </button>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 space-y-4">
          {uploadMode === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                图片地址
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={handleUrlChange}
                placeholder="https://example.com/avatar.jpg"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          ) : (
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-8 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex flex-col items-center gap-2"
              >
                <Upload size={32} className="text-gray-400" />
                <span>{isUploading ? '上传中...' : '点击选择图片'}</span>
                <span className="text-xs text-gray-400">支持 JPG、PNG、GIF 格式</span>
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
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!avatarUrl}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={18} />
            确认
          </button>
        </div>
      </div>
    </div>
  );
};
