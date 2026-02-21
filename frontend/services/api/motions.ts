import { httpClient } from './base';
import { ApiResponse, Motion, MotionBinding } from '../../types';

/**
 * 动作资产相关 API
 */
export const motionsApi = {
    /**
     * 获取所有动作资产
     */
    getMotions: async (): Promise<ApiResponse<Motion[]>> => {
        return httpClient.get<Motion[]>('/motions');
    },

    /**
     * 上传动作资产
     * @param file - 动作文件 (VRMA)
     * @param name - 动作名称
     * @param duration_ms - 动作时长（毫秒）
     */
    uploadMotion: async (
        file: File,
        name: string,
        duration_ms: number
    ): Promise<ApiResponse<Motion>> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('duration_ms', duration_ms.toString());
        return httpClient.post<Motion>('/motions/upload', formData);
    },

    /**
     * 删除动作资产
     * @param id - 动作 ID
     */
    deleteMotion: async (id: string): Promise<ApiResponse<void>> => {
        return httpClient.delete<void>(`/motions/${id}`);
    },
};

/**
 * 角色动作绑定相关 API
 */
export const motionBindingsApi = {
    /**
     * 获取角色的动作绑定
     * @param characterId - 角色 ID
     */
    getCharacterBindings: async (
        characterId: string
    ): Promise<ApiResponse<MotionBinding[]>> => {
        return httpClient.get<MotionBinding[]>(
            `/character-motion-bindings?character_id=${characterId}`
        );
    },

    /**
     * 创建动作绑定
     * @param data - 绑定数据
     */
    createBinding: async (data: {
        character_id: string;
        motion_id: string;
        category: 'idle' | 'thinking' | 'reply';
        weight: number;
    }): Promise<ApiResponse<MotionBinding>> => {
        return httpClient.post<MotionBinding>('/character-motion-bindings', data);
    },

    /**
     * 更新动作绑定
     * @param id - 绑定 ID
     * @param data - 更新数据
     */
    updateBinding: async (
        id: string,
        data: Partial<MotionBinding>
    ): Promise<ApiResponse<MotionBinding>> => {
        return httpClient.patch<MotionBinding>(
            `/character-motion-bindings/${id}`,
            data
        );
    },

    /**
     * 删除动作绑定
     * @param id - 绑定 ID
     */
    deleteBinding: async (id: string): Promise<ApiResponse<void>> => {
        return httpClient.delete<void>(`/character-motion-bindings/${id}`);
    },
};
