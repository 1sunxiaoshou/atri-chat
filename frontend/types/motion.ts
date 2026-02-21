/**
 * 动作相关类型定义
 */

/**
 * 动作资产
 */
export interface Motion {
    id: string;
    name: string;
    file_url: string;
    animation_path: string;
    duration_ms: number;
    description?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
}

/**
 * 角色-动作绑定
 */
export interface CharacterMotionBinding {
    id: string;
    character_id: string;
    character_name: string;
    motion_id: string;
    motion_name: string;
    motion_file_url: string;
    motion_duration_ms: number;
    category: 'idle' | 'thinking' | 'reply';
    weight: number;
    created_at: string;
}

/**
 * 按分类分组的动作绑定
 */
export interface CharacterMotionBindings {
    character_id: string;
    character_name: string;
    bindings_by_category: {
        idle?: CharacterMotionBinding[];
        thinking?: CharacterMotionBinding[];
        reply?: CharacterMotionBinding[];
    };
    total_bindings: number;
}
