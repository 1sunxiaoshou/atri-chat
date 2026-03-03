import React, { useState } from 'react';
import { Bot, User, Copy, Volume2, RotateCcw, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message, Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { createMarkdownComponents } from '../../utils/markdownConfig';
import { buildAvatarUrl } from '../../utils/url';
import { cn } from '../../utils/cn';
import { Button } from '../ui';

interface MessageItemProps {
  message: Message;
  activeCharacter: Character | null;
  playingMessageId: string | number | null;
  copiedMessageId: string | number | null;
  onCopyMessage: (messageId: string | number, content: string) => void;
  onPlayTTS: (messageId: string | number, text: string) => void;
  expandedReasoning?: Set<string | number>;
  onToggleReasoning?: (messageId: string | number) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  activeCharacter,
  playingMessageId,
  copiedMessageId,
  onCopyMessage,
  onPlayTTS,
  expandedReasoning,
  onToggleReasoning
}) => {
  const { t } = useLanguage();
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  const isExpanded = expandedReasoning?.has(message.message_id) ?? isReasoningExpanded;
  const isUser = message.message_type === 'user';

  const handleToggleReasoning = () => {
    if (onToggleReasoning) {
      onToggleReasoning(message.message_id);
    } else {
      setIsReasoningExpanded(!isReasoningExpanded);
    }
  };

  return (
    <div className={cn(
      "group flex gap-4 items-start",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
        isUser
          ? "bg-gray-800 dark:bg-gray-700 text-white"
          : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
      )}>
        {isUser ? (
          <User size={18} />
        ) : (
          activeCharacter?.portrait_url ? (
            <img src={buildAvatarUrl(activeCharacter.portrait_url)} alt="AI" className="w-full h-full object-cover" />
          ) : activeCharacter?.avatar?.thumbnail_url ? (
            <img src={buildAvatarUrl(activeCharacter.avatar.thumbnail_url)} alt="AI" className="w-full h-full object-cover" />
          ) : (
            <Bot size={18} />
          )
        )}
      </div>

      {/* Message Content Area */}
      <div className="max-w-[75%] space-y-1.5">
        {/* Tool Status */}
        {!isUser && message.status && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <div className={message.generating ? 'animate-spin' : ''}>⚙️</div>
              <span className="text-sm">{message.status}</span>
            </div>
          </div>
        )}

        {/* Reasoning (Chain of Thought) */}
        {!isUser && message.reasoning && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
            <button
              onClick={handleToggleReasoning}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-2 text-primary/80">
                <Brain size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">{t('chat.reasoning')}</span>
              </div>
              {isExpanded ? (
                <ChevronUp size={14} className="opacity-50" />
              ) : (
                <ChevronDown size={14} className="opacity-50" />
              )}
            </button>
            {isExpanded && (
              <div className="px-4 py-3 border-t border-border bg-background/50 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap animate-in slide-in-from-top-1 duration-200">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Message Bubble */}
        {message.content && (
          <div className={cn(
            "px-4 md:px-5 py-3 rounded-2xl shadow-sm text-sm leading-relaxed transition-all",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-none"
              : "bg-card border border-border text-card-foreground rounded-tl-none"
          )}>
            <div className={cn(
              "markdown-content",
              isUser ? "markdown-user" : "markdown-assistant"
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={createMarkdownComponents(message.message_type, t)}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Message Actions */}
        {!isUser && (
          <div className="flex gap-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full",
                copiedMessageId === message.message_id ? "text-emerald-500" : "text-muted-foreground"
              )}
              onClick={() => onCopyMessage(message.message_id, message.content)}
              title={copiedMessageId === message.message_id ? t('chat.copied') : t('chat.copy')}
            >
              <Copy size={12} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full",
                playingMessageId === message.message_id ? "text-primary animate-pulse" : "text-muted-foreground"
              )}
              onClick={() => onPlayTTS(message.message_id, message.content)}
              title={playingMessageId === message.message_id ? t('chat.stopPlaying') : t('chat.read')}
            >
              <Volume2 size={12} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground"
              title={t('chat.regenerate')}
            >
              <RotateCcw size={12} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
