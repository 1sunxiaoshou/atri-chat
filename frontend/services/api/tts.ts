import { httpClient, buildURL } from './base';
import { ApiResponse } from '../../types';

/**
 * TTS (文本转语音) 相关 API
 */
export const ttsApi = {
  /**
   * 获取 TTS 配置列表与状态
   */
  getTTSProviders: async (): Promise<ApiResponse<any>> => {
    return httpClient.get<any>('/tts/providers');
  },

  /**
   * 测试 TTS 连接
   * @param providerId - 服务商 ID
   * @param config - 配置信息
   */
  testTTSConnection: async (
    providerId: string,
    config: any
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/tts/test', {
      provider_id: providerId,
      config
    });
  },

  /**
   * 保存 TTS 配置
   * @param providerId - 服务商 ID
   * @param config - 配置信息
   */
  saveTTSConfig: async (
    providerId: string,
    config: any
  ): Promise<ApiResponse<any>> => {
    return httpClient.post<any>('/tts/config', {
      provider_id: providerId,
      config
    });
  },

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
  }
};
