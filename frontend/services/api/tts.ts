import { httpClient, buildURL } from './base';
import { ApiResponse } from '../../types';

/**
 * TTS (文本转语音) 相关 API
 * 注意：TTS 供应商管理使用 voiceAssetsApi，这里是 TTS 服务 API
 */
export const ttsApi = {
  /**
   * TTS 流式合成（PCM raw 格式）
   * @param text - 要合成的文本
   * @param language - 可选的语言参数
   * @returns 包含音频流和参数的对象
   */
  synthesizeSpeechStream: async (
    text: string,
    language?: string
  ): Promise<{ stream: ReadableStream<Uint8Array>; sampleRate: number; channels: number }> => {
    // 使用统一的 URL 构建工具
    const response = await fetch(buildURL('/tts/synthesize?stream=true'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language })
    });

    // 统一的错误处理
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `TTS 失败: ${response.status}`);
      } catch {
        throw new Error(errorText || `TTS 失败: ${response.status}`);
      }
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    // 从响应头读取音频参数
    const sampleRate = parseInt(response.headers.get('X-Sample-Rate') || '32000');
    const channels = parseInt(response.headers.get('X-Channels') || '1');

    return {
      stream: response.body,
      sampleRate,
      channels
    };
  },

  // 保留旧的 API 方法以兼容现有代码，但重定向到新的 voiceAssetsApi
  /**
   * @deprecated 使用 voiceAssetsApi.getProviders() 替代
   */
  getTTSProviders: async (): Promise<ApiResponse<any>> => {
    return httpClient.get<any>('/tts-providers');
  },

  /**
   * @deprecated 使用 voiceAssetsApi 管理 TTS 供应商
   */
  testTTSConnection: async (
    providerId: string,
    config: any
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>(`/tts-providers/${providerId}/test`, {});
  },

  /**
   * @deprecated 使用 voiceAssetsApi 管理 TTS 供应商
   */
  saveTTSConfig: async (
    providerId: string,
    config: any
  ): Promise<ApiResponse<any>> => {
    return httpClient.put<any>(`/tts-providers/${providerId}`, {
      config_payload: config
    });
  }
};
