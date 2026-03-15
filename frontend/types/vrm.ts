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
  isCategory?: boolean; // 是否是动作分类（需要随机选择）
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
 * 支持动作分类标记：[Action:thinking] 会从该分类中随机选择动作
 */
export function parseMarkedText(markedText: string): { text: string; markups: TimedMarkup[] } {
  const markups: TimedMarkup[] = [];

  // 匹配 [State:xxx] 或 [Action:xxx] 格式
  const markupRegex = /\[(State|Action):([^\]]+)\]/gi;
  let match;

  // 动作分类列表（用于判断是否是分类标记）
  const actionCategories = ['idle', 'thinking', 'reply'];

  while ((match = markupRegex.exec(markedText)) !== null) {
    const type = match[1]!.toLowerCase() as 'state' | 'action';
    const value = match[2]!;

    // 判断是否是动作分类
    const isCategory = type === 'action' && actionCategories.includes(value.toLowerCase());

    markups.push({ type, value, isCategory });
  }

  // 去除所有标记，得到纯文本
  const text = markedText.replace(/\[[^\]]+:[^\]]+\]/g, '').trim();

  return { text, markups };
}

// ============================================
// 渲染配置相关类型 (Render Config)
// ============================================

/**
 * VRM 渲染配置接口
 */
export interface VRMRenderConfig {
  // 光照设置 (基于物理强度)
  mainLightIntensity: number;
  ambientLightIntensity: number;
  rimLightIntensity: number;


  // 阴影设置
  enableShadows: boolean;
  enableContactShadows: boolean;

  // 后处理特效
  enablePostProcessing: boolean;
  enableBloom: boolean;
  enableDepthOfField: boolean;
  enableVignette: boolean;

  // 强度调节
  bloomIntensity: number;

  // 背景控制 (自定义图片)
  backgroundImage: string;
  showEnvironmentBackground: boolean;

  // VRM 角色行为设置
  enableBlink: boolean;
  lookAtMode: 'mouse' | 'camera' | 'none';
}


/**
 * 默认 VRM 渲染配置
 */
export const DEFAULT_VRM_RENDER_CONFIG: VRMRenderConfig = {
  // 基础光照 (强度数值)
  mainLightIntensity: 4.0,
  ambientLightIntensity: 2.5,
  rimLightIntensity: 2.0,


  // 渲染/阴影
  enableShadows: false,
  enableContactShadows: true,
  enablePostProcessing: false,
  enableBloom: true,
  enableDepthOfField: false,
  enableVignette: true,
  bloomIntensity: 0.5,

  // 背景
  backgroundImage: 'BG_AronaRoom.jpg',
  showEnvironmentBackground: true,

  // 行为
  enableBlink: true,
  lookAtMode: 'mouse',
};

