import { httpClient, buildUploadURL } from './base';
import { Character, ApiResponse } from '../../types';

/**
 * Character 相关 API
 */
export const charactersApi = {
  /**
   * 获取所有角色列表
   */
  getCharacters: async (): Promise<ApiResponse<Character[]>> => {
    return httpClient.get<Character[]>('/characters');
  },

  /**
   * 创建新的角色
   * @param characterData - 角色数据（不包含 character_id）
   */
  createCharacter: async (
    characterData: Omit<Character, 'character_id'>
  ): Promise<ApiResponse<Character>> => {
    return httpClient.post<Character>('/characters', characterData);
  },

  /**
   * 更新角色信息
   * @param id - 角色 ID
   * @param updates - 更新的字段
   */
  updateCharacter: async (
    id: string | number,
    updates: Partial<Character>
  ): Promise<ApiResponse<Character>> => {
    return httpClient.patch<Character>(`/characters/${id}`, updates);
  },

  /**
   * 删除角色
   * @param id - 角色 ID
   */
  deleteCharacter: async (id: string | number): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(`/characters/${id}`);
  },

  /**
   * 上传角色头像
   * @param file - 头像文件
   */
  uploadAvatar: async (
    file: File
  ): Promise<ApiResponse<{ url: string; filename: string }>> => {
    const formData = new FormData();
    formData.append('file', file);

    // 使用统一的 URL 构建工具
    const uploadUrl = buildUploadURL('avatar');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        return {
          code: response.status,
          message: errorJson.message || '上传失败',
          data: errorJson.data || {} as { url: string; filename: string }
        };
      } catch {
        return {
          code: response.status,
          message: errorText || '上传失败',
          data: {} as { url: string; filename: string }
        };
      }
    }

    return response.json();
  }
};
