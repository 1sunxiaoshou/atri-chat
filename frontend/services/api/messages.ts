import { httpClient } from './base';
import { coerceMessageLikeToMessage, type BaseMessage, type BaseMessageLike } from '@langchain/core/messages';
import { ApiResponse, AudioMessageData } from '../../types';
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
  ): Promise<ApiResponse<BaseMessage[]>> => {
    const response = await httpClient.get<any>(`/conversations/${conversationId}/messages`);
    Logger.debug('getMessages 原始响应', { conversationId, response });

    if (response.code === HTTP_STATUS.OK && Array.isArray(response.data)) {
      const messages = response.data.map((msg: unknown) => coerceMessageLikeToMessage(msg as BaseMessageLike));

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
