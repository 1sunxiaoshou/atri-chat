import React from 'react';
import { CheckCircle2, Languages, Download, Trash2, AlertCircle, Loader2, Cpu } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, CardContent, Button, ConfirmDialog } from '../ui';
import { asrApi, ASRStatus } from '../../services/api/asr';
import { useAudioStore } from '../../store/useAudioStore';
import { Logger } from '../../utils/logger';

const ASRSettings: React.FC = () => {
    const { t } = useLanguage();
    // P1 修复：Logger 替代 console.error；从 useAudioStore 读写 ASR 设置
    const asrLanguage = useAudioStore((state) => state.asrLanguage);
    const asrUseInt8 = useAudioStore((state) => state.asrUseInt8);
    const setAsrLanguage = useAudioStore((state) => state.setAsrLanguage);
    const setAsrUseInt8 = useAudioStore((state) => state.setAsrUseInt8);

    const [status, setStatus] = React.useState<ASRStatus | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [mgmtActionLoading, setMgmtActionLoading] = React.useState(false);
    
    // 我们需要记录当前要清理的精度类型
    const [showClearConfirm, setShowClearConfirm] = React.useState<false | 'int8' | 'fp32'>(false);

    // 获取 ASR 状态
    const fetchStatus = React.useCallback(async () => {
        try {
            const res = await asrApi.getStatus();
            if (res.code === 200) {
                setStatus(res.data);
                return res.data;
            }
        } catch (e) {
            Logger.error(t('settings.fetchASRStatusFailed'), e instanceof Error ? e : undefined);
        } finally {
            setLoading(false);
        }
        return null;
    }, []);

    // 按需状态获取 - 仅在页面挂载时获取一次
    React.useEffect(() => {
        fetchStatus(); // 仅获取一次初始状态
    }, [fetchStatus]);

    // 下载进度轮询 - 仅在下载时启用
    React.useEffect(() => {
        let progressTimer: NodeJS.Timeout;

        if (status?.is_downloading) {
            // 开启高频轮询 (每1秒)
            progressTimer = setInterval(async () => {
                const currentStatus = await fetchStatus();
                // 下载完成时自动停止轮询
                if (!currentStatus?.is_downloading) {
                    clearInterval(progressTimer);
                }
            }, 1000);
        }

        return () => {
            if (progressTimer) {
                clearInterval(progressTimer);
            }
        };
    }, [status?.is_downloading, fetchStatus]);

    const handleLanguageChange = (lang: string) => {
        setAsrLanguage(lang);
    };

    const handlePrecisionChange = (useInt8: boolean) => {
        setAsrUseInt8(useInt8);
    };

    const handleDownload = async (precision: 'int8' | 'fp32' | 'both') => {
        setMgmtActionLoading(true);
        try {
            const response = await asrApi.downloadModel(precision);
            if (response.code === 200) {
                // 立即获取一次状态，启动进度轮询
                await fetchStatus();
            }
        } catch (e) {
            Logger.error(t('settings.triggerModelDownloadFailed'), e instanceof Error ? e : undefined);
        } finally {
            setMgmtActionLoading(false);
        }
    };

    const handleClearAssets = async () => {
        if (!showClearConfirm) {return;}
        setMgmtActionLoading(true);
        try {
            const response = await asrApi.clearAssets(showClearConfirm);
            if (response.code === 200) {
                // 清理完成后立即更新状态
                await fetchStatus();
                setShowClearConfirm(false);
            }
        } catch (e) {
            Logger.error(t('settings.clearModelResourcesFailed'), e instanceof Error ? e : undefined);
        } finally {
            setMgmtActionLoading(false);
        }
    };

    const languages = [
        { label: t('settings.autoDetect'), value: 'auto' },
        { label: t('settings.chineseMandarin'), value: 'zh' },
        { label: t('settings.english'), value: 'en' },
        { label: t('settings.japanese'), value: 'ja' },
        { label: t('settings.korean'), value: 'ko' },
        { label: t('settings.cantonese'), value: 'yue' }
    ];

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 头部标题 */}
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">
                        {t('settings.asrTitle')}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        {t('settings.asrDescription')}
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. 模型与精度管理 */}
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <Cpu size={20} className="text-foreground shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-foreground mb-1">
                                     {t('settings.modelPrecision')}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.asrModelMgmtDesc')}
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* FP32 卡片 */}
                                <div 
                                    className={`relative cursor-pointer transition-all duration-300 rounded-2xl p-5 border-2 flex flex-col justify-between 
                                        ${!asrUseInt8 
                                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                                            : 'border-border/50 bg-card hover:border-primary/30 hover:bg-muted/50'
                                        }`}
                                    onClick={() => handlePrecisionChange(false)}
                                >
                                    {/* 选中标识 */}
                                    {!asrUseInt8 && (
                                        <div className="absolute top-4 right-4 text-primary">
                                            <CheckCircle2 size={20} className="fill-primary/10" />
                                        </div>
                                    )}

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-foreground">FP32</span>
                                            {status?.fp32_ready ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 size={10} /> {t('settings.ready')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                    <AlertCircle size={10} /> {t('settings.notInstalled')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">
                                            {[t('settings.higherAccuracy'), t('settings.slowerSpeed'), t('settings.largerModel')].filter(Boolean).join(' • ')}
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between mt-auto">
                                        <div className="text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">{status?.fp32_size_mb || 0}</span> MB
                                        </div>
                                        
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            {(status?.is_downloading && status?.download_precision === 'fp32') ? (
                                                <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1.5 rounded-lg text-sm font-medium">
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>{status.progress}%</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {!status?.fp32_ready && (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm border-none"
                                                            onClick={() => handleDownload('fp32')}
                                                            disabled={mgmtActionLoading || status?.is_downloading}
                                                        >
                                                            <Download size={14} className="mr-1.5" />
                                                            {t('settings.downloadFp32')}
                                                        </Button>
                                                    )}
                                                    {status?.fp32_ready && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                                            onClick={(e) => { e.stopPropagation(); setShowClearConfirm('fp32'); }}
                                                            disabled={mgmtActionLoading || status?.is_downloading}
                                                            title={t('settings.clearAssets')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 进度条底层 */}
                                    {status?.is_downloading && status?.download_precision === 'fp32' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10 rounded-b-xl overflow-hidden">
                                              <div
                                                  className="h-full bg-primary transition-all duration-300 ease-out"
                                                  style={{ width: `${status.progress}%` }}
                                              />
                                        </div>
                                    )}
                                </div>

                                {/* INT8 卡片 */}
                                <div 
                                    className={`relative cursor-pointer transition-all duration-300 rounded-2xl p-5 border-2 flex flex-col justify-between 
                                        ${asrUseInt8 
                                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                                            : 'border-border/50 bg-card hover:border-primary/30 hover:bg-muted/50'
                                        }`}
                                    onClick={() => handlePrecisionChange(true)}
                                >
                                    {/* 选中标识 */}
                                    {asrUseInt8 && (
                                        <div className="absolute top-4 right-4 text-primary">
                                            <CheckCircle2 size={20} className="fill-primary/10" />
                                        </div>
                                    )}

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-foreground">INT8</span>
                                            {status?.int8_ready ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 size={10} /> {t('settings.ready')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                    <AlertCircle size={10} /> {t('settings.notInstalled')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">
                                            {[t('settings.fasterSpeed'), t('settings.slightlyLowerAccuracy'), t('settings.smallerModel')].filter(Boolean).join(' • ')}
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between mt-auto">
                                        <div className="text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">{status?.int8_size_mb || 0}</span> MB <span className="opacity-60">({t('settings.quantized')})</span>
                                        </div>
                                        
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            {(status?.is_downloading && status?.download_precision === 'int8') ? (
                                                <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1.5 rounded-lg text-sm font-medium">
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>{status.progress}%</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {!status?.int8_ready && (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm border-none"
                                                            onClick={() => handleDownload('int8')}
                                                            disabled={mgmtActionLoading || status?.is_downloading}
                                                        >
                                                            <Download size={14} className="mr-1.5" />
                                                            {t('settings.downloadInt8')}
                                                        </Button>
                                                    )}
                                                    {status?.int8_ready && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                                            onClick={(e) => { e.stopPropagation(); setShowClearConfirm('int8'); }}
                                                            disabled={mgmtActionLoading || status?.is_downloading}
                                                            title={t('settings.clearAssets')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 进度条底层 */}
                                    {status?.is_downloading && status?.download_precision === 'int8' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10 rounded-b-xl overflow-hidden">
                                              <div
                                                  className="h-full bg-primary transition-all duration-300 ease-out"
                                                  style={{ width: `${status.progress}%` }}
                                              />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* 错误提示 */}
                        {status?.download_error && (
                            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                                <div className="text-sm text-destructive font-medium leading-relaxed">
                                    {t('settings.downloadFailed')}: {status.download_error}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. 识别语言设置 */}
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <Languages size={20} className="text-foreground shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-foreground mb-1">
                                    {t('settings.recognitionLanguage')}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.recognitionLanguageDesc')}
                                </p>
                            </div>
                        </div>

                        {/* 胶囊网格选择器 */}
                        <div className="flex flex-wrap gap-2.5">
                            {languages.map((lang) => {
                                const isSelected = asrLanguage === lang.value;
                                return (
                                    <button
                                        key={lang.value}
                                        onClick={() => handleLanguageChange(lang.value)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                                            ${isSelected 
                                                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20' 
                                                : 'bg-background/50 text-muted-foreground border-border/50 hover:bg-muted hover:border-border hover:text-foreground'
                                            }
                                        `}
                                    >
                                        {lang.label}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                isOpen={!!showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={() => handleClearAssets()}
                title={t('settings.clearAssets')}
                description={t('settings.confirmClearAssets').replace('{precision}', showClearConfirm === 'fp32' ? 'FP32' : 'INT8')}
                confirmText={t('admin.delete')}
                cancelText={t('admin.cancel')}
                type="danger"
            />
        </div>
    );
};

export default ASRSettings;