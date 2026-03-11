import { httpClient } from './base';
import { ApiResponse } from '../../types';

export interface ASRStatus {
  exists: boolean;
  int8_ready: boolean;
  fp32_ready: boolean;
  total_size_mb: number;
  int8_size_mb: number;
  fp32_size_mb: number;
  is_downloading: boolean;
  progress: number;
  download_error: string | null;
  download_precision: string | null;
}

/**
 * ASR (语音转文本) 相关 API
 * 后端使用 SenseVoice-Small ONNX 本地模型
 */
export const asrApi = {
  /**
   * 语音转文本
   * @param file - 音频文件
   * @param language - 语言代码 (zh, en, ja, ko, yue, auto)
   * @param useInt8 - 是否使用 INT8 量化模型
   */
  transcribeAudio: async (
    file: Blob,
    language?: string,
    useInt8?: boolean
  ): Promise<ApiResponse<{ text: string; language: string; precision: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language);
    }
    if (useInt8 !== undefined) {
      formData.append('use_int8', useInt8.toString());
    }

    return httpClient.post<{ text: string; language: string; precision: string }>('/asr/transcribe', formData);
  },

  /**
   * 获取 ASR 状态
   */
  getStatus: async (): Promise<ApiResponse<ASRStatus>> => {
    return httpClient.get('/asr/mgmt/status');
  },

  /**
   * 下载模型
   */
  downloadModel: async (precision: 'int8' | 'fp32' | 'both'): Promise<ApiResponse<{ precision: string }>> => {
    return httpClient.post('/asr/mgmt/download', { precision });
  },

  /**
   * 清理资源
   */
  clearAssets: async (precision?: 'int8' | 'fp32' | 'all'): Promise<ApiResponse<{ success: boolean }>> => {
    return httpClient.delete(`/asr/mgmt/clear${precision ? `?precision=${precision}` : ''}`);
  }
};

