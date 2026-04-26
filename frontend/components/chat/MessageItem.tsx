import React, { useState, Suspense } from 'react';
import { Bot, User, Copy, Volume2, RotateCcw, Brain, ChevronDown, ChevronRight, PenTool } from 'lucide-react';
import { Message, Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../utils/url';
import { cn } from '../../utils/cn';
import { Button } from '../ui';

const MarkdownContent = React.lazy(() => import('./MarkdownContent'));

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
  // 默认折叠思考过程
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
      "group flex gap-3 md:gap-4 items-start",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar (头像) */}
      <div className={cn(
        "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden mt-1",
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

      {/* Message Content Area (消息区域最大宽度放宽到 85%) */}
      <div className="max-w-[85%] sm:max-w-[80%] flex flex-col gap-1.5">
        
        {/* 统一的对话气泡 (所有内容都在这个气泡内) */}
        {(message.content || message.reasoning || (message.tool_calls && message.tool_calls.length > 0) || message.status || message.generating) && (
          <div className={cn(
            "px-4 md:px-5 py-3 md:py-4 rounded-2xl shadow-sm text-sm leading-relaxed transition-all flex flex-col gap-3",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-none"
              : "bg-card border border-border text-card-foreground rounded-tl-none"
          )}>
            
            {/* 1. 极简版工具调用 (Tool Calls) */}
            {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.tool_calls.map((tc, idx) => (
                  <div 
                    key={tc.run_id || idx}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 dark:bg-muted/20 px-2.5 py-1.5 rounded-md border border-border/50"
                  >
                    <PenTool size={12} className={tc.status === 'running' ? 'animate-pulse text-indigo-500' : ''} />
                    <span className="font-medium">
                      {t('chat.usingTool')}: {tc.tool}
                    </span>
                    {tc.status === 'running' && <span className="animate-spin ml-1">⚙️</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 1.5 兼容旧版状态 (Legacy Status) */}
            {!isUser && message.status && (!message.tool_calls || message.tool_calls.length === 0) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-md border border-border/50 w-fit">
                <span className={message.generating ? 'animate-spin' : ''}>⚙️</span>
                <span>{message.status}</span>
              </div>
            )}

            {/* 2. 内嵌式思考过程 (Reasoning) */}
            {!isUser && message.reasoning && (
              <div className="bg-muted/30 dark:bg-muted/10 rounded-lg border border-border/60 overflow-hidden">
                <button
                  onClick={handleToggleReasoning}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <Brain size={14} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('chat.reasoning')}
                  </span>
                </button>
                
                {/* 展开后的具体思考内容 */}
                {isExpanded && (
                  <div className="px-3 md:px-4 py-3 border-t border-border/60 text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {message.reasoning}
                  </div>
                )}
              </div>
            )}

            {/* 3. 正文区域 (Main Content) 或者 加载中动画 */}
            {message.content ? (
              <div className={cn(
                "markdown-content",
                isUser ? "markdown-user" : "markdown-assistant"
              )}>
                <Suspense
                  fallback={
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  }
                >
                  <MarkdownContent
                    content={message.content}
                    messageType={message.message_type}
                    t={t}
                  />
                </Suspense>
              </div>
            ) : (
                // 只有在没有正文且正在生成时才显示“点点点”动画
                message.generating && (
                    <div className="flex gap-1.5 items-center h-5 px-1">
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce"></div>
                    </div>
                )
            )}
          </div>
        )}

        {/* Message Actions (底部工具栏) */}
        {!isUser && (
          <div className="flex gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full",
                copiedMessageId === message.message_id ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onCopyMessage(message.message_id, message.content)}
              title={copiedMessageId === message.message_id ? t('chat.copied') : t('chat.copy')}
            >
              <Copy size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full",
                playingMessageId === message.message_id ? "text-primary animate-pulse" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onPlayTTS(message.message_id, message.content)}
              title={playingMessageId === message.message_id ? t('chat.stopPlaying') : t('chat.read')}
            >
              <Volume2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title={t('chat.regenerate')}
            >
              <RotateCcw size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
