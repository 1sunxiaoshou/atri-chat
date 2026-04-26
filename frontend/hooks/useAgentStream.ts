import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { FetchStreamTransport, type ToolCallWithResult, useStream } from '@langchain/react';
import { Character, Message, Model, ModelParameters, ToolCall, AgentStreamContext, AgentStreamCustomEvent } from '../types';
import { api, buildURL } from '../services/api';
import { HTTP_STATUS } from '../utils/constants';
import { Logger } from '../utils/logger';

interface AgentStreamState extends Record<string, unknown> {
  messages: unknown[];
}

const STREAM_ASSISTANT_TEMP_ID = 'stream-assistant-temp';

const getMessageKind = (message: BaseMessage): string => {
  const candidate = message as BaseMessage & { type?: string; getType?: () => string };
  if (typeof candidate.getType === 'function') {
    return candidate.getType();
  }
  return candidate.type ?? 'unknown';
};

const extractTextContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object') {
          const maybeText = (part as { text?: unknown }).text;
          if (typeof maybeText === 'string') {
            return maybeText;
          }
        }
        return '';
      })
      .join('');
  }

  return '';
};

const mapToolState = (state: 'pending' | 'completed' | 'error'): ToolCall['status'] => {
  if (state === 'pending') {
    return 'running';
  }
  return state;
};

const mapToolCallsForMessage = (
  message: BaseMessage,
  toolCalls: ToolCallWithResult[],
): ToolCall[] | undefined => {
  const rawToolCalls = (message as BaseMessage & { tool_calls?: Array<{ id?: string; name?: string }> }).tool_calls;
  if (!Array.isArray(rawToolCalls) || rawToolCalls.length === 0) {
    return undefined;
  }

  const toolCallIds = new Set(
    rawToolCalls
      .map((toolCall) => toolCall.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const mapped = toolCalls
    .filter((toolCall) => typeof toolCall.call.id === 'string' && toolCallIds.has(toolCall.call.id))
    .map((toolCall) => ({
      run_id: toolCall.call.id as string,
      tool: toolCall.call.name,
      input: toolCall.call.args,
      output: toolCall.result?.content,
      status: mapToolState(toolCall.state),
    }));

  return mapped.length > 0 ? mapped : undefined;
};

const toUiMessage = (
  message: BaseMessage,
  conversationId: string | number,
  toolCalls: ToolCallWithResult[],
  isStreaming: boolean,
  streamingReasoning: string,
): Message | null => {
  const kind = getMessageKind(message);
  if (kind !== 'human' && kind !== 'ai') {
    return null;
  }

  const content = extractTextContent(message.content);
  const messageId = message.id ?? `${conversationId}-${kind}-${content.slice(0, 24)}`;
  const converted: Message = {
    message_id: messageId,
    conversation_id: conversationId,
    message_type: kind === 'human' ? 'user' : 'assistant',
    content,
    created_at: new Date().toISOString(),
  };

  if (kind === 'ai') {
    converted.tool_calls = mapToolCallsForMessage(message, toolCalls);
    converted.generating = isStreaming;
    if (streamingReasoning) {
      converted.reasoning = streamingReasoning;
    }
  }

  return converted;
};

const mergeMessages = (historyMessages: Message[], streamMessages: Message[]): Message[] => {
  const merged = new Map<string, Message>();

  for (const message of [...historyMessages, ...streamMessages]) {
    merged.set(String(message.message_id), message);
  }

  return [...merged.values()];
};

export const useAgentStream = (conversationId: string | number) => {
  const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customEvents, setCustomEvents] = useState<AgentStreamCustomEvent[]>([]);
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const titleUpdateRef = useRef<((title: string) => void) | undefined>(undefined);
  const vrmDataRef = useRef<((data: unknown) => void) | undefined>(undefined);

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
      setCustomEvents((previous) => [...previous.slice(-49), customEvent]);

      if (customEvent.type === 'reasoning' && typeof customEvent.content === 'string') {
        setStreamingReasoning((previous) => previous + customEvent.content);
      }

      if (customEvent.type === 'title_update' && typeof customEvent.title === 'string') {
        titleUpdateRef.current?.(customEvent.title);
      }

      if (customEvent.type === 'vrm.perform_actions') {
        vrmDataRef.current?.({
          kind: 'commands',
          commands: customEvent.commands,
          speech: customEvent.speech,
          toolCallId: customEvent.toolCallId,
        });
      }

      if (customEvent.type === 'vrm.control_camera') {
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
    messages: liveMessages,
    submit,
    switchThread,
  } = stream;
  const toolCalls = (stream as typeof stream & { toolCalls?: ToolCallWithResult[] }).toolCalls ?? [];

  const loadMessages = useCallback(async (targetConversationId: string | number) => {
    setError(null);
    try {
      const response = await api.getMessages(targetConversationId);
      if (response.code === HTTP_STATUS.OK) {
        const messagesData = Array.isArray(response.data) ? response.data : [];
        setHistoryMessages(messagesData);
        Logger.debug(`useAgentStream 加载了 ${messagesData.length} 条消息`);
        return;
      }

      const errorMsg = response.message || '加载消息失败';
      setError(errorMsg);
      setHistoryMessages([]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载消息失败';
      Logger.error('useAgentStream 加载消息失败', err instanceof Error ? err : undefined);
      setError(errorMsg);
      setHistoryMessages([]);
    }
  }, []);

  useEffect(() => {
    switchThread(String(conversationId));
    setStreamingReasoning('');
    setCustomEvents([]);
    void loadMessages(conversationId);
  }, [conversationId, loadMessages, switchThread]);

  const sendMessage = useCallback(async (
    targetConversationId: string | number,
    content: string,
    character: Character,
    model: Model,
    modelParameters?: ModelParameters,
    _onVrmData?: (data: unknown) => void,
    onTitleUpdate?: (title: string) => void,
  ) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    titleUpdateRef.current = onTitleUpdate;
    vrmDataRef.current = _onVrmData;
    setError(null);
    setStreamingReasoning('');

    const streamContext: AgentStreamContext = {
      conversation_id: String(targetConversationId),
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
      id: `${STREAM_ASSISTANT_TEMP_ID}-${crypto.randomUUID()}`,
      content: trimmed,
    });

    await submit(
      {
        messages: [{ type: 'human', content: trimmed }],
      },
      {
        context: streamContext as unknown as Record<string, unknown>,
        optimisticValues: (previous) => ({
          ...previous,
          messages: [...(previous?.messages ?? []), optimisticHumanMessage],
        }),
        onError: (streamError) => {
          const message = streamError instanceof Error ? streamError.message : '消息发送失败';
          setError(message);
        },
      },
    );
  }, [submit]);

  const streamMessages = useMemo(() => {
    const converted = liveMessages
      .map((message) => toUiMessage(message, conversationId, toolCalls, isLoading, streamingReasoning))
      .filter((message): message is Message => message !== null);

    if (!isLoading) {
      return converted;
    }

    for (let index = converted.length - 1; index >= 0; index -= 1) {
      const current = converted[index];
      if (!current) {
        continue;
      }
      if (current.message_type === 'assistant') {
        current.generating = true;
        break;
      }
    }

    return converted;
  }, [conversationId, isLoading, liveMessages, streamingReasoning, toolCalls]);

  const messages = useMemo(
    () => mergeMessages(historyMessages, streamMessages),
    [historyMessages, streamMessages],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isTyping: isLoading,
    error,
    customEvents,
    loadMessages,
    sendMessage,
    clearError,
  };
};
