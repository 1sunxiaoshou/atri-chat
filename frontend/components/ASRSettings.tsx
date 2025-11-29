import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ASRProvider } from '../types';
import { Check, AlertTriangle, Eye, EyeOff, Loader2, Save, Activity } from 'lucide-react';

const ASRSettings: React.FC = () => {
    const [providers, setProviders] = useState<ASRProvider[]>([]);
    const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        setLoading(true);
        try {
            const res = await api.getASRProviders();
            if (res.code === 200) {
                setProviders(res.data.providers);
                setActiveProviderId(res.data.active_provider);
                if (res.data.active_provider) {
                    setSelectedProviderId(res.data.active_provider);
                    const active = res.data.providers.find(p => p.id === res.data.active_provider);
                    if (active && active.config) {
                        setFormData(active.config);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch ASR providers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedProviderId(newId);
        setTestResult(null);
        setSaveResult(null);

        if (!newId) {
            setFormData({});
            return;
        }

        const provider = providers.find(p => p.id === newId);
        if (provider) {
            setFormData(provider.config || {});
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
        setTestResult(null);
        setSaveResult(null);
    };

    const toggleSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleTestConnection = async () => {
        if (!selectedProviderId) return;
        setTesting(true);
        setTestResult(null);
        setSaveResult(null);
        try {
            const res = await api.testASRConnection(selectedProviderId, formData);
            if (res.code === 200 && res.data?.success) {
                setTestResult({ success: true, message: res.data.message || res.message || '连接成功' });
            } else {
                const errorMsg = res.data?.message || res.message || '连接失败';
                setTestResult({ success: false, message: errorMsg });
            }
        } catch (error: any) {
            const errorMsg = error?.message || '网络错误或服务不可用';
            setTestResult({ success: false, message: errorMsg });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveResult(null);
        setTestResult(null);

        try {
            const res = await api.saveASRConfig(
                selectedProviderId || 'none',
                selectedProviderId ? formData : {}
            );

            if (res.code === 200) {
                setActiveProviderId(selectedProviderId || null);
                setSaveResult({
                    success: true,
                    message: selectedProviderId ? '配置已保存' : 'ASR已禁用'
                });

                setTimeout(() => setSaveResult(null), 3000);

                if (selectedProviderId) {
                    setProviders(prev => prev.map(p =>
                        p.id === selectedProviderId
                            ? { ...p, is_configured: true, config: formData }
                            : p
                    ));
                }
            } else {
                setSaveResult({
                    success: false,
                    message: res.message || '保存失败'
                });
            }
        } catch (error: any) {
            setSaveResult({
                success: false,
                message: error?.message || '网络错误'
            });
        } finally {
            setSaving(false);
        }
    };

    const renderFormFields = () => {
        if (!selectedProviderId) return <div className="text-gray-500 italic">选择服务商以进行配置</div>;

        const configKeys = Object.keys(formData);
        if (configKeys.length === 0) {
            return <div className="text-gray-500 italic">该服务商暂无配置项</div>;
        }

        const fields = configKeys.map(key => ({
            key,
            label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            type: key.includes('key') || key.includes('secret') || key.includes('password') ? 'password' : 'text',
        }));

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {fields.map((field) => {
                    const currentValue = formData[field.key];
                    const displayValue = currentValue === null || currentValue === undefined ? '' : String(currentValue);

                    return (
                        <div key={field.key} className="space-y-1">
                            <label className="block text-sm font-medium text-gray-300">
                                {field.label}
                            </label>
                            <div className="relative">
                                <input
                                    type={field.type === 'password' && showSecrets[field.key] ? 'text' : field.type}
                                    value={displayValue}
                                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                {field.type === 'password' && (
                                    <button
                                        type="button"
                                        onClick={() => toggleSecret(field.key)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        {showSecrets[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* 顶部区域：Provider 选择器 + 结果通知 */}
            <div className="flex-shrink-0 space-y-3">
                {/* Provider 选择器 */}
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                            Provider
                        </label>
                        <div className="relative flex-1">
                            <select
                                value={selectedProviderId}
                                onChange={handleProviderChange}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:border-gray-600"
                            >
                                <option value="">无（禁用ASR）</option>
                                {providers.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.is_configured ? '✅' : '⚠️'}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                ▼
                            </div>
                        </div>
                    </div>
                </div>

                {/* 结果通知区域 - 固定位置 */}
                <div className="min-h-[52px] flex items-center">
                    {saveResult && (
                        <div className={`w-full p-3 rounded-lg border text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${saveResult.success
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {saveResult.success ? <Check size={16} /> : <AlertTriangle size={16} />}
                            <span className="flex-1">{saveResult.message}</span>
                        </div>
                    )}

                    {testResult && !saveResult && (
                        <div className={`w-full p-3 rounded-lg border text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 ${testResult.success
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {testResult.success ? <Check size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
                            <div className="flex-1">
                                <div className="font-medium">{testResult.success ? '连接测试成功' : '连接测试失败'}</div>
                                {testResult.message && <div className="opacity-90 mt-1 text-xs">{testResult.message}</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 中部：配置表单区域 */}
            <div className="flex-1 min-h-0 flex flex-col">
                {selectedProviderId ? (
                    <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-800 flex-1 overflow-y-auto custom-scrollbar">
                        {renderFormFields()}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 italic bg-gray-800/30 rounded-xl border border-gray-800 border-dashed">
                        <div className="mb-2 text-4xl">⚙️</div>
                        <div>请选择上方的服务商进行配置</div>
                    </div>
                )}
            </div>

            {/* 底部：操作按钮 - 固定位置 */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 pt-2">
                {selectedProviderId && (
                    <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all border border-gray-700 hover:border-gray-600 bg-gray-800 hover:bg-gray-750 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {testing ? <Loader2 className="animate-spin" size={18} /> : <Activity size={18} />}
                        <span>测试连接</span>
                    </button>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    <span>保存配置</span>
                </button>
            </div>
        </div>
    );
};

export default ASRSettings;
