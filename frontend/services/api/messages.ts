import { httpClient } from './base';
import { Message, ApiResponse, AudioMessageData } from '../../types';
import { HTTP_STATUS } from '../../utils/constants';
import { Logger } from '../../utils/logger';

/**
 * Message 相关 API
 */
export const messagesApi = {
  /**
   * 获取对话的消息列表
   * @param conversationId - 对话 ID
   */
  getMessages: async (
    conversationId: number | string
  ): Promise<ApiResponse<Message[]>> => {
    const response = await httpClient.get<any>(`/conversations/${conversationId}/messages`);
    Logger.debug('getMessages 原始响应', { conversationId, response });

    // 后端返回格式: { code, message, data: { conversation_id, messages } }
    // 需要提取 data.messages 并映射字段
    if (response.code === HTTP_STATUS.OK && response.data && response.data.messages) {
      // 将后端的 id 字段映射为前端的 message_id
      const messages = response.data.messages.map((msg: any) => ({
        message_id: msg.lc_message_id || msg.id,
        conversation_id: msg.conversation_id,
        turn_id: msg.turn_id,
        lc_message_id: msg.lc_message_id,
        message_type: msg.message_type,
        content: msg.content,
        tool_call_id: msg.tool_call_id,
        tool_name: msg.tool_name,
        created_at: msg.created_at,
        generating: msg.generating
      }));

      return {
        code: response.code,
        message: response.message,
        data: messages
      };
    }

    // 如果格式不对，返回空数组
    Logger.warn('getMessages 响应格式异常', { response });
    return {
      code: response.code || HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: response.message || '获取消息失败',
      data: []
    };
  },

  /**
   * 发送音频消息
   * @param conversationId - 对话 ID
   * @param audioBlob - 音频数据
   */
  sendAudioMessage: async (
    conversationId: number | string,
    audioBlob: Blob
  ): Promise<ApiResponse<AudioMessageData>> => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('conversation_id', String(conversationId));

    return httpClient.post<AudioMessageData>('/tts/audio-message', formData);
  }
};
