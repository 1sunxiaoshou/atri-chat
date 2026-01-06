import { useState, useCallback } from 'react';
import { Message, Character, Model, ModelParameters } from '../types';
import { api } from '../services/api/index';
import { MESSAGE_ID_CONFIG, HTTP_STATUS } from '../utils/constants';
import { Logger } from '../utils/logger';

/**
 * Chat Hook - 封装聊天消息加载和发送逻辑
 */
export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renderTrigger, setRenderTrigger] = useState(0);

  /**
   * 加载对话消息
   */
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setError(null);
      const response = await api.getMessages(conversationId);
      if (response.code === HTTP_STATUS.OK) {
        // 确保 response.data 是数组
        const messagesData = Array.isArray(response.data) ? response.data : [];
        setMessages(messagesData);
        Logger.info(`加载了 ${messagesData.length} 条消息`);
      } else {
        const errorMsg = response.message || '加载消息失败';
        Logger.error('加载消息失败', undefined, { errorMsg });
        setError(errorMsg);
        setMessages([]); // 确保设置为空数组
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载消息失败';
      Logger.error('加载消息失败', err instanceof Error ? err : undefined);
      setError(errorMsg);
      setMessages([]); // 确保设置为空数组
    }
  }, []);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(async (
    conversationId: number,
    content: string,
    character: Character,
    model: Model,
    modelParameters?: ModelParameters,
    onVrmData?: (data: any) => void
  ) => {
    if (!content.trim()) {return;}

    // 重置错误状态
    setError(null);

    // 添加用户消息
    const userMessage: Message = {
      message_id: Date.now(),
      conversation_id: conversationId,
      message_type: 'user',
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setCurrentResponse('');
    setCurrentReasoning('');
    setCurrentStatus('');

    // 用于存储流式响应中的推理内容
    let streamReasoning = '';

    try {
      const response = await api.sendMessage(
        {
          conversationId,
          content: content.trim(),
          characterId: character.character_id,
          modelId: model.model_id,
          providerId: model.provider_id,
          modelParameters
        },
        {
          onChunk: (chunk: string) => {
            setCurrentResponse(chunk);
            setRenderTrigger(prev => prev + 1);
          },
          onStatus: (status: string) => {
            setCurrentStatus(status);
            setRenderTrigger(prev => prev + 1);
          },
          onReasoning: (reasoning: string) => {
            streamReasoning = reasoning;
            setCurrentReasoning(reasoning);
            setRenderTrigger(prev => prev + 1);
          },
          onVrmData: (data: any) => {
            if (onVrmData) {
              onVrmData(data);
            }
          }
        }
      );

      if (response.code === HTTP_STATUS.OK) {
        // 添加助手消息
        const assistantMessage: Message = {
          message_id: Date.now() + MESSAGE_ID_CONFIG.TEMP_ID_OFFSET,
          conversation_id: conversationId,
          message_type: 'assistant',
          content: response.data.message || currentResponse,
          created_at: new Date().toISOString(),
          reasoning: streamReasoning || undefined
        };

        setMessages(prev => [...prev, assistantMessage]);
        Logger.info('消息发送成功');
      } else {
        const errorMsg = response.message || '发送消息失败';
        Logger.error('发送消息失败', undefined, { errorMsg });
        setError(errorMsg);
        
        // 添加错误消息
        const errorMessage: Message = {
          message_id: Date.now() + MESSAGE_ID_CONFIG.TEMP_ID_OFFSET,
          conversation_id: conversationId,
          message_type: 'assistant',
          content: `❌ **错误**: ${errorMsg}`,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '发送消息失败';
      Logger.error('发送消息失败', err instanceof Error ? err : undefined);
      setError(errorMsg);
      
      // 添加错误消息
      const errorMessage: Message = {
        message_id: Date.now() + MESSAGE_ID_CONFIG.TEMP_ID_OFFSET,
        conversation_id: conversationId,
        message_type: 'assistant',
        content: `❌ **错误**: ${errorMsg}`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setCurrentResponse('');
      setCurrentReasoning('');
      setCurrentStatus('');
    }
  }, [currentResponse]);

  /**
   * 复制消息内容
   * 需求 6.4: 移除未使用的 messageId 参数
   */
  const copyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      Logger.debug('消息已复制到剪贴板');
      return true;
    } catch (err) {
      Logger.error('复制失败', err instanceof Error ? err : undefined);
      return false;
    }
  }, []);

  /**
   * 清空消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse('');
    setCurrentReasoning('');
    setCurrentStatus('');
    setError(null);
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isTyping,
    currentResponse,
    currentReasoning,
    currentStatus,
    error,
    renderTrigger,
    loadMessages,
    sendMessage,
    copyMessage,
    clearMessages,
    clearError
  };
};