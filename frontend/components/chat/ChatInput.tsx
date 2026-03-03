import React from 'react';
import { Send, Mic, MicOff, Paperclip } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import Toast, { ToastMessage } from '../ui/Toast';
import { Logger } from '../../utils/logger';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isTyping: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  onInputChange,
  onSend,
  isTyping
}) => {
  const { t } = useLanguage();
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
      Logger.error(t('chat.asrError'), undefined, { error: asrError });
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
    Logger.debug(t('chat.toggleRecording'), { isRecording, isProcessing });

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <>
      <Toast message={toastMessage} />
      <div className={cn(
        "pt-0 pb-3 px-3 md:pb-4 md:px-4 transition-all duration-500 absolute bottom-0 left-0 right-0 z-10"
      )}>
        <div className="max-w-4xl mx-auto relative">
          {/* Recording Banner */}
          <div className={cn(
            "absolute bottom-full left-0 mb-4 px-4 py-2 bg-destructive/20 text-destructive border border-destructive/30 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all duration-500 shadow-lg",
            isRecording ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}>
            <div className="w-2 h-2 bg-destructive rounded-full animate-ping" />
            {t('chat.recordingBanner')}
          </div>

          {/* Input Container */}
          <div className={cn(
            "relative bg-card/90 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl border transition-all duration-300",
            isRecording
              ? "border-destructive ring-4 ring-destructive/10"
              : "border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"
          )}>
            <textarea
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? t('chat.recordingPlaceholder')
                  : isProcessing
                    ? t('chat.convertingAudio')
                    : t('chat.placeholder')
              }
              disabled={isRecording}
              className="w-full max-h-40 p-4 pr-32 bg-transparent border-none focus:ring-0 resize-none text-foreground placeholder:text-muted-foreground outline-none custom-scrollbar disabled:opacity-50 text-sm md:text-base leading-relaxed"
              rows={1}
              style={{ minHeight: '64px' }}
            />

            {/* Action Buttons */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground hidden sm:flex"
              >
                <Paperclip size={18} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRecording}
                disabled={isProcessing}
                className={cn(
                  "h-9 w-9",
                  isRecording && "text-destructive bg-destructive/10 animate-pulse",
                  isProcessing && "text-primary bg-primary/10 animate-pulse",
                  !isRecording && !isProcessing && "text-muted-foreground hover:text-foreground"
                )}
                title={
                  isRecording
                    ? t('chat.stopRecording')
                    : isProcessing
                      ? t('chat.processing')
                      : t('chat.startRecording')
                }
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </Button>

              <Button
                onClick={onSend}
                disabled={(!inputValue.trim() && !isRecording) || isTyping}
                size="icon"
                className={cn(
                  "h-9 w-9 transition-all duration-300",
                  inputValue.trim() && !isTyping
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatInput;
