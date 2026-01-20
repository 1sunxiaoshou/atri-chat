import { httpClient, buildUploadURL } from './base';
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
    updates: { config_json?: any; logo?: string }
  ): Promise<ApiResponse<Provider>> => {
    return httpClient.put<Provider>(`/providers/${providerId}`, updates);
  },

  /**
   * 删除服务商
   * @param providerId - 服务商 ID
   */
  deleteProvider: async (providerId: string): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(`/providers/${providerId}`);
  },

  /**
   * 获取所有供应商模板
   */
  getProviderTemplates: async (): Promise<ApiResponse<any[]>> => {
    return httpClient.get<any[]>('/providers/templates/list');
  },

  /**
   * 上传供应商 Logo
   * @param file - Logo 文件
   * @param providerId - 可选的服务商 ID
   */
  uploadProviderLogo: async (
    file: File,
    providerId?: string
  ): Promise<ApiResponse<{ url: string; filename: string; provider_id?: string }>> => {
    const formData = new FormData();
    formData.append('file', file);

    // 使用统一的 URL 构建工具
    const baseUploadUrl = buildUploadURL('provider-logo');
    const url = providerId ? `${baseUploadUrl}?provider_id=${providerId}` : baseUploadUrl;

    const response = await fetch(url, {
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
          data: errorJson.data || {} as { url: string; filename: string; provider_id?: string }
        };
      } catch {
        return {
          code: response.status,
          message: errorText || '上传失败',
          data: {} as { url: string; filename: string; provider_id?: string }
        };
      }
    }

    return response.json();
  }
};
