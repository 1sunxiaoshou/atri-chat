import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';

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

export const isUserMessage = (message: BaseMessage): boolean => HumanMessage.isInstance(message);

export const isAssistantMessage = (message: BaseMessage): boolean => AIMessage.isInstance(message);

export const isToolResultMessage = (message: BaseMessage): boolean => ToolMessage.isInstance(message);
