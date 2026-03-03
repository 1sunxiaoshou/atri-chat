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
 * 动作分类
 * - initial: 初始动作，AI加载时的默认姿态，循环播放
 * - idle: 闲置动作，长时间未交互时触发，播放完成后回到初始
 * - thinking: 思考动作，用户发送消息后触发，直到获得后端响应
 * - reply: 回复动作，由AI控制，对应标记解析播放
 */
export type MotionCategory = 'initial' | 'idle' | 'thinking' | 'reply';

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
    category: MotionCategory;
    created_at: string;
}

/**
 * 按分类分组的动作绑定
 */
export interface CharacterMotionBindings {
    character_id: string;
    character_name: string;
    bindings_by_category: {
        initial?: CharacterMotionBinding[];
        idle?: CharacterMotionBinding[];
        thinking?: CharacterMotionBinding[];
        reply?: CharacterMotionBinding[];
    };
    total_bindings: number;
}
