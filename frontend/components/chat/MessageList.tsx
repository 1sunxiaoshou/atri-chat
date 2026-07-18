import React, { useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { type BaseMessage } from '@langchain/core/messages';
import { Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useChatStore } from '../../store/useChatStore';
import { buildAvatarUrl } from '../../utils/url';
import { Button } from '../ui';

interface MessageListProps {
  messages: BaseMessage[];
  activeCharacter: Character | null;
  children?: React.ReactNode;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  activeCharacter,
  children
}) => {
  const { t } = useLanguage();
  const { setInputValue } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 overflow-hidden ring-4 ring-background shadow-2xl transition-transform hover:scale-110 duration-500">
          {activeCharacter?.portrait_url ? (
            <img src={buildAvatarUrl(activeCharacter.portrait_url)} alt="Character" className="w-full h-full object-cover" />
          ) : activeCharacter?.avatar?.thumbnail_url ? (
            <img src={buildAvatarUrl(activeCharacter.avatar.thumbnail_url)} alt="Character" className="w-full h-full object-cover" />
          ) : (
            <Sparkles size={40} className="text-primary animate-pulse" />
          )}
        </div>

        <div className="max-w-md space-y-4">
          <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {activeCharacter ? `${t('chat.chatWith')} ${activeCharacter.name}` : t('chat.welcome')}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            准备好开始一段奇妙的对话了吗？您可以尝试发送以下建议，或直接输入您想说的话。
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {[t('chat.suggestion.summarize'), t('chat.suggestion.code'), t('chat.suggestion.translate')].map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => setInputValue(suggestion)}
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
    <div className="space-y-3 md:space-y-4 pb-20">
      {children}

      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};

export default MessageList;
