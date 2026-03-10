import React from 'react';
import { Message, Character } from '../../types';
import MessageList from './MessageList';
import MessageItem from './MessageItem';

interface NormalChatModeProps {
    messages: Message[];
    isTyping: boolean;
    activeCharacter: Character | null;
    playingMessageId: string | number | null;
    copiedMessageId: string | number | null;
    expandedReasoning: Set<string | number>;
    onCopyMessage: (messageId: string | number, content: string) => void;
    onPlayTTS: (messageId: string | number, text: string) => void;
    onToggleReasoning: (messageId: string | number) => void;
    currentResponse: string;
}

/**
 * 普通聊天模式组件
 * 完全隔离的消息列表渲染，不包含任何VRM相关逻辑
 * 使用React.memo确保只有消息相关props变化时才重渲染
 */
export const NormalChatMode = React.memo(function NormalChatMode({
    messages,
    isTyping,
    activeCharacter,
    playingMessageId,
    copiedMessageId,
    expandedReasoning,
    onCopyMessage,
    onPlayTTS,
    onToggleReasoning,
    currentResponse,
}: NormalChatModeProps) {
    return (
        <div className="flex-1">
            <MessageList
                messages={messages}
                isTyping={isTyping && !currentResponse}
                activeCharacter={activeCharacter}
            >
                {messages.map((msg) => (
                    <MessageItem
                        key={msg.message_id}
                        message={msg}
                        activeCharacter={activeCharacter}
                        playingMessageId={playingMessageId}
                        copiedMessageId={copiedMessageId}
                        onCopyMessage={onCopyMessage}
                        onPlayTTS={onPlayTTS}
                        expandedReasoning={expandedReasoning}
                        onToggleReasoning={onToggleReasoning}
                    />
                ))}
            </MessageList>
        </div>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数：只有消息相关属性变化时才重新渲染
    return (
        prevProps.messages === nextProps.messages &&
        prevProps.isTyping === nextProps.isTyping &&
        prevProps.activeCharacter === nextProps.activeCharacter &&
        prevProps.playingMessageId === nextProps.playingMessageId &&
        prevProps.copiedMessageId === nextProps.copiedMessageId &&
        prevProps.expandedReasoning === nextProps.expandedReasoning &&
        prevProps.onCopyMessage === nextProps.onCopyMessage &&
        prevProps.onPlayTTS === nextProps.onPlayTTS &&
        prevProps.onToggleReasoning === nextProps.onToggleReasoning &&
        prevProps.currentResponse === nextProps.currentResponse
    );
});