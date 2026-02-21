import { httpClient } from './base';
import { ApiResponse, VoiceAsset } from '../../types';

export interface TTSProvider {
    id: string;
    name: string;
    provider_type: string;
    level: 'user' | 'character';
    is_configured: boolean;
}

/**
 * 音色资产相关 API
 */
export const voiceAssetsApi = {
    /**
     * 获取所有音色资产
     */
    getVoiceAssets: async (): Promise<ApiResponse<VoiceAsset[]>> => {
        return httpClient.get<VoiceAsset[]>('/voice-assets');
    },

    /**
     * 获取 TTS 供应商列表
     */
    getProviders: async (): Promise<ApiResponse<TTSProvider[]>> => {
        return httpClient.get<TTSProvider[]>('/tts-providers');
    },

    /**
     * 创建音色资产
     * @param data - 音色资产数据
     */
    createVoiceAsset: async (data: {
        name: string;
        provider_id: string;
        voice_config: Record<string, any>;
    }): Promise<ApiResponse<VoiceAsset>> => {
        return httpClient.post<VoiceAsset>('/voice-assets', data);
    },

    /**
     * 更新音色资产
     * @param id - 音色资产 ID
     * @param data - 更新数据
     */
    updateVoiceAsset: async (
        id: string,
        data: Partial<VoiceAsset>
    ): Promise<ApiResponse<VoiceAsset>> => {
        return httpClient.patch<VoiceAsset>(`/voice-assets/${id}`, data);
    },

    /**
     * 删除音色资产
     * @param id - 音色资产 ID
     */
    deleteVoiceAsset: async (id: string): Promise<ApiResponse<void>> => {
        return httpClient.delete<void>(`/voice-assets/${id}`);
    },
};
