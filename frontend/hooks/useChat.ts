import { useState, useCallback } from 'react';
import { Message, Character, Model, ModelParameters } from '../types';
import { api } from '../services/api';

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');

  // 加载对话消息
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      const response = await api.getMessages(conversationId);
      if (response.code === 200) {
        setMessages(response.data);
        console.log(`加载了 ${response.data.length} 条消息`);
      } else {
        console.error('加载消息失败:', response.message);
      }
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (
    conversationId: number,
    content: string,
    character: Character,
    model: Model,
    modelParameters?: ModelParameters
  ) => {
    if (!content.trim()) return;

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      character_id: character.id
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setCurrentResponse('');
    setCurrentReasoning('');
    setCurrentStatus('');

    try {
      const response = await api.sendMessage(
        conversationId,
        content.trim(),
        character.id,
        model.id,
        model.provider_id,
        modelParameters,
        // onChunk callback
        (chunk: string) => {
          setCurrentResponse(chunk);
        },
        // onStatus callback
        (status: string) => {
          setCurrentStatus(status);
        },
        // onReasoning callback
        (reasoning: string) => {
          setCurrentReasoning(reasoning);
        }
      );

      if (response.code === 200) {
        // 添加助手消息
        const assistantMessage: Message = {
          id: Date.now() + 1,
          conversation_id: conversationId,
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date().toISOString(),
          character_id: character.id,
          reasoning: currentReasoning || undefined
        };

        setMessages(prev => [...prev, assistantMessage]);
        console.log('消息发送成功');
      } else {
        console.error('发送消息失败:', response.message);
        throw new Error(response.message || '发送消息失败');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    } finally {
      setIsTyping(false);
      setCurrentResponse('');
      setCurrentReasoning('');
      setCurrentStatus('');
    }
  }, [currentReasoning]);

  // 复制消息内容
  const copyMessage = useCallback(async (content: string, messageId: string | number) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log('消息已复制到剪贴板');
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      return false;
    }
  }, []);

  // 清空消息
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse('');
    setCurrentReasoning('');
    setCurrentStatus('');
  }, []);

  return {
    messages,
    isTyping,
    currentResponse,
    currentReasoning,
    currentStatus,
    loadMessages,
    sendMessage,
    copyMessage,
    clearMessages
  };
};