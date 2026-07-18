import React from 'react';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import { Character } from '../../types';
import MessageList from './MessageList';
import MessageItem from './MessageItem';
import { isUserMessage } from '../../utils/langchainMessages';

interface ChatTurn {
    key: string;
    messages: BaseMessage[];
    firstIndex: number;
    role: 'user' | 'assistant';
}

interface NormalChatModeProps {
    messages: BaseMessage[];
    activeCharacter: Character | null;
    playingMessageId: string | number | null;
    copiedMessageId: string | number | null;
    expandedReasoning: Set<string | number>;
    onCopyMessage: (messageId: string | number, content: string) => void;
    onPlayTTS: (messageId: string | number, text: string) => void;
    onToggleReasoning: (messageId: string | number) => void;
    isTyping: boolean;
    streamingReasoning: string;
}

/**
 * 普通聊天模式组件
 * 完全隔离的消息列表渲染，不包含任何VRM相关逻辑
 * 使用React.memo确保只有消息相关props变化时才重渲染
 */
export const NormalChatMode = React.memo(function NormalChatMode({
    messages,
    activeCharacter,
    playingMessageId,
    copiedMessageId,
    expandedReasoning,
    onCopyMessage,
    onPlayTTS,
    onToggleReasoning,
    isTyping,
    streamingReasoning,
}: NormalChatModeProps) {
    const shouldShowWaiting = isTyping && isUserMessage(messages[messages.length - 1]);
    const turns = React.useMemo(() => {
        const groupedTurns: ChatTurn[] = [];

        messages.forEach((message, index) => {
            const role = isUserMessage(message) ? 'user' : 'assistant';
            const previous = groupedTurns[groupedTurns.length - 1];

            if (role === 'assistant' && previous?.role === 'assistant') {
                previous.messages.push(message);
                return;
            }

            groupedTurns.push({
                key: String(message.id ?? `${message.getType()}-${index}`),
                messages: [message],
                firstIndex: index,
                role,
            });
        });

        return groupedTurns;
    }, [messages]);

    return (
        <div className="flex-1">
            <MessageList
                messages={messages}
                activeCharacter={activeCharacter}
            >
                {turns.map((turn, turnIndex) => {
                    const primaryMessage = turn.messages[0];
                    if (!primaryMessage) {
                        return null;
                    }
                    const isStreamingAssistant = isTyping && turnIndex === turns.length - 1 && turn.role === 'assistant';
                    return (
                        <MessageItem
                            key={turn.key}
                            message={primaryMessage}
                            groupedMessages={turn.messages}
                            index={turn.firstIndex}
                            activeCharacter={activeCharacter}
                            playingMessageId={playingMessageId}
                            copiedMessageId={copiedMessageId}
                            onCopyMessage={onCopyMessage}
                            onPlayTTS={onPlayTTS}
                            expandedReasoning={expandedReasoning}
                            onToggleReasoning={onToggleReasoning}
                            generating={isStreamingAssistant}
                            reasoning={isStreamingAssistant ? streamingReasoning : undefined}
                        />
                    );
                })}
                {shouldShowWaiting && (
                    <MessageItem
                        key="assistant-waiting"
                        message={new AIMessage({ id: 'assistant-waiting', content: '' })}
                        index={messages.length}
                        activeCharacter={activeCharacter}
                        playingMessageId={playingMessageId}
                        copiedMessageId={copiedMessageId}
                        onCopyMessage={onCopyMessage}
                        onPlayTTS={onPlayTTS}
                        expandedReasoning={expandedReasoning}
                        onToggleReasoning={onToggleReasoning}
                        generating
                        reasoning={streamingReasoning}
                    />
                )}
            </MessageList>
        </div>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数：只有消息相关属性变化时才重新渲染
    return (
        prevProps.messages === nextProps.messages &&
        prevProps.activeCharacter === nextProps.activeCharacter &&
        prevProps.playingMessageId === nextProps.playingMessageId &&
        prevProps.copiedMessageId === nextProps.copiedMessageId &&
        prevProps.expandedReasoning === nextProps.expandedReasoning &&
        prevProps.onCopyMessage === nextProps.onCopyMessage &&
        prevProps.onPlayTTS === nextProps.onPlayTTS &&
        prevProps.onToggleReasoning === nextProps.onToggleReasoning &&
        prevProps.isTyping === nextProps.isTyping &&
        prevProps.streamingReasoning === nextProps.streamingReasoning
    );
});
