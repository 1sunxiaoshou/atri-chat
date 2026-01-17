/**
 * VRM 情感控制系统
 * 
 * 动画由后端数据库管理，前端动态加载
 */

export { EmoteController } from './emoteController';
export { ExpressionController } from './expressionController';
export { MotionController } from './motionController';
export { AutoBlink } from './autoBlink';
export { AutoLookAt } from './autoLookAt';
export { VRMExpressionPresetName } from '@pixiv/three-vrm';

// 导出类型定义
export type {
    AnimationInfo,
    MotionState,
    AnimationProgressCallback,
    ExpressionName,
    AnimationCacheConfig,
    EmoteControllerConfig
} from '../../types/vrm';
