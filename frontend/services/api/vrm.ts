import { httpClient } from './base';
import { ApiResponse } from '../../types';

/**
 * VRM 相关 API（更新为新架构：Avatar + Motion）
 */
export const vrmApi = {
  // ==================== Avatar（3D形象） ====================

  /**
   * 获取所有 Avatar 列表
   */
  getVRMModels: async (): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>('/avatars');
  },

  /**
   * 获取 Avatar 详情
   * @param avatarId - Avatar ID
   */
  getVRMModel: async (avatarId: string): Promise<ApiResponse<any>> => {
    return httpClient.get<any>(`/avatars/${encodeURIComponent(avatarId)}`);
  },

  /**
   * 上传 Avatar
   * @param formData - 包含VRM文件和缩略图的表单数据
   */
  uploadVRMModel: async (formData: FormData): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/avatars/upload', formData);
  },

  /**
   * 更新 Avatar
   * @param avatarId - Avatar ID
   * @param data - 更新的数据
   */
  updateVRMModel: async (
    avatarId: string,
    data: { name?: string }
  ): Promise<ApiResponse<any>> => {
    return httpClient.put<any>(`/avatars/${avatarId}`, data);
  },

  /**
   * 删除 Avatar
   * @param avatarId - Avatar ID
   */
  deleteVRMModel: async (avatarId: string): Promise<ApiResponse<any>> => {
    return httpClient.delete<any>(`/avatars/${avatarId}`);
  },

  // ==================== Motion（动作） ====================

  /**
   * 获取所有动作列表
   */
  getVRMAnimations: async (): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>('/motions');
  },

  /**
   * 获取动作详情
   * @param motionId - 动作 ID
   */
  getVRMAnimation: async (motionId: string): Promise<ApiResponse<any>> => {
    return httpClient.get<any>(`/motions/${motionId}`);
  },

  /**
   * 上传动作
   * @param formData - 包含动作文件的表单数据
   */
  uploadVRMAnimation: async (formData: FormData): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/motions/upload', formData);
  },

  /**
   * 更新动作信息
   * @param motionId - 动作 ID
   * @param data - 更新的数据
   */
  updateVRMAnimation: async (
    motionId: string,
    data: { name?: string; description?: string; tags?: string[] }
  ): Promise<ApiResponse<any>> => {
    return httpClient.put<any>(`/motions/${motionId}`, data);
  },

  /**
   * 删除动作
   * @param motionId - 动作 ID
   */
  deleteVRMAnimation: async (motionId: string): Promise<ApiResponse<any>> => {
    return httpClient.delete<any>(`/motions/${motionId}`);
  },

  /**
   * 查询使用该动作的角色（通过绑定）
   * @param motionId - 动作 ID
   */
  getVRMAnimationModels: async (motionId: string): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any>(`/motions/${motionId}`).then(res => {
      // 从详情中提取 bound_characters
      return { ...res, data: (res.data as any)?.bound_characters || [] };
    });
  },

  // ==================== 角色-动作绑定 ====================

  /**
   * 获取角色的所有动作绑定
   * @param characterId - 角色 ID
   */
  getModelAnimations: async (characterId: string): Promise<ApiResponse<any>> => {
    return httpClient.get<any>(`/characters/${characterId}/motions`);
  },

  /**
   * 为角色添加动作绑定
   * @param characterId - 角色 ID
   * @param motionId - 动作 ID
   * @param category - 分类（idle/thinking/reply）
   */
  addModelAnimation: async (
    characterId: string,
    motionId: string,
    category: string = 'idle'
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/character-motion-bindings', {
      character_id: characterId,
      motion_id: motionId,
      category
    });
  },

  /**
   * 上传动作并绑定到角色（暂不支持，需要分两步）
   * @param characterId - 角色 ID
   * @param formData - 包含动作文件的表单数据
   */
  uploadAndBindModelAnimation: async (
    characterId: string,
    formData: FormData
  ): Promise<ApiResponse<any>> => {
    // 先上传动作
    const uploadRes = await httpClient.post<any>('/motions/upload', formData);
    if (uploadRes.code !== 200) {
      return uploadRes;
    }

    // 再创建绑定
    const motionId = uploadRes.data.id;
    const category = formData.get('category') as string || 'idle';

    return httpClient.post<any>('/character-motion-bindings', {
      character_id: characterId,
      motion_id: motionId,
      category
    });
  },

  /**
   * 批量添加动作到角色
   * @param characterId - 角色 ID
   * @param motionIds - 动作 ID 列表
   * @param category - 分类
   */
  batchAddModelAnimations: async (
    characterId: string,
    motionIds: string[],
    category: string = 'idle'
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/character-motion-bindings/batch', {
      character_id: characterId,
      motion_ids: motionIds,
      category
    });
  },

  /**
   * 移除角色的动作绑定
   * @param bindingId - 绑定 ID
   */
  removeModelAnimation: async (
    _characterId: string,
    bindingId: string
  ): Promise<ApiResponse<any>> => {
    return httpClient.delete<any>(`/character-motion-bindings/${bindingId}`);
  },

  /**
   * 批量移除角色的动作绑定
   * @param characterId - 角色 ID
   * @param motionIds - 动作 ID 列表
   * @param category - 分类（可选）
   */
  batchRemoveModelAnimations: async (
    characterId: string,
    motionIds: string[],
    category?: string
  ): Promise<ApiResponse<any>> => {
    const params = new URLSearchParams();
    if (category) {
      params.append('category', category);
    }

    return httpClient.request<any>(
      `/characters/${characterId}/motions/batch-delete?${params.toString()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(motionIds)
      }
    );
  }
};
