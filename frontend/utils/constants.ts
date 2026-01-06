/**
 * 应用常量定义
 * 所有常量按功能分类组织，避免魔法数字和硬编码
 */

// ==================== API 相关 ====================

/**
 * 获取运行时的 API 基础 URL
 * 优先级：环境变量 > 自动检测 > 默认值
 */
const getApiBaseUrl = (): string => {
  // 1. 优先使用环境变量（开发时可配置）
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 2. 生产环境使用相对路径（前后端同域）
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  
  // 3. 开发环境默认值
  return 'http://localhost:8000';
};

/**
 * API 配置
 */
export const API_CONFIG = {
  BASE_URL: `${getApiBaseUrl()}/api/v1`,
  UPLOAD_URL: `${getApiBaseUrl()}/api/upload`,
  STATIC_URL: getApiBaseUrl(),
  TIMEOUT: 30000, // 30秒超时
} as const;

/**
 * 获取完整的资源 URL
 * @param path - 资源路径，如 /uploads/avatar.jpg
 */
export const buildResourceUrl = (path: string | undefined): string => {
  if (!path) return '';
  
  // 已经是完整 URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // 如果是 localhost URL，替换为当前配置的 base URL
    if (path.includes('localhost:8000') || path.includes('localhost:3000')) {
      // 提取路径部分（/uploads/xxx 或 /static/xxx）
      const urlObj = new URL(path);
      return `${API_CONFIG.STATIC_URL}${urlObj.pathname}`;
    }
    return path;
  }
  
  // 拼接基础 URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.STATIC_URL}${cleanPath}`;
};

/**
 * HTTP 状态码
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * API 端点路径
 */
export const API_ENDPOINTS = {
  PROVIDERS: '/providers',
  MODELS: '/models',
  CHARACTERS: '/characters',
  CONVERSATIONS: '/conversations',
  MESSAGES: '/messages',
  VRM: '/vrm',
  ASR: '/asr',
  TTS: '/tts',
} as const;

// ==================== 消息相关 ====================

/**
 * 消息 ID 配置
 * 用于临时消息的 ID 生成
 */
export const MESSAGE_ID_CONFIG = {
  TEMP_ID_OFFSET: 1, // 临时消息 ID 偏移量
  USE_TIMESTAMP: true, // 使用时间戳作为临时 ID
} as const;

/**
 * 消息类型
 */
export const MESSAGE_TYPES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

// ==================== 音频相关 ====================

/**
 * 音频配置
 */
export const AUDIO_CONFIG = {
  DEFAULT_VOLUME: 100,
  DEFAULT_CACHE_LIMIT: 50,
  MIN_CACHE_LIMIT: 10,
  MAX_CACHE_LIMIT: 200,
  SAMPLE_RATE: 32000,
  CHANNELS: 1,
  CACHE_MAX_AGE: 30 * 60 * 1000, // 30分钟缓存过期时间
  VOLUME_SCALE: 100, // 音量缩放比例（用于百分比转换）
} as const;

/**
 * 音频播放配置
 */
export const AUDIO_PLAYBACK = {
  TIMEOUT_BUFFER: 1000, // 播放超时缓冲时间（毫秒）
  FADE_DURATION: 0.5, // 淡入淡出时长（秒）
} as const;

// ==================== UI 相关 ====================

/**
 * UI 时间配置
 */
export const UI_TIMING = {
  ANIMATION_DURATION: 200, // 动画时长（毫秒）
  TOAST_DURATION: 3000, // Toast 显示时长（毫秒）
  DEBOUNCE_DELAY: 300, // 防抖延迟（毫秒）
  SUBTITLE_CLEAR_DELAY: 2000, // 字幕清除延迟（毫秒）
  ERROR_CLEAR_DELAY: 5000, // 错误提示清除延迟（毫秒）
} as const;

/**
 * UI 尺寸配置
 */
export const UI_SIZE = {
  MAX_COMPONENT_LINES: 300, // 组件最大行数
  MAX_HOOK_LINES: 150, // Hook 最大行数
  MAX_FILE_LINES: 500, // 文件最大行数
  MAX_JSX_NESTING: 5, // JSX 最大嵌套层级
} as const;

/**
 * 开发服务器配置
 */
export const DEV_SERVER = {
  PORT: 3000,
  HOST: '0.0.0.0',
  BACKEND_URL: 'http://localhost:8000',
} as const;

// ==================== 模型相关 ====================

/**
 * 模型参数默认值
 */
export const MODEL_DEFAULTS = {
  TEMPERATURE: 1.0,
  MAX_TOKENS: undefined,
  TOP_P: 1.0,
} as const;

// ==================== 国际化相关 ====================

/**
 * 支持的语言
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
] as const;

// ==================== 主题相关 ====================

/**
 * 主题选项
 */
export const THEME_OPTIONS = [
  { id: 'light', name: '亮色', icon: 'Sun' },
  { id: 'dark', name: '暗色', icon: 'Moon' },
  { id: 'system', name: '系统', icon: 'Monitor' },
] as const;

// ==================== 文件上传相关 ====================

/**
 * 文件大小常量（字节）
 */
export const FILE_SIZE = {
  ONE_KB: 1024,
  ONE_MB: 1024 * 1024,
  FIVE_MB: 5 * 1024 * 1024,
  TEN_MB: 10 * 1024 * 1024,
} as const;

/**
 * 文件上传限制
 */
export const UPLOAD_LIMITS = {
  AVATAR_MAX_SIZE: FILE_SIZE.FIVE_MB,
  AVATAR_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  AUDIO_MAX_SIZE: FILE_SIZE.TEN_MB,
  AUDIO_ALLOWED_TYPES: ['audio/wav', 'audio/mp3', 'audio/ogg'],
} as const;

// ==================== 时间相关 ====================

/**
 * 时间转换常量
 */
export const TIME_CONVERSION = {
  MS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
} as const;

// ==================== 消息提示 ====================

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  AUTH_ERROR: '认证失败，请重新登录',
  PERMISSION_ERROR: '权限不足，无法执行此操作',
  FILE_TOO_LARGE: '文件过大，请选择较小的文件',
  INVALID_FILE_TYPE: '不支持的文件类型',
  MICROPHONE_ERROR: '无法访问麦克风，请检查权限设置',
  TTS_ERROR: 'TTS服务不可用',
  ASR_ERROR: '语音识别服务不可用',
} as const;

/**
 * 成功消息
 */
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  COPY_SUCCESS: '已复制到剪贴板',
  UPLOAD_SUCCESS: '上传成功',
  CONFIG_SUCCESS: '配置已保存',
} as const;

// ==================== 本地存储键名 ====================

/**
 * LocalStorage 键名
 */
export const STORAGE_KEYS = {
  AUDIO_VOLUME: 'audioVolume',
  AUDIO_CACHE_LIMIT: 'audioCacheLimit',
  THEME: 'theme',
  LANGUAGE: 'language',
} as const;