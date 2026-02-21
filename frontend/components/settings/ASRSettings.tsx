import React from 'react';
import { Mic, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, CardContent } from '../ui';

const ASRSettings: React.FC = () => {
    const { language } = useLanguage();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* ASR Status Card */}
            <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-green-500/10">
                            <Mic size={24} className="text-green-500" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-medium">
                                {language === 'zh' ? '语音识别状态' : 'ASR Status'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-500" />
                                <span className="text-sm text-green-500">
                                    {language === 'zh' ? '已启用（本地模型）' : 'Enabled (Local Model)'}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {language === 'zh'
                                    ? '系统使用本地 SenseVoice-Small ONNX 模型进行语音识别，无需额外配置。'
                                    : 'The system uses local SenseVoice-Small ONNX model for speech recognition, no additional configuration required.'}
                            </p>
                        </div>
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
                                    : 'Supports multiple languages including Chinese, English, Japanese, Korean, and Cantonese'}
                            </li>
                            <li>
                                {language === 'zh'
                                    ? '首次使用时会自动下载模型文件'
                                    : 'Model files will be downloaded automatically on first use'}
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ASRSettings;
