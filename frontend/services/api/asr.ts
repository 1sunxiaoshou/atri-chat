import { httpClient } from './base';
import { ApiResponse } from '../../types';

/**
 * ASR (语音转文本) 相关 API
 * 后端使用固定的 SenseVoice-Small ONNX 本地模型
 */
export const asrApi = {
  /**
   * 语音转文本
   * @param file - 音频文件
   * @param language - 可选的语言参数 (zh, en, ja, ko, yue, auto)
   */
  transcribeAudio: async (
    file: Blob,
    language?: string
  ): Promise<ApiResponse<{ text: string; language: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language);
    }

    return httpClient.post<{ text: string; language: string }>('/asr/transcribe', formData);
  }
};

