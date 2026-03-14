import { httpClient } from './base';
import { ApiResponse, Motion, CharacterMotionBindings } from '@/types';

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
 * 角色动作绑定相关 API（简化版本）
 */
export const motionBindingsApi = {
    /**
     * 获取角色的动作绑定（按分类分组）
     * @param characterId - 角色 ID
     */
    getCharacterBindings: async (
        characterId: string
    ): Promise<ApiResponse<CharacterMotionBindings>> => {
        return httpClient.get<CharacterMotionBindings>(
            `characters/${characterId}/motions`
        );
    },

    /**
     * 更新角色的所有动作绑定（替换式更新）
     * @param characterId - 角色 ID
     * @param bindings - 绑定列表
     */
    updateCharacterBindings: async (
        characterId: string,
        bindings: Array<{
            motion_id: string;
            category: 'initial' | 'idle' | 'thinking' | 'reply';
        }>
    ): Promise<ApiResponse<{
        deleted_count: number;
        created_count: number;
        total_bindings: number;
    }>> => {
        return httpClient.put(
            `characters/${characterId}/motions`,
            { bindings }
        );
    },

    /**
     * 删除角色的所有动作绑定
     * @param characterId - 角色 ID
     */
    deleteCharacterBindings: async (
        characterId: string
    ): Promise<ApiResponse<{ deleted_count: number }>> => {
        return httpClient.delete(`characters/${characterId}/motions`);
    },
};
