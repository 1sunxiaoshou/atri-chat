import { httpClient } from './base';
import { ApiResponse, ASRConfigResponse } from '../../types';

/**
 * ASR (语音转文本) 相关 API
 */
export const asrApi = {
  /**
   * 获取 ASR 配置列表与状态
   */
  getASRProviders: async (): Promise<ApiResponse<ASRConfigResponse>> => {
    return httpClient.get<ASRConfigResponse>('/asr/providers');
  },

  /**
   * 测试 ASR 连接
   * @param providerId - 服务商 ID
   * @param config - 配置信息
   */
  testASRConnection: async (
    providerId: string,
    config: any
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/asr/test', {
      provider_id: providerId,
      config
    });
  },

  /**
   * 保存 ASR 配置
   * @param providerId - 服务商 ID
   * @param config - 配置信息
   */
  saveASRConfig: async (
    providerId: string,
    config: any
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/asr/config', {
      provider_id: providerId,
      config
    });
  },

  /**
   * 语音转文本
   * @param file - 音频文件
   * @param language - 可选的语言参数
   */
  transcribeAudio: async (
    file: Blob,
    language?: string
  ): Promise<ApiResponse<{ text: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language);
    }

    return httpClient.post<{ text: string }>('/asr/transcribe', formData);
  }
};
