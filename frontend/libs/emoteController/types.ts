/**
 * EmoteController 类型定义
 */

/**
 * 动画信息
 */
export interface AnimationInfo {
  name: string;
  url: string;
  duration: number;
}

/**
 * 动作状态
 */
export interface MotionState {
  name: string;
  time: number;
  duration: number;
  isPlaying: boolean;
}

/**
 * 动画预加载进度回调
 */
export type AnimationProgressCallback = (loaded: number, total: number) => void;

/**
 * 表情名称类型（支持预设和自定义）
 */
export type ExpressionName = string;

/**
 * 动画缓存配置
 */
export interface AnimationCacheConfig {
  maxSize: number; // 最大缓存数量
  enableAutoEvict: boolean; // 是否自动清理
}

/**
 * EmoteController 配置
 */
export interface EmoteControllerConfig {
  cache?: AnimationCacheConfig;
  transitionDuration?: number; // 表情过渡时间（秒）
}
