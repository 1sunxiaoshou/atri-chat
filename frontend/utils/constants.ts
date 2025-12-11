/**
 * 应用常量定义
 */

// API 相关
export const API_CONFIG = {
  BASE_URL: import.meta.env.PROD ? '/api/v1' : 'http://localhost:8000/api/v1',
  UPLOAD_URL: import.meta.env.PROD ? '/api/upload' : 'http://localhost:8000/api/upload',
  TIMEOUT: 30000, // 30秒超时
} as const;

// 音频相关
export const AUDIO_CONFIG = {
  DEFAULT_VOLUME: 100,
  DEFAULT_CACHE_LIMIT: 50,
  MIN_CACHE_LIMIT: 10,
  MAX_CACHE_LIMIT: 200,
  SAMPLE_RATE: 32000,
  CHANNELS: 1,
} as const;

// UI 相关
export const UI_CONFIG = {
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 300,
} as const;

// 模型参数默认值
export const MODEL_DEFAULTS = {
  TEMPERATURE: 1.0,
  MAX_TOKENS: undefined,
  TOP_P: 1.0,
} as const;

// 支持的语言
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
] as const;

// 主题选项
export const THEME_OPTIONS = [
  { id: 'light', name: '亮色', icon: 'Sun' },
  { id: 'dark', name: '暗色', icon: 'Moon' },
  { id: 'system', name: '系统', icon: 'Monitor' },
] as const;

// 文件上传限制
export const UPLOAD_LIMITS = {
  AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  AVATAR_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  AUDIO_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  AUDIO_ALLOWED_TYPES: ['audio/wav', 'audio/mp3', 'audio/ogg'],
} as const;

// 错误消息
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

// 成功消息
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  COPY_SUCCESS: '已复制到剪贴板',
  UPLOAD_SUCCESS: '上传成功',
  CONFIG_SUCCESS: '配置已保存',
} as const;