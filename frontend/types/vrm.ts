/**
 * VRM 模块共享类型定义
 * 包含情感控制和业务层的所有类型
 */

// ============================================
// 情感控制相关类型 (EmoteController)
// ============================================

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

// ============================================
// 业务层相关类型 (VRM Service)
// ============================================

/**
 * 音频片段（后端返回的原始格式）
 */
export interface AudioSegment {
  sentence_index: number;
  marked_text: string;
  audio_url: string | null;  // 可能为 null（仅包含标记时）
}

/**
 * 解析后的音频片段（内部使用）
 */
export interface ParsedAudioSegment {
  sentence_index: number;
  text: string;           // 纯文本（去除标记后）
  marked_text: string;    // 原始带标记文本
  audio_url: string | null; // 音频 URL（可能为 null）
  markups: TimedMarkup[]; // 解析出的标记
}

/**
 * 时间标记
 */
export interface TimedMarkup {
  type: 'state' | 'action';
  value: string;
}

/**
 * VRM 回调函数
 */
export interface VRMCallbacks {
  onSubtitleChange?: (text: string) => void;
  onError?: (error: string) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

// ============================================
// 工具函数
// ============================================

/**
 * 解析带标记的文本
 * 从 "[State:happy][Action:wave] 你好！" 中提取标记和纯文本
 */
export function parseMarkedText(markedText: string): { text: string; markups: TimedMarkup[] } {
  const markups: TimedMarkup[] = [];
  
  // 匹配 [State:xxx] 或 [Action:xxx] 格式
  const markupRegex = /\[(State|Action):([^\]]+)\]/gi;
  let match;
  
  while ((match = markupRegex.exec(markedText)) !== null) {
    const type = match[1]!.toLowerCase() as 'state' | 'action';
    const value = match[2]!;
    markups.push({ type, value });
  }
  
  // 去除所有标记，得到纯文本
  const text = markedText.replace(/\[[^\]]+:[^\]]+\]/g, '').trim();
  
  return { text, markups };
}
