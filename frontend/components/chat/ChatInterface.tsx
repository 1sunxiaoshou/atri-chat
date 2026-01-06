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
import Toast, { ToastMessage } from '../Toast';

/**
 * 聊天界面主组件
 * 
 * 整合了消息列表、输入框、VRM 模型展示等功能
 * 使用 useChat、useVRM、useTTS 等自定义 Hook 管理状态和逻辑
 * 
 * @component
 */
interface ChatInterfaceProps {
  activeConversationId: number;
  activeCharacter: Character | null;
  activeModel: Model | null;
  onUpdateModel: (modelId: string) => void;
  availableModels: Model[];
  onConversationUpdated?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeConversationId,
  activeCharacter,
  activeModel,
  onUpdateModel,
  availableModels,
  onConversationUpdated
}) => {
  // 状态管理
  const [inputValue, setInputValue] = useState('');
  const [modelParameters, setModelParameters] = useState<ModelParameters>({});
  const [vrmDisplayMode, setVrmDisplayMode] = useState<'normal' | 'vrm' | 'live2d'>('normal');
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const [streamingMessageId] = useState(() => Date.now() + 999999); // 固定的流式消息ID
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string | number>>(new Set());

  // 使用自定义 Hooks
  const {
    messages,
    isTyping,
    currentResponse,
    currentReasoning,
    currentStatus,
    error: chatError,
    renderTrigger,
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

  // 加载消息
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  // 显示错误提示
  useEffect(() => {
    if (chatError) {
      setToastMessage({ success: false, message: chatError });
      const timer = setTimeout(() => {
        setToastMessage(null);
        clearChatError();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [chatError, clearChatError]);

  useEffect(() => {
    if (vrmError) {
      setToastMessage({ success: false, message: vrmError });
      const timer = setTimeout(() => {
        setToastMessage(null);
        clearVrmError();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [vrmError, clearVrmError]);

  useEffect(() => {
    if (ttsError) {
      setToastMessage({ success: false, message: ttsError });
      const timer = setTimeout(() => {
        setToastMessage(null);
        clearTtsError();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [ttsError, clearTtsError]);

  // 处理发送消息
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !activeCharacter || !activeModel) {return;}

    const content = inputValue;
    setInputValue('');

    try {
      // 准备模型参数
      const finalModelParams = { ...modelParameters };
      if (vrmDisplayMode === 'vrm') {
        finalModelParams.display_mode = 'vrm';
      } else {
        finalModelParams.display_mode = 'text';
      }

      console.log('发送消息参数:', {
        conversationId: activeConversationId,
        characterId: activeCharacter.character_id,
        modelId: activeModel.model_id,
        providerId: activeModel.provider_id,
        modelParams: finalModelParams,
        vrmDisplayMode
      });

      // 记录发送前的消息数量，用于判断是否是首次消息
      const messageCountBeforeSend = messages.length;

      await sendMessage(
        activeConversationId,
        content,
        activeCharacter,
        activeModel,
        finalModelParams,
        // VRM 数据回调
        (vrmData: any) => {
          if (vrmDisplayMode === 'vrm') {
            if (Array.isArray(vrmData)) {
              // 批量段（旧格式）
              playSegments(vrmData);
            } else if (vrmData.segments) {
              // 批量段（包装格式）
              playSegments(vrmData.segments);
            } else {
              // 单个段 - 直接播放
              playSegments([vrmData]);
            }
          }
        }
      );

      // 只在首次消息后刷新对话列表（用于更新自动生成的标题）
      // messageCountBeforeSend === 0 表示这是对话的第一条消息
      if (messageCountBeforeSend === 0) {
        onConversationUpdated?.();
      }
    } catch (err) {
      console.error('发送消息失败:', err);
    }
  }, [
    inputValue,
    activeCharacter,
    activeModel,
    activeConversationId,
    modelParameters,
    vrmDisplayMode,
    sendMessage,
    playSegments,
    onConversationUpdated,
    messages.length
  ]);

  // 处理复制消息
  const handleCopyMessage = useCallback(async (messageId: string | number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, []);

  // 处理 TTS 播放
  const handlePlayTTS = useCallback(async (messageId: string | number, text: string) => {
    await playTTS(messageId, text);
  }, [playTTS]);

  // 处理显示模式切换
  const handleVrmDisplayModeChange = useCallback((mode: 'normal' | 'vrm' | 'live2d') => {
    setVrmDisplayMode(mode);
  }, []);

  // 合并所有消息（包括流式响应）
  const allMessages = React.useMemo(() => {
    // 确保 messages 是数组
    const safeMessages = Array.isArray(messages) ? messages : [];
    
    // 在流式响应期间显示临时消息
    if (isTyping && (currentResponse || currentReasoning || currentStatus)) {
      const streamingMessage: Message = {
        message_id: streamingMessageId, // 使用固定ID，避免组件重新创建
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
  }, [messages, isTyping, currentResponse, currentReasoning, activeConversationId, renderTrigger]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors relative">
      {/* Toast 提示 */}
      <Toast message={toastMessage} />

      {/* Header */}
      <ChatHeader
        activeCharacter={activeCharacter}
        activeModel={activeModel}
        availableModels={availableModels}
        vrmDisplayMode={vrmDisplayMode}
        modelParameters={modelParameters}
        onUpdateModel={onUpdateModel}
        onVrmDisplayModeChange={handleVrmDisplayModeChange}
        onModelParametersChange={setModelParameters}
      />

      {/* Messages / VRM View */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 relative">
        {vrmDisplayMode === 'vrm' && (
          <VRMViewer canvasRef={canvasRef} subtitle={subtitle} />
        )}

        <div className={`relative z-10 ${vrmDisplayMode === 'vrm' ? 'hidden' : ''}`}>
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

      {/* Input Area */}
      <ChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSend}
        isTyping={isTyping}
        vrmDisplayMode={vrmDisplayMode}
      />
    </div>
  );
};

export default ChatInterface;
