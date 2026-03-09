/**
 * 角色模块共享类型定义
 */

export interface LocalMotionBinding {
    motion_id: string;
    category: 'initial' | 'idle' | 'thinking' | 'reply';
}
