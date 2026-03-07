import { httpClient } from './base';
import { Provider, ApiResponse } from '../../types';

/**
 * Provider 相关 API
 */
export const providersApi = {
  /**
   * 获取所有服务商列表
   */
  getProviders: async (): Promise<ApiResponse<Provider[]>> => {
    return httpClient.get<Provider[]>('/providers');
  },

  /**
   * 创建新的服务商
   * @param provider - 服务商数据
   */
  createProvider: async (provider: Provider): Promise<ApiResponse<Provider>> => {
    return httpClient.post<Provider>('/providers', provider);
  },

  /**
   * 更新服务商配置
   * @param providerId - 服务商 ID
   * @param updates - 更新的字段
   */
  updateProvider: async (
    providerId: string,
    updates: { config_json?: any }
  ): Promise<ApiResponse<Provider>> => {
    return httpClient.put<Provider>(
      `/providers/update?provider_id=${providerId}`,
      updates
    );
  },

  /**
   * 删除服务商
   * @param providerId - 服务商 ID
   */
  deleteProvider: async (providerId: string): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(`/providers/delete?provider_id=${providerId}`);
  },

  /**
   * 获取所有供应商模板
   */
  getProviderTemplates: async (): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>('/providers/templates/list');
  }
};
