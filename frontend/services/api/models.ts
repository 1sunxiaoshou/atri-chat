import { httpClient } from './base';
import { Model, ApiResponse } from '../../types';
import { HTTP_STATUS } from '../../utils/constants';

/**
 * Model 相关 API
 */
export const modelsApi = {
  /**
   * 获取所有模型列表
   */
  getModels: async (): Promise<ApiResponse<Model[]>> => {
    return httpClient.get<Model[]>('/models');
  },

  /**
   * 创建新的模型
   * @param model - 模型数据
   */
  createModel: async (model: Model): Promise<ApiResponse<Model>> => {
    return httpClient.post<Model>('/models', model);
  },

  /**
   * 更新模型
   * @param providerId - 服务商 ID
   * @param modelId - 模型 ID
   * @param model - 模型数据
   */
  updateModel: async (
    providerId: string,
    modelId: string,
    model: Partial<Model>
  ): Promise<ApiResponse<Model>> => {
    return httpClient.put<Model>(`/models/${providerId}/${modelId}`, {
      model_type: model.model_type,
      capabilities: model.capabilities,
      enabled: model.enabled,
      context_window: model.context_window,
      max_output: model.max_output
    });
  },

  /**
   * 切换模型启用/禁用状态
   * @param modelId - 模型 ID
   * @param enabled - 是否启用
   * @param providerId - 服务商 ID
   */
  toggleModel: async (
    modelId: string,
    enabled: boolean,
    providerId: string
  ): Promise<ApiResponse<void>> => {
    // 先获取模型信息
    const modelData = await httpClient.get<any>(`/models/${providerId}/${modelId}`);

    if (modelData.code !== HTTP_STATUS.OK) {
      return modelData;
    }

    // 更新模型
    return httpClient.put<void>(`/models/${providerId}/${modelId}`, {
      model_type: modelData.data.model_type,
      capabilities: modelData.data.capabilities,
      enabled
    });
  },

  /**
   * 删除模型
   * @param providerId - 服务商 ID
   * @param modelId - 模型 ID
   */
  deleteModel: async (
    providerId: string,
    modelId: string
  ): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(`/models/${providerId}/${modelId}`);
  },

  /**
   * 同步供应商模型列表
   * @param providerId - 服务商 ID
   * @param updateExisting - 是否更新已存在的模型
   */
  syncProviderModels: async (
    providerId: string,
    updateExisting: boolean = false
  ): Promise<ApiResponse<{
    provider_id: string;
    total: number;
    added: number;
    updated: number;
    skipped: number;
    failed: number;
    errors?: string[];
  }>> => {
    return httpClient.post<{
      provider_id: string;
      total: number;
      added: number;
      updated: number;
      skipped: number;
      failed: number;
      errors?: string[];
    }>(`/providers/${providerId}/models/sync?update_existing=${updateExisting}`, {});
  }
};
