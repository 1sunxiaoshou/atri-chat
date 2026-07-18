import { type BaseMessage } from '@langchain/core/messages';

export const extractMessageText = (content: unknown): string => {
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
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }

  return '';
};

export const getMessageId = (message: BaseMessage, fallback: string | number): string => (
  String(message.id ?? fallback)
);

export const extractMessageReasoning = (message: BaseMessage | undefined): string => {
  const additionalKwargs = message?.additional_kwargs as Record<string, unknown> | undefined;
  const reasoning = additionalKwargs?.reasoning_content ?? additionalKwargs?.reasoning;
  return typeof reasoning === 'string' ? reasoning : '';
};

export const isUserMessage = (message: BaseMessage | undefined): boolean => message?.getType() === 'human';

export const isAssistantMessage = (message: BaseMessage | undefined): boolean => message?.getType() === 'ai';

export const isToolResultMessage = (message: BaseMessage | undefined): boolean => message?.getType() === 'tool';
