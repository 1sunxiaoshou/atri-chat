import React, { useState, useEffect, useCallback, startTransition, useRef } from 'react';
import { Character, Message, Model, ModelParameters } from '../../types';
import { useChat } from '../../hooks/useChat';
import { useVRM } from '../../hooks/useVRM';
import { useTTS } from '../../hooks/useTTS';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAudioStore } from '../../store/useAudioStore';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import { NormalChatMode } from './NormalChatMode';
import RightSidebar from '../layout/RightSidebar';

const VRMChatMode = React.lazy(() => import('./VRMChatMode').then(m => ({ default: m.VRMChatMode })));
import { cn } from '../../utils/cn';

interface ChatInterfaceProps {
  activeConversationId: string | number;
  activeCharacter: Character | null;
  activeModel: Model | null;
  onUpdateModel: (modelId: string) => void;
  onConversationUpdated?: () => void;
  onOpenMobileSidebar?: () => void;
  onShowSidebar?: () => void;
  isSidebarHidden?: boolean;
  setGlobalToast?: (toast: { success: boolean, message: string } | null) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeConversationId,
  activeCharacter,
  activeModel,
  onUpdateModel,
  onConversationUpdated,
  onOpenMobileSidebar,
  onShowSidebar,
  isSidebarHidden = false,
  setGlobalToast
}) => {
  const { t } = useLanguage();
  const [modelParameters, setModelParameters] = useState<ModelParameters>({});
  const [vrmDisplayMode, setVrmDisplayMode] = useState<'normal' | 'vrm' | 'live2d'>('normal');
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string | number>>(new Set());
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  // autoPlay 设置从 Store 读取
  const autoPlay = useAudioStore((state) => state.autoPlay);
  // 追踪已自动播放的消息 ID，避免重复触发
  const autoPlayedRef = useRef<Set<string | number>>(new Set());
  // 标记当前会话是否为初次加载，避免切换会话时朗读历史最后一条消息
  const isInitialLoadRef = useRef(true);

  const {
    messages,
    isTyping,
    currentResponse,
    currentReasoning,
    currentStatus,
    currentToolCalls,
    error: chatError,
    loadMessages,
    sendMessage,
    clearError: clearChatError
  } = useChat();

  const {
    modelUrl,
    expression,
    motionUrl,
    audioElement,
    subtitle,
    error: vrmError,
    playSegments,
    startThinking,
    clearError: clearVrmError,
    onModelLoaded,
    onMotionComplete,
  } = useVRM(activeCharacter, vrmDisplayMode === 'vrm');

  const {
    playingMessageId,
    error: ttsError,
    playTTS,
    clearError: clearTtsError
  } = useTTS();

  useEffect(() => {
    if (activeConversationId) {
      isInitialLoadRef.current = true; // 切换会话时标记为初次加载
      loadMessages(activeConversationId).then(() => {
        // 等待下一帧取消初次加载标记，让那些已经存在的历史消息不要触发 autoPlay
        requestAnimationFrame(() => {
          isInitialLoadRef.current = false;
        });
      });
      // 切换会话时重置已播放记录
      autoPlayedRef.current = new Set();
    }
  }, [activeConversationId, loadMessages]);

  // autoPlay：监听 messages，新增 assistant 消息时自动播放 TTS
  useEffect(() => {
    if (!autoPlay || vrmDisplayMode === 'vrm' || messages.length === 0) return;

    // 找最后一条 assistant 消息
    const lastMsg = messages[messages.length - 1];
    if (
      !isInitialLoadRef.current && // 必须不是初次加载历史消息
      lastMsg &&
      lastMsg.message_type === 'assistant' &&
      lastMsg.content &&
      !lastMsg.generating && // 不在生成中才播放
      !autoPlayedRef.current.has(lastMsg.message_id)
    ) {
      autoPlayedRef.current.add(lastMsg.message_id);
      playTTS(lastMsg.message_id, lastMsg.content, activeCharacter?.id ?? undefined);
    }
  }, [messages, autoPlay, vrmDisplayMode, activeCharacter, playTTS]);

  useEffect(() => {
    const error = chatError || vrmError || ttsError;
    if (error && setGlobalToast) {
      setGlobalToast({ success: false, message: error });
      const timer = setTimeout(() => {
        setGlobalToast(null);
        if (chatError) clearChatError();
        if (vrmError) clearVrmError();
        if (ttsError) clearTtsError();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [chatError, vrmError, ttsError, clearChatError, clearVrmError, clearTtsError, setGlobalToast]);

  // 移除 handleInputChange，不再需要

  // 优化发送消息回调，使用startTransition降低状态更新优先级
  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || !activeCharacter) { return; }

    // 校验：如果角色没有配置模型，显示错误提示
    if (!activeModel && setGlobalToast) {
      setGlobalToast({
        success: false,
        message: t('chat.noModelConfigured')
      });
      // 3秒后自动清除提示
      setTimeout(() => setGlobalToast(null), 3000);
      return;
    }

    try {
      // 默认折叠新消息的思考过程
      setExpandedReasoning(prev => {
        const newSet = new Set(prev);
        newSet.delete('streaming-temp');
        return newSet;
      });

      // 如果是VRM模式，立即开始思考动作（高优先级）
      if (vrmDisplayMode === 'vrm' && startThinking) {
        startThinking();
      }

      const finalModelParams = { ...modelParameters };
      finalModelParams.display_mode = vrmDisplayMode === 'vrm' ? 'vrm' : 'text';

      // 使用startTransition将消息发送标记为低优先级更新
      // 这样VRM渲染不会被阻塞
      startTransition(() => {
        if (!activeModel) return;
        
        sendMessage(
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
          },
          () => {
            // 当探测到标题更新（通常是第一条消息）时，刷新侧边栏
            onConversationUpdated?.();
          }
        );
      });
    } catch (err) {
      console.error(t('chat.sendMessageFailed'), err);
    }
  }, [
    activeCharacter,
    activeModel,
    activeConversationId,
    modelParameters,
    vrmDisplayMode,
    startThinking,
    sendMessage,
    playSegments,
    onConversationUpdated,
    messages.length,
    t
  ]);

  // 优化：MessageList相关的回调只在非VRM模式下创建
  const handleCopyMessage = useCallback(async (messageId: string | number, content: string) => {
    if (vrmDisplayMode === 'vrm') return; // VRM模式下不需要

    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error(t('chat.copyFailed'), error);
    }
  }, [vrmDisplayMode, t]);

  const handlePlayTTS = useCallback(async (messageId: string | number, text: string) => {
    if (vrmDisplayMode === 'vrm') return; // VRM模式下不需要

    // 传递当前角色 ID，使用角色绑定的音色
    await playTTS(messageId, text, activeCharacter?.id);
  }, [playTTS, activeCharacter, vrmDisplayMode]);

  const handleVrmDisplayModeChange = useCallback((mode: 'normal' | 'vrm' | 'live2d') => {
    setVrmDisplayMode(mode);
  }, []);

  // 优化：只在非VRM模式下计算消息列表，避免不必要的计算
  const allMessages = React.useMemo(() => {
    // VRM模式下不显示消息列表，直接返回空数组节省计算
    if (vrmDisplayMode === 'vrm') {
      return [];
    }

    const safeMessages = Array.isArray(messages) ? messages : [];
    if (isTyping) {
      const streamingMessage: Message = {
        message_id: 'streaming-temp', // 使用固定 ID，避免每次都创建新对象
        conversation_id: activeConversationId,
        message_type: 'assistant',
        content: currentResponse || '',
        reasoning: currentReasoning || undefined,
        status: currentStatus || undefined,
        tool_calls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
        generating: true,
        created_at: new Date().toISOString()
      };
      return [...safeMessages, streamingMessage];
    }
    return safeMessages;
  }, [messages, isTyping, currentResponse, currentReasoning, currentStatus, currentToolCalls, activeConversationId, vrmDisplayMode]);

  return (
    <div className="flex flex-col h-full bg-background transition-colors relative overflow-hidden">

      <ChatHeader
        activeCharacter={activeCharacter}
        activeModel={activeModel}
        vrmDisplayMode={vrmDisplayMode}
        modelParameters={modelParameters}
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
        modelParameters={modelParameters}
        onUpdateModel={onUpdateModel}
        onModelParametersChange={setModelParameters}
      />

      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative custom-scrollbar">
        <div className={cn(
          "h-full flex flex-col",
          vrmDisplayMode !== 'vrm' && "mx-auto"
        )}>
          {vrmDisplayMode === 'vrm' ? (
            // VRM模式：完全隔离的VRM组件，懒加载
            <React.Suspense fallback={
              <div className="flex h-full items-center justify-center flex-col gap-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground text-sm">正在加载 3D 渲染引擎...</p>
              </div>
            }>
              <VRMChatMode
                modelUrl={modelUrl}
                audioElement={audioElement}
                expression={expression}
                motionUrl={motionUrl}
                subtitle={subtitle}
                activeCharacterId={activeCharacter?.id}
                onModelLoaded={onModelLoaded}
                onMotionComplete={onMotionComplete}
              />
            </React.Suspense>
          ) : (
            // 普通模式：完全隔离的消息列表组件
            <NormalChatMode
              messages={allMessages}
              isTyping={isTyping}
              activeCharacter={activeCharacter}
              playingMessageId={playingMessageId}
              copiedMessageId={copiedMessageId}
              expandedReasoning={expandedReasoning}
              onCopyMessage={handleCopyMessage}
              onPlayTTS={handlePlayTTS}
              onToggleReasoning={(messageId) => {
                const newExpanded = new Set(expandedReasoning);
                if (newExpanded.has(messageId)) {
                  newExpanded.delete(messageId);
                } else {
                  newExpanded.add(messageId);
                }
                setExpandedReasoning(newExpanded);
              }}
              currentResponse={currentResponse}
            />
          )}
        </div>
      </main>

      <ChatInput
        onSend={handleSend}
        isTyping={isTyping}
      />
    </div>
  );
};

export default ChatInterface;
