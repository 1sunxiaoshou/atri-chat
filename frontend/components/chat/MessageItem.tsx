import React, { useState, Suspense } from 'react';
import { Bot, User, Copy, Volume2, RotateCcw } from 'lucide-react';
import { ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { Character } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildAvatarUrl } from '../../utils/url';
import { cn } from '../../utils/cn';
import { Button } from '../ui';
import {
  extractMessageReasoning,
  extractMessageText,
  getMessageId,
  isAssistantMessage,
  isToolResultMessage,
  isUserMessage,
} from '../../utils/langchainMessages';

const MarkdownContent = React.lazy(() => import('./MarkdownContent'));

type MessageWithToolCalls = BaseMessage & {
  tool_calls?: Array<{ id?: string; name?: string; args?: unknown }>;
  tool_call_chunks?: Array<{ id?: string; name?: string | null; args?: unknown }>;
};

type BubbleEvent =
  | { kind: 'reasoning'; key: string; content: string }
  | { kind: 'tool'; key: string; name: string; input?: string; output?: string; callId?: string }
  | { kind: 'content'; key: string; content: string };

interface MessageItemProps {
  message: BaseMessage;
  groupedMessages?: BaseMessage[];
  index: number;
  activeCharacter: Character | null;
  playingMessageId: string | number | null;
  copiedMessageId: string | number | null;
  onCopyMessage: (messageId: string | number, content: string) => void;
  onPlayTTS: (messageId: string | number, text: string) => void;
  expandedReasoning?: Set<string | number>;
  onToggleReasoning?: (messageId: string | number) => void;
  generating?: boolean;
  reasoning?: string;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  groupedMessages,
  index,
  activeCharacter,
  playingMessageId,
  copiedMessageId,
  onCopyMessage,
  onPlayTTS,
  expandedReasoning,
  onToggleReasoning,
  generating = false,
  reasoning,
}) => {
  const { t } = useLanguage();
  // 默认折叠思考过程
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const messages = groupedMessages?.length ? groupedMessages : [message];
  const messageId = getMessageId(message, index);
  const isUser = isUserMessage(message);
  const content = isUser ? extractMessageText(message.content) : messages
    .filter(isAssistantMessage)
    .map((item) => extractMessageText(item.content))
    .filter(Boolean)
    .join('\n\n');
  const formatDetail = (value: unknown): string => {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  const events: BubbleEvent[] = [];
  const toolEventIndexByCallId = new Map<string, number>();

  messages.forEach((item, itemIndex) => {
    const itemId = getMessageId(item, `${index}-${itemIndex}`);

    if (isUserMessage(item)) {
      const text = extractMessageText(item.content);
      if (text) {
        events.push({ kind: 'content', key: `${itemId}-content`, content: text });
      }
      return;
    }

    if (isToolResultMessage(item)) {
      const toolMessage = ToolMessage.isInstance(item) ? item : undefined;
      const callId = toolMessage?.tool_call_id;
      const name = toolMessage?.name ?? callId ?? t('chat.usingTool');
      const output = extractMessageText(item.content);

      if (callId && toolEventIndexByCallId.has(callId)) {
        const eventIndex = toolEventIndexByCallId.get(callId);
        if (typeof eventIndex === 'number') {
          const previousEvent = events[eventIndex];
          if (previousEvent?.kind === 'tool') {
            events[eventIndex] = { ...previousEvent, output, name: previousEvent.name || name };
            return;
          }
        }
      }

      events.push({ kind: 'tool', key: `${itemId}-tool`, name, output, callId });
      return;
    }

    if (!isAssistantMessage(item)) {
      return;
    }

    const isLastGroupedMessage = itemIndex === messages.length - 1;
    const itemReasoning = generating && isLastGroupedMessage && reasoning
      ? reasoning
      : extractMessageReasoning(item);
    const toolMessage = item as MessageWithToolCalls;
    const toolCalls = (toolMessage.tool_calls?.length ? toolMessage.tool_calls : toolMessage.tool_call_chunks ?? [])
      .filter((toolCall) => toolCall.name);
    const text = extractMessageText(item.content);
    const itemEvents: BubbleEvent[] = [];

    if (itemReasoning) {
      itemEvents.push({ kind: 'reasoning', key: `${itemId}-reasoning`, content: itemReasoning });
    }

    if (text) {
      itemEvents.push({ kind: 'content', key: `${itemId}-content`, content: text });
    }

    toolCalls.forEach((toolCall, toolIndex) => {
      const callId = toolCall.id ? String(toolCall.id) : undefined;
      itemEvents.push({
        kind: 'tool',
        key: `${itemId}-tool-call-${toolCall.id ?? toolIndex}`,
        name: String(toolCall.name),
        input: formatDetail(toolCall.args),
        callId,
      });
    });

    itemEvents.forEach((event) => {
      if (event.kind === 'tool' && event.callId) {
        toolEventIndexByCallId.set(event.callId, events.length);
      }
      events.push(event);
    });
  });
  const isExpanded = expandedReasoning?.has(messageId) ?? isReasoningExpanded;

  const toggleEvent = (eventKey: string) => {
    setExpandedEvents((previous) => {
      const next = new Set(previous);
      if (next.has(eventKey)) {
        next.delete(eventKey);
      } else {
        next.add(eventKey);
      }
      return next;
    });
  };

  const handleToggleReasoning = () => {
    if (onToggleReasoning) {
      onToggleReasoning(messageId);
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
        {(events.length > 0 || generating) && (
          <div className={cn(
            "px-4 md:px-5 py-3 md:py-4 rounded-2xl shadow-sm text-sm leading-relaxed transition-all flex flex-col gap-3",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-none"
              : "bg-card border border-border text-card-foreground rounded-tl-none"
          )}>
            
            {events.map((event) => {
              if (event.kind === 'content') {
                return (
                  <div
                    key={event.key}
                    className={cn(
                      "markdown-content",
                      isUser ? "markdown-user" : "markdown-assistant"
                    )}
                  >
                    <Suspense
                      fallback={
                        <div className="whitespace-pre-wrap break-words">
                          {event.content}
                        </div>
                      }
                    >
                      <MarkdownContent
                        content={event.content}
                        messageType={isUser ? 'user' : 'assistant'}
                        t={t}
                      />
                    </Suspense>
                  </div>
                );
              }

              const expanded = event.kind === 'reasoning'
                ? isExpanded || expandedEvents.has(event.key)
                : expandedEvents.has(event.key);
              const label = event.kind === 'reasoning' ? '思考' : event.name;

              return (
                <div key={event.key} className="text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => event.kind === 'reasoning' ? handleToggleReasoning() : toggleEvent(event.key)}
                    className="group/event text-left"
                  >
                    <span>{label}</span>
                    <span className="ml-1 opacity-0 group-hover/event:opacity-100 transition-opacity">...</span>
                  </button>
                  {expanded && event.kind === 'reasoning' && event.content && (
                    <div className="mt-1.5 pl-3 whitespace-pre-wrap break-words text-muted-foreground/80 leading-relaxed">
                      {event.content}
                    </div>
                  )}
                  {expanded && event.kind === 'tool' && (event.input || event.output) && (
                    <div className="mt-1.5 pl-3 space-y-2 text-muted-foreground/80 leading-relaxed">
                      {event.input && (
                        <div>
                          <div>输入</div>
                          <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                            {event.input}
                          </pre>
                        </div>
                      )}
                      {event.output && (
                        <div>
                          <div>结果</div>
                          <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                            {event.output}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {generating && events.length === 0 && (
              <div className="flex gap-1.5 items-center h-5 px-1">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce"></div>
              </div>
            )}
          </div>
        )}

        {/* Message Actions (底部工具栏) */}
        {!isUser && content && (
          <div className="flex gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full",
                copiedMessageId === messageId ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onCopyMessage(messageId, content)}
              title={copiedMessageId === messageId ? t('chat.copied') : t('chat.copy')}
            >
              <Copy size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full",
                playingMessageId === messageId ? "text-primary animate-pulse" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onPlayTTS(messageId, content)}
              title={playingMessageId === messageId ? t('chat.stopPlaying') : t('chat.read')}
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
