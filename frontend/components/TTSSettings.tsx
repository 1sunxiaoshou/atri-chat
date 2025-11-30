import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TTSProvider } from '../types';
import { Check, AlertTriangle, Eye, EyeOff, Loader2, Save, Activity } from 'lucide-react';

const TTSSettings: React.FC = () => {
    const [providers, setProviders] = useState<TTSProvider[]>([]);
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
            const res = await api.getTTSProviders();
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
            console.error('Failed to fetch TTS providers:', error);
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

    const handleInputChange = (key: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [key]: { ...prev[key], value }
        }));
        setTestResult(null);
        setSaveResult(null);
    };

    const toggleSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const extractValues = (config: any): any => {
        const values: any = {};
        for (const key in config) {
            if (config[key]?.value !== undefined) {
                values[key] = config[key].value;
            } else if (config[key]?.default !== undefined) {
                values[key] = config[key].default;
            } else {
                values[key] = config[key];
            }
        }
        return values;
    };

    const handleTestConnection = async () => {
        if (!selectedProviderId) return;
        setTesting(true);
        setTestResult(null);
        setSaveResult(null);
        try {
            const values = extractValues(formData);
            const res = await api.testTTSConnection(selectedProviderId, values);
            if (res.code === 200 && res.data?.success) {
                setTestResult({ success: true, message: res.data.message || res.message || '连接成功' });
            } else {
                const errorMsg = res.data?.message || res.message || '连接失败';
                setTestResult({ success: false, message: errorMsg });
            }

            setTimeout(() => setTestResult(null), 3000);
        } catch (error: any) {
            const errorMsg = error?.message || '网络错误或服务不可用';
            setTestResult({ success: false, message: errorMsg });

            setTimeout(() => setTestResult(null), 3000);
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveResult(null);
        setTestResult(null);

        try {
            const values = selectedProviderId ? extractValues(formData) : {};
            const res = await api.saveTTSConfig(
                selectedProviderId || 'none',
                values
            );

            if (res.code === 200) {
                setActiveProviderId(selectedProviderId || null);
                setSaveResult({
                    success: true,
                    message: selectedProviderId ? '配置已保存' : 'TTS已禁用'
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

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {configKeys.map((key) => {
                    const fieldConfig = formData[key];
                    
                    if (!fieldConfig || typeof fieldConfig !== 'object' || !('type' in fieldConfig)) {
                        console.error(`配置字段 ${key} 格式错误，应为元数据格式`);
                        return null;
                    }

                    const { type, label, description, required, placeholder, options, min, max, step, value, accept } = fieldConfig;
                    const currentValue = value !== undefined ? value : (fieldConfig.default || '');
                    const isPassword = type === 'password' || fieldConfig.sensitive;

                    return (
                        <div key={key} className="space-y-1">
                            <label className="block text-sm font-medium text-gray-300">
                                {label}
                                {required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            {description && (
                                <p className="text-xs text-gray-400 mb-1">{description}</p>
                            )}
                            
                            {type === 'select' ? (
                                <select
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    {options?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : type === 'number' ? (
                                <input
                                    type="number"
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(key, parseFloat(e.target.value))}
                                    min={min}
                                    max={max}
                                    step={step}
                                    placeholder={placeholder}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            ) : type === 'file' ? (
                                <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                                />
                            ) : (
                                <div className="relative">
                                    <input
                                        type={isPassword && !showSecrets[key] ? 'password' : 'text'}
                                        value={currentValue}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                    {isPassword && (
                                        <button
                                            type="button"
                                            onClick={() => toggleSecret(key)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                        >
                                            {showSecrets[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    )}
                                </div>
                            )}
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
        <>
            {(saveResult || testResult) && (
                <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    {saveResult && (
                        <div className={`min-w-[300px] max-w-[400px] p-4 rounded-lg border shadow-lg backdrop-blur-sm flex items-start gap-3 ${saveResult.success
                            ? 'bg-green-500/90 border-green-400/50 text-white'
                            : 'bg-red-500/90 border-red-400/50 text-white'
                            }`}>
                            {saveResult.success ? <Check size={20} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold">{saveResult.success ? '保存成功' : '保存失败'}</div>
                                <div className="text-sm opacity-90 mt-1">{saveResult.message}</div>
                            </div>
                        </div>
                    )}

                    {testResult && !saveResult && (
                        <div className={`min-w-[300px] max-w-[400px] p-4 rounded-lg border shadow-lg backdrop-blur-sm flex items-start gap-3 ${testResult.success
                            ? 'bg-green-500/90 border-green-400/50 text-white'
                            : 'bg-red-500/90 border-red-400/50 text-white'
                            }`}>
                            {testResult.success ? <Check size={20} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold">{testResult.success ? '测试成功' : '测试失败'}</div>
                                <div className="text-sm opacity-90 mt-1 break-words">{testResult.message}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-col h-full space-y-4">
                <div className="flex-shrink-0">
                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                                Provider
                            </label>
                            <div className="relative flex-1">
                                <select
                                    value={selectedProviderId}
                                    onChange={handleProviderChange}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:border-gray-600 cursor-pointer"
                                    style={{
                                        backgroundImage: 'none'
                                    }}
                                >
                                    <option value="" className="bg-gray-800 text-gray-400">
                                        无
                                    </option>
                                    {providers.map(p => (
                                        <option
                                            key={p.id}
                                            value={p.id}
                                            className="bg-gray-800 py-2"
                                            style={{
                                                color: p.is_configured ? '#379e5dff' : '#fbbf24'
                                            }}
                                        >
                                            {p.is_configured ? '● ' : '○ '}{p.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                    {selectedProviderId ? (
                        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-800 flex-1 overflow-y-auto custom-scrollbar">
                            {renderFormFields()}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 italic bg-gray-800/30 rounded-xl border border-gray-800 border-dashed">
                            <div className="mb-2 text-4xl">🔊</div>
                            <div>请选择上方的服务商进行配置</div>
                        </div>
                    )}
                </div>

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
            </div >
        </>
    );
};

export default TTSSettings;
