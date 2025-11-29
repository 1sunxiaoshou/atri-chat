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
                // If there is an active provider, select it by default, otherwise select the first one or empty
                if (res.data.active_provider) {
                    setSelectedProviderId(res.data.active_provider);
                    const active = res.data.providers.find(p => p.id === res.data.active_provider);
                    if (active && active.config) {
                        setFormData(active.config);
                    }
                } else if (res.data.providers.length > 0) {
                    // Don't auto-select if no active provider, let user choose "None" or a provider
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

        if (!newId) {
            setFormData({});
            return;
        }

        const provider = providers.find(p => p.id === newId);
        if (provider) {
            // If we have config for this provider (e.g. it was active or we fetched details), use it
            // Note: The API might not return config for all providers in the list, only active. 
            // But based on the doc, we might need to handle empty config for new setup.
            // For now, assume we start fresh or use what's available.
            setFormData(provider.config || {});
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
        setTestResult(null);
    };

    const toggleSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleTestConnection = async () => {
        if (!selectedProviderId) return;
        setTesting(true);
        setTestResult(null);
        try {
            const res = await api.testASRConnection(selectedProviderId, formData);
            if (res.code === 200) {
                setTestResult({ success: true, message: 'Connection successful' });
            } else {
                setTestResult({ success: false, message: res.message || 'Connection failed' });
            }
        } catch (error) {
            setTestResult({ success: false, message: 'Network error or server unavailable' });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!selectedProviderId) return;
        setSaving(true);
        try {
            const res = await api.saveASRConfig(selectedProviderId, formData);
            if (res.code === 200) {
                setActiveProviderId(selectedProviderId);
                // Update the provider in the list with the new config
                setProviders(prev => prev.map(p =>
                    p.id === selectedProviderId
                        ? { ...p, is_configured: true, config: formData }
                        : p
                ));
                // Show success feedback?
            }
        } catch (error) {
            console.error('Failed to save config:', error);
        } finally {
            setSaving(false);
        }
    };

    // 动态渲染表单字段（根据后端返回的 config 自动生成）
    const renderFormFields = () => {
        if (!selectedProviderId) return <div className="text-gray-500 italic">Select a provider to configure.</div>;

        // 从 formData 动态生成字段
        const configKeys = Object.keys(formData);
        if (configKeys.length === 0) {
            return <div className="text-gray-500 italic">No configuration available for this provider.</div>;
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
        <div className="space-y-8">
            {/* Provider Selector */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                    ASR Provider
                </label>
                <div className="relative">
                    <select
                        value={selectedProviderId}
                        onChange={handleProviderChange}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">None (Disable ASR)</option>
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

            {/* Dynamic Form */}
            <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-800">
                {renderFormFields()}
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                {/* Test Connection */}
                {selectedProviderId && (
                    <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${testResult?.success
                                ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20'
                                : testResult?.success === false
                                    ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                                    : 'text-gray-300 hover:bg-gray-800'
                            }`}
                    >
                        {testing ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />}
                        {testing ? 'Testing...' : testResult?.success ? 'Connection Valid' : testResult?.success === false ? 'Connection Failed' : 'Test Connection'}
                    </button>
                )}

                <div className="flex-1"></div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving || !selectedProviderId}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    <span>Save & Apply</span>
                </button>
            </div>

            {/* Error Message Display */}
            {testResult?.success === false && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
                    {testResult.message}
                </div>
            )}
        </div>
    );
};

export default ASRSettings;
