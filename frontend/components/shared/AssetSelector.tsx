import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Mic } from 'lucide-react';
import { Avatar, VoiceAsset } from '../../types';
import { avatarsApi, voiceAssetsApi } from '../../services/api';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

interface AssetSelectorProps {
    type: 'avatar' | 'voice';
    value: string;
    onChange: (id: string) => void;
    label: string;
    onClose: () => void;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
    type,
    value,
    onChange,
    label,
    onClose
}) => {
    const [assets, setAssets] = useState<(Avatar | VoiceAsset)[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAssets();
    }, [type]);

    const loadAssets = async () => {
        setLoading(true);
        setError(null);
        try {
            if (type === 'avatar') {
                const response = await avatarsApi.getAvatars();
                if (response.code === 200) {
                    setAssets(response.data);
                } else {
                    setError(response.message);
                }
            } else {
                const response = await voiceAssetsApi.getVoiceAssets();
                if (response.code === 200) {
                    setAssets(response.data);
                } else {
                    setError(response.message);
                }
            }
        } catch (err) {
            setError('加载资产失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (id: string) => {
        onChange(id);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        {type === 'avatar' ? <ImageIcon size={20} /> : <Mic size={20} />}
                        {label}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && (
                        <div className="text-center py-12 text-muted-foreground">
                            加载中...
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-12 text-red-500">
                            {error}
                        </div>
                    )}

                    {!loading && !error && assets.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            暂无{type === 'avatar' ? '形象' : '音色'}资产
                        </div>
                    )}

                    {!loading && !error && assets.length > 0 && (
                        <div className={cn(
                            "grid gap-4",
                            type === 'avatar' ? "grid-cols-3" : "grid-cols-1"
                        )}>
                            {assets.map((asset) => (
                                <div
                                    key={asset.id}
                                    onClick={() => handleSelect(asset.id)}
                                    className={cn(
                                        "cursor-pointer border-2 rounded-xl transition-all hover:shadow-lg",
                                        value === asset.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    {type === 'avatar' ? (
                                        <div className="aspect-square overflow-hidden rounded-t-xl bg-muted">
                                            <img
                                                src={(asset as Avatar).thumbnail_url || (asset as Avatar).file_url}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Mic size={18} className="text-primary" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-foreground">{asset.name}</div>
                                                    {(asset as VoiceAsset).provider && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {(asset as VoiceAsset).provider?.name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-3 text-center">
                                        <div className="text-sm font-medium text-foreground truncate">
                                            {asset.name}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border">
                    <Button variant="outline" onClick={onClose} className="w-full">
                        取消
                    </Button>
                </div>
            </div>
        </div>
    );
};
