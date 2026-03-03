import React from 'react';
import { Mic, CheckCircle2, Languages, Zap, Save } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../hooks/useSettings';
import { Card, CardContent, Select, Button } from '../ui';
import { SUCCESS_MESSAGES } from '../../utils/constants';
import { cn } from '../../utils/cn';

const ASRSettings: React.FC = () => {
    const { t } = useLanguage();
    const { settings, saveSettings } = useSettings();
    const [saveMessage, setSaveMessage] = React.useState<string>('');
    const [localLanguage, setLocalLanguage] = React.useState(settings.asrLanguage || 'auto');
    const [localUseInt8, setLocalUseInt8] = React.useState(settings.asrUseInt8 || false);

    // 同步 settings 到本地状态
    React.useEffect(() => {
        setLocalLanguage(settings.asrLanguage || 'auto');
        setLocalUseInt8(settings.asrUseInt8 || false);
    }, [settings.asrLanguage, settings.asrUseInt8]);

    const handleLanguageChange = (lang: string) => {
        setLocalLanguage(lang);
    };

    const handlePrecisionChange = (useInt8: boolean) => {
        setLocalUseInt8(useInt8);
    };

    const handleSave = () => {
        saveSettings({
            asrLanguage: localLanguage,
            asrUseInt8: localUseInt8
        });
        setSaveMessage(SUCCESS_MESSAGES.SAVE_SUCCESS);
        setTimeout(() => setSaveMessage(''), 2000);
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 头部标题 */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">
                    {t('settings.asrTitle')}
                </h2>
                <p className="text-muted-foreground mt-1">
                    {t('settings.asrDescription')}
                </p>
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* ASR Status Card */}
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-green-500/10 rounded-xl shrink-0">
                                <Mic size={20} className="text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-foreground mb-1">
                                    {t('settings.asrStatus')}
                                </h3>
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span className="text-sm text-green-500 font-medium">
                                        {t('settings.asrEnabled')}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.asrStatusDesc')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Language Selection */}
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl shrink-0">
                                <Languages size={20} className="text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-foreground mb-1">
                                    {t('settings.recognitionLanguage')}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.recognitionLanguageDesc')}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Select
                                value={localLanguage}
                                onChange={handleLanguageChange}
                                options={[
                                    { label: t('settings.autoDetect'), value: 'auto' },
                                    { label: t('settings.chineseMandarin'), value: 'zh' },
                                    { label: t('settings.english'), value: 'en' },
                                    { label: t('settings.japanese'), value: 'ja' },
                                    { label: t('settings.korean'), value: 'ko' },
                                    { label: t('settings.cantonese'), value: 'yue' }
                                ]}
                                className="w-full max-w-md"
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                {t('settings.languageTip')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Model Precision */}
                <Card className="border-none bg-muted/30 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-2.5 bg-purple-500/10 rounded-xl shrink-0">
                                <Zap size={20} className="text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-foreground mb-1">
                                    {t('settings.modelPrecision')}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.modelPrecisionDesc')}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex p-1 bg-muted rounded-lg ring-1 ring-border/50">
                                <button
                                    onClick={() => handlePrecisionChange(false)}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-md text-xs font-medium transition-all",
                                        !localUseInt8
                                            ? "bg-background text-primary shadow-sm ring-1 ring-border/20"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="font-bold">FP32</span>
                                    <span className="text-[10px] opacity-70">
                                        {t('settings.fullPrecision')}
                                    </span>
                                </button>
                                <button
                                    onClick={() => handlePrecisionChange(true)}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-md text-xs font-medium transition-all",
                                        localUseInt8
                                            ? "bg-background text-primary shadow-sm ring-1 ring-border/20"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="font-bold">INT8</span>
                                    <span className="text-[10px] opacity-70">
                                        {t('settings.quantized')}
                                    </span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                                    <div className="font-semibold text-foreground mb-1">FP32 {t('settings.fullPrecision')}</div>
                                    <ul className="text-muted-foreground space-y-1 text-[11px]">
                                        <li>• {t('settings.higherAccuracy')}</li>
                                        <li>• {t('settings.slowerSpeed')}</li>
                                        <li>• {t('settings.largerModel')}</li>
                                    </ul>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                                    <div className="font-semibold text-foreground mb-1">INT8 {t('settings.quantized')}</div>
                                    <ul className="text-muted-foreground space-y-1 text-[11px]">
                                        <li>• {t('settings.fasterSpeed')}</li>
                                        <li>• {t('settings.slightlyLowerAccuracy')}</li>
                                        <li>• {t('settings.smallerModel')}</li>
                                    </ul>
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground italic">
                                {t('settings.precisionTip')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-muted/20 border-dashed">
                    <CardContent className="p-6">
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium">
                                {t('settings.usageInstructions')}
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                                <li>{t('settings.usageInstruction1')}</li>
                                <li>{t('settings.usageInstruction2')}</li>
                                <li>{t('settings.usageInstruction3')}</li>
                                <li>{t('settings.usageInstruction4')}</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-border sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-6 px-6 pb-6">
                    {saveMessage && (
                        <span className="text-emerald-500 text-xs font-medium animate-in fade-in slide-in-from-right-2">
                            {saveMessage}
                        </span>
                    )}
                    <Button
                        onClick={handleSave}
                        className="min-w-[120px]"
                    >
                        <Save size={18} className="mr-2" />
                        {t('settings.saveSettings')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ASRSettings;