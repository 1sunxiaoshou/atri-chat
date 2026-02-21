import React, { useState, useEffect, useCallback } from 'react';
import { Character, Message, Model, ModelParameters } from '../../types';
import { useChat } from '../../hooks/useChat';
import { useVRM } from '../../hooks/useVRM';
import { useTTS } from '../../hooks/useTTS';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import VRMViewer from './VRMViewer';
import RightSidebar from './RightSidebar';
import Toast, { ToastMessage } from '../ui/Toast';
import { cn } from '../../utils/cn';

interface ChatInterfaceProps {
  activeConversationId: number | string;
  activeCharacter: Character | null;
  activeModel: Model | null;
  onUpdateModel: (modelId: string) => void;
  availableModels: Model[];
  onConversationUpdated?: () => void;
  onOpenMobileSidebar?: () => void;
  onShowSidebar?: () => void;
  isSidebarHidden?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeConversationId,
  activeCharacter,
  activeModel,
  onUpdateModel,
  availableModels,
  onConversationUpdated,
  onOpenMobileSidebar,
  onShowSidebar,
  isSidebarHidden = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [modelParameters, setModelParameters] = useState<ModelParameters>({});
  const [vrmDisplayMode, setVrmDisplayMode] = useState<'normal' | 'vrm' | 'live2d'>('normal');
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const [streamingMessageId] = useState(() => `streaming-${Date.now()}`);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string | number>>(new Set());
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const {
    messages,
    isTyping,
    currentResponse,
    currentReasoning,
    currentStatus,
    error: chatError,
    loadMessages,
    sendMessage,
    clearError: clearChatError
  } = useChat();

  const {
    canvasRef,
    subtitle,
    error: vrmError,
    playSegments,
    clearError: clearVrmError
  } = useVRM(activeCharacter, vrmDisplayMode === 'vrm');

  const {
    playingMessageId,
    error: ttsError,
    playTTS,
    clearError: clearTtsError
  } = useTTS();

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    const error = chatError || vrmError || ttsError;
    if (error) {
      setToastMessage({ success: false, message: error });
      const timer = setTimeout(() => {
        setToastMessage(null);
        if (chatError) clearChatError();
        if (vrmError) clearVrmError();
        if (ttsError) clearTtsError();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [chatError, vrmError, ttsError, clearChatError, clearVrmError, clearTtsError]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !activeCharacter || !activeModel) { return; }

    const content = inputValue;
    setInputValue('');

    try {
      const finalModelParams = { ...modelParameters };
      finalModelParams.display_mode = vrmDisplayMode === 'vrm' ? 'vrm' : 'text';

      const messageCountBeforeSend = messages.length;

      await sendMessage(
        activeConversationId,
        content,
        activeCharacter,
        activeModel,
        finalModelParams,
        (vrmData: any) => {
          if (vrmDisplayMode === 'vrm') {
            const segments = Array.isArray(vrmData) ? vrmData : (vrmData.segments || [vrmData]);
            playSegments(segments);
          }
        }
      );

      if (messageCountBeforeSend === 0) {
        onConversationUpdated?.();
      }
    } catch (err) {
      console.error('发送消息失败:', err);
    }
  }, [inputValue, activeCharacter, activeModel, activeConversationId, modelParameters, vrmDisplayMode, sendMessage, playSegments, onConversationUpdated, messages.length]);

  const handleCopyMessage = useCallback(async (messageId: string | number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, []);

  const handlePlayTTS = useCallback(async (messageId: string | number, text: string) => {
    await playTTS(messageId, text);
  }, [playTTS]);

  const handleVrmDisplayModeChange = useCallback((mode: 'normal' | 'vrm' | 'live2d') => {
    setVrmDisplayMode(mode);
  }, []);

  const allMessages = React.useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    if (isTyping && (currentResponse || currentReasoning || currentStatus)) {
      const streamingMessage: Message = {
        message_id: streamingMessageId,
        conversation_id: activeConversationId,
        message_type: 'assistant',
        content: currentResponse || '',
        reasoning: currentReasoning || undefined,
        status: currentStatus || undefined,
        generating: true,
        created_at: new Date().toISOString()
      };
      return [...safeMessages, streamingMessage];
    }
    return safeMessages;
  }, [messages, isTyping, currentResponse, currentReasoning, currentStatus, activeConversationId, streamingMessageId]);

  return (
    <div className="flex flex-col h-full bg-background transition-colors relative overflow-hidden">
      <Toast message={toastMessage} />

      <ChatHeader
        activeCharacter={activeCharacter}
        activeModel={activeModel}
        availableModels={availableModels}
        vrmDisplayMode={vrmDisplayMode}
        modelParameters={modelParameters}
        onUpdateModel={onUpdateModel}
        onVrmDisplayModeChange={handleVrmDisplayModeChange}
        onModelParametersChange={setModelParameters}
        onOpenMobileSidebar={onOpenMobileSidebar}
        onOpenRightSidebar={() => setIsRightSidebarOpen(true)}
        onShowSidebar={onShowSidebar}
        isSidebarHidden={isSidebarHidden}
      />

      <RightSidebar
        isOpen={isRightSidebarOpen}
        onClose={() => setIsRightSidebarOpen(false)}
        activeModel={activeModel}
        availableModels={availableModels}
        modelParameters={modelParameters}
        onUpdateModel={onUpdateModel}
        onModelParametersChange={setModelParameters}
      />

      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative custom-scrollbar">
        <div className={cn(
          "h-full flex flex-col",
          vrmDisplayMode !== 'vrm' && "mx-auto"
        )}>
          {vrmDisplayMode === 'vrm' && (
            <VRMViewer canvasRef={canvasRef} subtitle={subtitle} />
          )}

          <div className={cn(
            "flex-1",
            vrmDisplayMode === 'vrm' && "hidden"
          )}>
            <MessageList
              messages={allMessages}
              isTyping={isTyping && !currentResponse}
              activeCharacter={activeCharacter}
              onSetInputValue={setInputValue}
            >
              {allMessages.map((msg) => (
                <MessageItem
                  key={msg.message_id}
                  message={msg}
                  activeCharacter={activeCharacter}
                  playingMessageId={playingMessageId}
                  copiedMessageId={copiedMessageId}
                  onCopyMessage={handleCopyMessage}
                  onPlayTTS={handlePlayTTS}
                  expandedReasoning={expandedReasoning}
                  onToggleReasoning={(messageId) => {
                    const newExpanded = new Set(expandedReasoning);
                    if (newExpanded.has(messageId)) {
                      newExpanded.delete(messageId);
                    } else {
                      newExpanded.add(messageId);
                    }
                    setExpandedReasoning(newExpanded);
                  }}
                />
              ))}
            </MessageList>
          </div>
        </div>
      </main>

      <ChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSend}
        isTyping={isTyping}
      />
    </div>
  );
};

export default ChatInterface;
