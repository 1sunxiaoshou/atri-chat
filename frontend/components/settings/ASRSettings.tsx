import React from 'react';
import { Mic, CheckCircle2, Languages, Zap, Save } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../hooks/useSettings';
import { Card, CardContent, Select, Button } from '../ui';
import { SUCCESS_MESSAGES } from '../../utils/constants';
import { cn } from '../../utils/cn';

const ASRSettings: React.FC = () => {
    const { language } = useLanguage();
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
                    {language === 'zh' ? '语音识别设置' : 'ASR Settings'}
                </h2>
                <p className="text-muted-foreground mt-1">
                    {language === 'zh' ? '配置语音识别的语言和模型精度' : 'Configure speech recognition language and model precision'}
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
                                    {language === 'zh' ? '语音识别状态' : 'ASR Status'}
                                </h3>
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    <span className="text-sm text-green-500 font-medium">
                                        {language === 'zh' ? '已启用（本地模型）' : 'Enabled (Local Model)'}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {language === 'zh'
                                        ? '系统使用本地 SenseVoice-Small ONNX 模型进行语音识别，无需额外配置。'
                                        : 'The system uses local SenseVoice-Small ONNX model for speech recognition.'}
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
                                    {language === 'zh' ? '识别语言' : 'Recognition Language'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {language === 'zh'
                                        ? '选择语音识别的目标语言，或使用自动检测'
                                        : 'Select target language for speech recognition or use auto-detection'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Select
                                value={localLanguage}
                                onChange={handleLanguageChange}
                                options={[
                                    { label: language === 'zh' ? '自动检测' : 'Auto Detect', value: 'auto' },
                                    { label: language === 'zh' ? '中文（普通话）' : 'Chinese (Mandarin)', value: 'zh' },
                                    { label: language === 'zh' ? '英语' : 'English', value: 'en' },
                                    { label: language === 'zh' ? '日语' : 'Japanese', value: 'ja' },
                                    { label: language === 'zh' ? '韩语' : 'Korean', value: 'ko' },
                                    { label: language === 'zh' ? '粤语' : 'Cantonese', value: 'yue' }
                                ]}
                                className="w-full max-w-md"
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                {language === 'zh'
                                    ? '提示：自动检测适用于大多数场景，指定语言可能提高识别准确度'
                                    : 'Tip: Auto-detect works for most scenarios, specifying language may improve accuracy'}
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
                                    {language === 'zh' ? '模型精度' : 'Model Precision'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {language === 'zh'
                                        ? '选择模型精度，平衡识别速度和准确度'
                                        : 'Choose model precision to balance speed and accuracy'}
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
                                        {language === 'zh' ? '全精度' : 'Full Precision'}
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
                                        {language === 'zh' ? '量化' : 'Quantized'}
                                    </span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                                    <div className="font-semibold text-foreground mb-1">FP32 {language === 'zh' ? '全精度' : 'Full Precision'}</div>
                                    <ul className="text-muted-foreground space-y-1 text-[11px]">
                                        <li>• {language === 'zh' ? '精度更高' : 'Higher accuracy'}</li>
                                        <li>• {language === 'zh' ? '速度较慢（~150ms/10s）' : 'Slower (~150ms/10s)'}</li>
                                        <li>• {language === 'zh' ? '模型大小 ~900MB' : 'Model size ~900MB'}</li>
                                    </ul>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                                    <div className="font-semibold text-foreground mb-1">INT8 {language === 'zh' ? '量化' : 'Quantized'}</div>
                                    <ul className="text-muted-foreground space-y-1 text-[11px]">
                                        <li>• {language === 'zh' ? '速度更快（~70ms/10s）' : 'Faster (~70ms/10s)'}</li>
                                        <li>• {language === 'zh' ? '精度略低' : 'Slightly lower accuracy'}</li>
                                        <li>• {language === 'zh' ? '模型大小 ~200MB' : 'Model size ~200MB'}</li>
                                    </ul>
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground italic">
                                {language === 'zh'
                                    ? '提示：切换精度时会自动重新加载模型，首次加载需要 4-5 秒'
                                    : 'Tip: Switching precision will reload the model, first load takes 4-5 seconds'}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-muted/20 border-dashed">
                    <CardContent className="p-6">
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium">
                                {language === 'zh' ? '使用说明' : 'Usage Instructions'}
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                                <li>
                                    {language === 'zh'
                                        ? '在聊天界面点击麦克风图标开始语音输入'
                                        : 'Click the microphone icon in the chat interface to start voice input'}
                                </li>
                                <li>
                                    {language === 'zh'
                                        ? '支持中文、英文、日文、韩文、粤语等多语言识别'
                                        : 'Supports Chinese, English, Japanese, Korean, and Cantonese'}
                                </li>
                                <li>
                                    {language === 'zh'
                                        ? '首次使用时会自动下载模型文件（约 1GB）'
                                        : 'Model files will be downloaded automatically on first use (~1GB)'}
                                </li>
                                <li>
                                    {language === 'zh'
                                        ? '语言和精度设置会在下次录音时生效'
                                        : 'Language and precision settings take effect on next recording'}
                                </li>
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
                        {language === 'zh' ? '保存设置' : 'Save Settings'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ASRSettings;
