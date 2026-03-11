import { httpClient } from './base';
import { ApiResponse, Avatar } from '../../types';

/**
 * Avatar 资产相关 API
 */
export const avatarsApi = {
    /**
     * 获取所有形象资产
     */
    getAvatars: async (): Promise<ApiResponse<Avatar[]>> => {
        return httpClient.get<Avatar[]>('/avatars');
    },

    /**
     * 获取单个形象资产
     * @param id - 形象 ID
     */
    getAvatar: async (id: string): Promise<ApiResponse<Avatar>> => {
        return httpClient.get<Avatar>(`/avatars/${id}`);
    },

    /**
     * 上传形象资产
     * @param formData - 包含 file (VRM), name, thumbnail, expressions 的 FormData
     */
    uploadAvatar: async (formData: FormData): Promise<ApiResponse<Avatar>> => {
        return httpClient.post<Avatar>('/avatars/upload', formData);
    },

    /**
     * 删除形象资产
     * @param id - 形象 ID
     */
    deleteAvatar: async (id: string): Promise<ApiResponse<void>> => {
        return httpClient.delete<void>(`/avatars/${id}`);
    },
};
