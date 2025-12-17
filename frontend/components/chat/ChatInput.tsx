import React from 'react';
import { Send, Mic, Image as ImageIcon, MicOff } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useASR } from '../../contexts/ASRContext';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import Toast, { ToastMessage } from '../Toast';
import { Logger } from '../../utils/logger';

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isTyping: boolean;
  vrmDisplayMode: 'normal' | 'vrm' | 'live2d';
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  onInputChange,
  onSend,
  isTyping,
  vrmDisplayMode
}) => {
  const { t } = useLanguage();
  const { asrEnabled } = useASR();
  const { 
    isRecording, 
    isProcessing,
    error: asrError,
    transcribedText,
    startRecording, 
    stopRecording,
    clearTranscribedText,
    clearError
  } = useAudioRecorder();

  const [toastMessage, setToastMessage] = React.useState<ToastMessage | null>(null);

  // 当转录文本更新时，添加到输入框
  React.useEffect(() => {
    if (transcribedText) {
      onInputChange(inputValue + (inputValue ? ' ' : '') + transcribedText);
      clearTranscribedText();
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [transcribedText, inputValue, onInputChange, clearTranscribedText]);

  // 处理 ASR 错误
  React.useEffect(() => {
    if (asrError) {
      Logger.error('ASR 错误', undefined, { error: asrError });
      setToastMessage({
        success: false,
        message: asrError
      });
      setTimeout(() => {
        setToastMessage(null);
        clearError();
      }, 3000);
    }
  }, [asrError, clearError]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const toggleRecording = () => {
    Logger.debug('切换录音状态', { isRecording, isProcessing });
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <>
      <Toast message={toastMessage} />
      <div className={`p-4 transition-colors ${
        vrmDisplayMode === 'vrm' 
          ? 'absolute bottom-0 left-0 right-0 bg-transparent z-10' 
          : 'bg-white dark:bg-gray-900'
      }`}>
      <div className="max-w-4xl mx-auto relative">
        {/* Recording Banner */}
        <div className={`absolute bottom-full left-0 mb-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm transition-all duration-300 ${
          isRecording ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          {t('chat.recordingBanner')}
        </div>

        {/* Input Container */}
        <div className={`relative bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-black/20 rounded-2xl border transition-all overflow-hidden ${
          isRecording 
            ? 'border-red-400 ring-4 ring-red-50' 
            : 'border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'
        }`}>
          <textarea
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording 
                ? t('chat.recordingPlaceholder') 
                : isProcessing 
                  ? "正在转换语音..." 
                  : t('chat.placeholder')
            }
            disabled={isRecording}
            className="w-full max-h-40 p-4 pr-32 bg-transparent border-none focus:ring-0 resize-none text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none custom-scrollbar disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400"
            rows={1}
            style={{ minHeight: '60px' }}
          />

          {/* Action Buttons */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <ImageIcon size={20} />
            </button>
            <button
              onClick={toggleRecording}
              disabled={!asrEnabled || isProcessing}
              className={`p-2 rounded-xl transition-colors ${
                !asrEnabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : isRecording
                    ? 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse'
                    : isProcessing
                      ? 'text-blue-500 bg-blue-50 animate-pulse cursor-wait'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={
                !asrEnabled 
                  ? "ASR 未配置" 
                  : isRecording 
                    ? "点击停止录音" 
                    : isProcessing
                      ? "正在处理..."
                      : "点击开始录音"
              }
            >
              {!asrEnabled ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={onSend}
              disabled={(!inputValue.trim() && !isRecording) || isTyping}
              className={`p-2 rounded-xl transition-colors ml-1 ${
                inputValue.trim() && !isTyping
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="text-center mt-2 text-xs text-gray-400 dark:text-gray-500">
          {t('chat.disclaimer')}
        </div>
      </div>
    </div>
    </>
  );
};

export default ChatInput;
