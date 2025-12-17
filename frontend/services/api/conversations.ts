import { httpClient } from './base';
import { Conversation, ApiResponse } from '../../types';

/**
 * Conversation 相关 API
 */
export const conversationsApi = {
  /**
   * 获取对话列表，可按角色 ID 筛选
   * @param characterId - 可选的角色 ID
   */
  getConversations: async (
    characterId?: number | string | null
  ): Promise<ApiResponse<Conversation[]>> => {
    const endpoint = characterId
      ? `/conversations?character_id=${characterId}`
      : '/conversations';
    
    return httpClient.get<Conversation[]>(endpoint);
  },

  /**
   * 创建新的对话
   * @param characterId - 角色 ID
   */
  createConversation: async (
    characterId: number | string
  ): Promise<ApiResponse<Conversation>> => {
    return httpClient.post<Conversation>('/conversations', {
      character_id: characterId
    });
  },

  /**
   * 删除对话
   * @param id - 对话 ID
   */
  deleteConversation: async (id: number | string): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(`/conversations/${id}`);
  }
};
