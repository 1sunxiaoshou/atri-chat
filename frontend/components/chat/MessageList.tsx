import React, { useRef, useEffect } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { Message, Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../utils/url';

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
      <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 overflow-hidden">
          {activeCharacter?.avatar ? (
            <img src={buildAvatarUrl(activeCharacter.avatar)} alt="Character" className="w-full h-full object-cover" />
          ) : (
            <Sparkles size={40} className="text-gray-400 dark:text-gray-500" />
          )}
        </div>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {activeCharacter ? `${t('chat.chatWith')} ${activeCharacter.name}` : t('chat.welcome')}
        </h3>
        <div className="flex gap-2 mt-4">
          {[t('chat.suggestion.summarize'), t('chat.suggestion.code'), t('chat.suggestion.translate')].map(suggestion => (
            <button 
              key={suggestion} 
              onClick={() => onSetInputValue(suggestion)} 
              className="px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      
      {isTyping && (
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            {activeCharacter?.avatar ? (
              <img src={buildAvatarUrl(activeCharacter.avatar)} alt="AI" className="w-full h-full object-cover" />
            ) : (
              <Bot size={16} />
            )}
          </div>
          <div className="max-w-[75%]">
            <div className="px-5 py-3.5 rounded-2xl rounded-tl-none shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </>
  );
};

export default MessageList;
