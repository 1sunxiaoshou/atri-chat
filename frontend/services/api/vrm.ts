import { httpClient } from './base';
import { ApiResponse } from '../../types';
import { avatarsApi } from './avatars';
import { motionsApi, motionBindingsApi } from './motions';

/**
 * VRM 相关 API（适配器层 - 已废弃）
 * 
 * @deprecated 此文件已废弃，请使用新的模块化 API：
 * - Avatar 管理：使用 `avatarsApi` 替代 getVRMModels/uploadVRMModel/deleteVRMModel
 * - 动作管理：使用 `motionsApi` 替代 getVRMAnimations/uploadVRMAnimation/deleteVRMAnimation
 * - 绑定管理：使用 `motionBindingsApi` 替代 addModelAnimation/removeModelAnimation
 * 
 * 此适配器层仅用于向后兼容，将在未来版本中移除。
 */
export const vrmApi = {
  // ==================== Avatar（3D形象） ====================

  /**
   * 获取所有 Avatar 列表
   * @deprecated 使用 avatarsApi.getAvatars() 替代
   */
  getVRMModels: avatarsApi.getAvatars,

  /**
   * 获取 Avatar 详情
   * @param avatarId - Avatar ID
   * @deprecated 使用 avatarsApi.getAvatar() 替代
   */
  getVRMModel: avatarsApi.getAvatar,

  /**
   * 上传 Avatar
   * @param formData - 包含VRM文件和缩略图的表单数据
   * @deprecated 使用 avatarsApi.uploadAvatar() 替代
   */
  uploadVRMModel: avatarsApi.uploadAvatar,

  /**
   * 更新 Avatar
   * @param avatarId - Avatar ID
   * @param data - 更新的数据
   * @deprecated 使用 avatarsApi.updateAvatar() 替代
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
   * @deprecated 使用 avatarsApi.deleteAvatar() 替代
   */
  deleteVRMModel: avatarsApi.deleteAvatar,

  // ==================== Motion（动作） ====================

  /**
   * 获取所有动作列表
   * @deprecated 使用 motionsApi.getMotions() 替代
   */
  getVRMAnimations: motionsApi.getMotions,

  /**
   * 获取动作详情
   * @param motionId - 动作 ID
   * @deprecated 直接使用 motionsApi.getMotions() 并过滤结果
   */
  getVRMAnimation: async (motionId: string): Promise<ApiResponse<any>> => {
    return httpClient.get<any>(`/motions/${motionId}`);
  },

  /**
   * 上传动作
   * @param formData - 包含动作文件的表单数据
   * @deprecated 使用 motionsApi.uploadMotion() 替代
   */
  uploadVRMAnimation: async (formData: FormData): Promise<ApiResponse<any>> => {
    const name = formData.get('name') as string;
    const duration_raw = formData.get('duration_ms') as string;
    const duration_ms = duration_raw ? parseInt(duration_raw) : undefined;
    const file = formData.get('file') as File;
    return motionsApi.uploadMotion(file, name, isNaN(duration_ms as number) ? undefined : duration_ms);
  },

  /**
   * 更新动作信息
   * @param motionId - 动作 ID
   * @param data - 更新的数据
   * @deprecated 后端暂不支持更新动作，需要重新上传
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
   * @deprecated 使用 motionsApi.deleteMotion() 替代
   */
  deleteVRMAnimation: motionsApi.deleteMotion,

  /**
   * 查询使用该动作的角色（通过绑定）
   * @param motionId - 动作 ID
   * @deprecated 后端已移除此功能，请使用 motionBindingsApi 查询
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
   * @deprecated 使用 motionBindingsApi.getCharacterBindings() 替代
   */
  getModelAnimations: motionBindingsApi.getCharacterBindings
};
