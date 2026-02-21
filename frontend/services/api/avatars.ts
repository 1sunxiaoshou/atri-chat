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
     * @param file - 形象文件
     * @param name - 形象名称
     */
    uploadAvatar: async (file: File, name: string): Promise<ApiResponse<Avatar>> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
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
