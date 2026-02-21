import React, { useRef, useEffect } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { Message, Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../utils/url';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  activeCharacter: Character | null;
  onSetInputValue: (value: string) => void;
  children?: React.ReactNode;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping,
  activeCharacter,
  onSetInputValue,
  children
}) => {
  const { t } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 overflow-hidden ring-4 ring-background shadow-2xl transition-transform hover:scale-110 duration-500">
          {activeCharacter?.avatar?.file_url ? (
            <img src={buildAvatarUrl(activeCharacter.avatar.file_url)} alt="Character" className="w-full h-full object-cover" />
          ) : (
            <Sparkles size={40} className="text-primary animate-pulse" />
          )}
        </div>

        <div className="max-w-md space-y-4">
          <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {activeCharacter ? `${t('chat.chatWith')} ${activeCharacter.name}` : t('chat.welcome')}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            {activeCharacter?.description || "准备好开始一段奇妙的对话了吗？您可以尝试发送以下建议，或直接输入您想说的话。"}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {[t('chat.suggestion.summarize'), t('chat.suggestion.code'), t('chat.suggestion.translate')].map(suggestion => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => onSetInputValue(suggestion)}
              className="rounded-full bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 pb-32">
      {children}

      {isTyping && (
        <div className="flex gap-4 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-primary/10 text-primary ring-2 ring-background shadow-sm">
            {activeCharacter?.avatar?.file_url ? (
              <img src={buildAvatarUrl(activeCharacter.avatar.file_url)} alt="AI" className="w-full h-full object-cover" />
            ) : (
              <Bot size={18} />
            )}
          </div>
          <div className="max-w-[85%] md:max-w-[75%]">
            <div className="px-5 py-3.5 rounded-2xl rounded-tl-none shadow-sm bg-card border border-border">
              <div className="flex gap-1.5 items-center h-5">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};

export default MessageList;
