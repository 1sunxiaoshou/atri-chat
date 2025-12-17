import { httpClient } from './base';
import { ApiResponse } from '../../types';

/**
 * VRM 相关 API
 */
export const vrmApi = {
  // ==================== VRM 模型 ====================
  
  /**
   * 获取所有 VRM 模型列表
   */
  getVRMModels: async (): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>('/vrm/models');
  },

  /**
   * 获取 VRM 模型详情
   * @param modelId - 模型 ID
   */
  getVRMModel: async (modelId: string): Promise<ApiResponse<any>> => {
    return httpClient.get<any>(`/vrm/models/${modelId}`);
  },

  /**
   * 上传 VRM 模型
   * @param formData - 包含模型文件的表单数据
   */
  uploadVRMModel: async (formData: FormData): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/vrm/models/upload', formData);
  },

  /**
   * 更新 VRM 模型
   * @param modelId - 模型 ID
   * @param data - 更新的数据
   */
  updateVRMModel: async (
    modelId: string,
    data: { name?: string; thumbnail_path?: string }
  ): Promise<ApiResponse<any>> => {
    return httpClient.put<any>(`/vrm/models/${modelId}`, data);
  },

  /**
   * 删除 VRM 模型
   * @param modelId - 模型 ID
   */
  deleteVRMModel: async (modelId: string): Promise<ApiResponse<any>> => {
    return httpClient.delete<any>(`/vrm/models/${modelId}`);
  },

  // ==================== VRM 动作 ====================
  
  /**
   * 获取所有动作列表
   */
  getVRMAnimations: async (): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>('/vrm/animations');
  },

  /**
   * 获取动作详情
   * @param animationId - 动作 ID
   */
  getVRMAnimation: async (animationId: string): Promise<ApiResponse<any>> => {
    return httpClient.get<any>(`/vrm/animations/${animationId}`);
  },

  /**
   * 上传 VRM 动作
   * @param formData - 包含动作文件的表单数据
   */
  uploadVRMAnimation: async (formData: FormData): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/vrm/animations/upload', formData);
  },

  /**
   * 更新动作信息
   * @param animationId - 动作 ID
   * @param data - 更新的数据
   */
  updateVRMAnimation: async (
    animationId: string,
    data: { description?: string; duration?: number }
  ): Promise<ApiResponse<any>> => {
    return httpClient.put<any>(`/vrm/animations/${animationId}`, data);
  },

  /**
   * 删除动作
   * @param animationId - 动作 ID
   */
  deleteVRMAnimation: async (animationId: string): Promise<ApiResponse<any>> => {
    return httpClient.delete<any>(`/vrm/animations/${animationId}`);
  },

  /**
   * 查询使用该动作的模型
   * @param animationId - 动作 ID
   */
  getVRMAnimationModels: async (animationId: string): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>(`/vrm/animations/${animationId}/models`);
  },

  // ==================== 模型-动作关联 ====================
  
  /**
   * 获取模型的所有动作
   * @param modelId - 模型 ID
   */
  getModelAnimations: async (modelId: string): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>(`/vrm/models/${modelId}/animations`);
  },

  /**
   * 为模型添加动作
   * @param modelId - 模型 ID
   * @param animationId - 动作 ID
   */
  addModelAnimation: async (
    modelId: string,
    animationId: string
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>(`/vrm/models/${modelId}/animations`, {
      animation_id: animationId
    });
  },

  /**
   * 上传动作并关联到模型
   * @param modelId - 模型 ID
   * @param formData - 包含动作文件的表单数据
   */
  uploadAndBindModelAnimation: async (
    modelId: string,
    formData: FormData
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>(`/vrm/models/${modelId}/animations/upload`, formData);
  },

  /**
   * 批量添加动作到模型
   * @param modelId - 模型 ID
   * @param animationIds - 动作 ID 列表
   */
  batchAddModelAnimations: async (
    modelId: string,
    animationIds: string[]
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>(`/vrm/models/${modelId}/animations/batch`, {
      animation_ids: animationIds
    });
  },

  /**
   * 移除模型的动作
   * @param modelId - 模型 ID
   * @param animationId - 动作 ID
   */
  removeModelAnimation: async (
    modelId: string,
    animationId: string
  ): Promise<ApiResponse<any>> => {
    return httpClient.delete<any>(`/vrm/models/${modelId}/animations/${animationId}`);
  },

  /**
   * 批量移除模型的动作
   * @param modelId - 模型 ID
   * @param animationIds - 动作 ID 列表
   */
  batchRemoveModelAnimations: async (
    modelId: string,
    animationIds: string[]
  ): Promise<ApiResponse<any>> => {
    return httpClient.request<any>(`/vrm/models/${modelId}/animations/batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animation_ids: animationIds })
    });
  }
};
