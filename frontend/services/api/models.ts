import { httpClient } from './base';
import { Model, ApiResponse } from '../../types';
import { HTTP_STATUS } from '../../utils/constants';

/**
 * Model 相关 API
 */
export const modelsApi = {
  /**
   * 获取所有模型列表
   * @param enabledOnly - 是否仅获取已启用的模型
   */
  getModels: async (enabledOnly: boolean = false): Promise<ApiResponse<Model[]>> => {
    const params = enabledOnly ? '?enabled_only=true' : '';
    return httpClient.get<Model[]>(`/models${params}`);
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
    id: number,
    model: Partial<Model>
  ): Promise<ApiResponse<Model>> => {
    return httpClient.put<Model>(
      `/models/${id}`,
      {
        model_type: model.model_type,
        capabilities: model.capabilities,
        enabled: model.enabled,
        context_window: model.context_window,
        max_output: model.max_output
      }
    );
  },

  /**
   * 切换模型启用/禁用状态
   * @param modelId - 模型 ID
   * @param enabled - 是否启用
   * @param providerConfigId - 服务商配置 ID
   * @param baseModel - 可选的模型基础数据，用于避免额外的服务器请求
   */
  toggleModel: async (
    id: number,
    enabled: boolean,
    baseModel?: Partial<Model>
  ): Promise<ApiResponse<void>> => {
    let payload: any;

    if (baseModel && baseModel.model_type) {
      // 如果提供了基础数据，直接使用
      payload = {
        model_type: baseModel.model_type,
        capabilities: baseModel.capabilities || [],
        context_window: baseModel.context_window,
        max_output: baseModel.max_output,
        enabled
      };
    } else {
      // 否则先获取模型详情（兼容性回退）
      const modelData = await httpClient.get<any>(
        `/models/${id}`
      );

      if (modelData.code !== HTTP_STATUS.OK) {
        return modelData;
      }

      payload = {
        model_type: modelData.data.model_type,
        capabilities: modelData.data.capabilities,
        context_window: modelData.data.context_window,
        max_output: modelData.data.max_output,
        enabled
      };
    }

    // 更新模型
    return httpClient.put<void>(
      `/models/${id}`,
      payload
    );
  },

  /**
   * 删除模型
   * @param providerId - 服务商 ID
   * @param modelId - 模型 ID
   */
  deleteModel: async (
    id: number
  ): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(`/models/${id}`);
  },

  /**
   * 同步供应商模型列表
   * @param providerId - 服务商 ID
   * @param updateExisting - 是否更新已存在的模型
   */
  syncProviderModels: async (
    providerConfigId: number,
    updateExisting: boolean = false
  ): Promise<ApiResponse<{
    provider_config_id: number;
    total: number;
    added: number;
    updated: number;
    skipped: number;
    failed: number;
    errors?: string[];
  }>> => {
    return httpClient.post<{
      provider_config_id: number;
      total: number;
      added: number;
      updated: number;
      skipped: number;
      failed: number;
      errors?: string[];
    }>(
      `/providers/${providerConfigId}/sync?update_existing=${updateExisting}`,
      {}
    );
  }
};
