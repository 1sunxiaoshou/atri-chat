import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { FetchStreamTransport, useStream } from '@langchain/react';
import { Character, Model, ModelParameters, AgentStreamContext, AgentStreamCustomEvent } from '../types';
import { api, buildURL } from '../services/api';
import { HTTP_STATUS } from '../utils/constants';
import { Logger } from '../utils/logger';

interface AgentStreamState extends Record<string, unknown> {
  messages: unknown[];
}

export const useAgentStream = (conversationId: string | number) => {
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const messagesRef = useRef<BaseMessage[]>([]);
  const vrmDataRef = useRef<((data: unknown) => void) | undefined>(undefined);
  const isVrmModeRef = useRef(false);

  const transport = useMemo(
    () =>
      new FetchStreamTransport<AgentStreamState>({
        apiUrl: buildURL('/agent-stream'),
      }),
    [],
  );

  const stream = useStream<AgentStreamState>({
    transport,
    threadId: String(conversationId),
    messagesKey: 'messages',
    initialValues: { messages: [] },
    onCustomEvent: (event) => {
      const customEvent = event as AgentStreamCustomEvent;

      if (customEvent.type === 'reasoning' && typeof customEvent.content === 'string') {
        setStreamingReasoning((previous) => previous + customEvent.content);
      }

      if (customEvent.type === 'vrm.perform_actions') {
        if (!isVrmModeRef.current) {
          return;
        }
        vrmDataRef.current?.({
          kind: 'commands',
          commands: customEvent.commands,
          speech: customEvent.speech,
          toolCallId: customEvent.toolCallId,
        });
      }

      if (customEvent.type === 'vrm.control_camera') {
        if (!isVrmModeRef.current) {
          return;
        }
        vrmDataRef.current?.({ kind: 'camera', command: customEvent.command });
      }

      if (customEvent.type === 'error' && typeof customEvent.message === 'string') {
        setError(customEvent.message);
      }
    },
    onError: (streamError) => {
      const message = streamError instanceof Error ? streamError.message : '流式消息失败';
      Logger.error('Agent stream 失败', streamError instanceof Error ? streamError : undefined);
      setError(message);
    },
  });
  const {
    isLoading,
    submit,
    switchThread,
  } = stream;

  const loadMessages = useCallback(async (targetConversationId: string | number) => {
    setError(null);
    try {
      const response = await api.getMessages(targetConversationId);
      if (response.code === HTTP_STATUS.OK) {
        const messagesData = Array.isArray(response.data) ? response.data : [];
        messagesRef.current = messagesData;
        setMessages(messagesData);
        Logger.debug(`useAgentStream 加载了 ${messagesData.length} 条消息`);
        return;
      }

      const errorMsg = response.message || '加载消息失败';
      setError(errorMsg);
      messagesRef.current = [];
      setMessages([]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载消息失败';
      Logger.error('useAgentStream 加载消息失败', err instanceof Error ? err : undefined);
      setError(errorMsg);
      messagesRef.current = [];
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    switchThread(String(conversationId));
    setStreamingReasoning('');
    messagesRef.current = [];
    setMessages([]);
    void loadMessages(conversationId);
  }, [conversationId, loadMessages, switchThread]);

  const sendMessage = useCallback(async (
    targetConversationId: string | number,
    content: string,
    character: Character,
    model: Model,
    modelParameters?: ModelParameters,
    _onVrmData?: (data: unknown) => void,
  ) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    vrmDataRef.current = _onVrmData;
    isVrmModeRef.current = modelParameters?.display_mode === 'vrm';
    setError(null);
    setStreamingReasoning('');
    const turnId = crypto.randomUUID();
    const userMessageId = crypto.randomUUID();

    const streamContext: AgentStreamContext = {
      conversation_id: String(targetConversationId),
      turn_id: turnId,
      user_message_id: userMessageId,
      character_id: character.id,
      model_id: model.model_id,
      provider_config_id: model.provider_config_id,
      display_mode: modelParameters?.display_mode === 'vrm' ? 'vrm' : 'text',
      temperature: modelParameters?.temperature,
      max_tokens: modelParameters?.max_tokens,
      top_p: modelParameters?.top_p,
      enable_thinking: modelParameters?.enable_thinking,
      thinking_config: modelParameters?.thinking_config,
    };

    const optimisticHumanMessage = new HumanMessage({
      id: userMessageId,
      content: trimmed,
    });
    const nextMessages = [...messagesRef.current, optimisticHumanMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    await submit(
      {
        messages: [{ type: 'human', id: userMessageId, content: trimmed }],
      },
      {
        context: streamContext as unknown as Record<string, unknown>,
        optimisticValues: () => ({
          messages: nextMessages,
        }),
        onError: (streamError) => {
          const message = streamError instanceof Error ? streamError.message : '消息发送失败';
          setError(message);
        },
      },
    );
  }, [submit]);

  const streamValueMessages = (stream.values as Partial<AgentStreamState>).messages;
  const streamMessages = Array.isArray(streamValueMessages)
    ? streamValueMessages as BaseMessage[]
    : undefined;

  useEffect(() => {
    if (!streamMessages || streamMessages.length === 0 || messagesRef.current === streamMessages) {
      return;
    }

    messagesRef.current = streamMessages;
    setMessages(streamMessages);
  }, [streamMessages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isTyping: isLoading,
    error,
    streamingReasoning,
    loadMessages,
    sendMessage,
    clearError,
  };
};
