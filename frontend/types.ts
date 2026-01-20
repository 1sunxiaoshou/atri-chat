export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 2. Providers
export interface ProviderConfig {
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

export interface Provider {
  provider_id: string;
  description?: string;
  config_json: ProviderConfig;
  logo?: string;
  template_type: string;  // 动态模板类型，不再硬编码
}

// 3. Models
export interface Model {
  provider_id: string;
  model_id: string;
  model_type: 'text' | 'embedding' | 'rerank';
  capabilities: string[];
  enabled: boolean;
}

// 4. Characters
export interface Character {
  character_id: number;
  name: string;
  description?: string;
  avatar?: string; // Avatar URL (supports both URL and local upload)
  avatar_position?: 'left' | 'center' | 'right'; // Avatar display position
  system_prompt: string;
  primary_model_id: string;
  primary_provider_id: string;
  tts_id?: string;
  vrm_model_id?: string;
  enabled: boolean;
}

// 5. Conversations
export interface Conversation {
  conversation_id: number;
  character_id: number;
  title: string;
  updated_at?: string; // Optional in doc, but good for sorting
}

// 6. Messages
export interface Message {
  message_id: number;
  conversation_id: number;
  message_type: 'user' | 'assistant';
  content: string;
  reasoning?: string; // 思维链内容
  status?: string; // 工具调用状态
  created_at: string;
  generating?: boolean; // 是否正在生成（流式响应时）
}

export interface SendMessageData {
  message: string; // AI回复的纯文本内容
  error?: string; // 错误信息
  error_type?: string; // 错误类型
}

// 模型参数配置
export interface ModelParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  display_mode?: string;
  enable_thinking?: boolean;
  thinking_config?: ThinkingConfig;
}

// 思考配置（模型特定参数）
export interface ThinkingConfig {
  budget?: number;  // OpenAI: thinking tokens 预算
  effort?: 'low' | 'medium' | 'high';  // Anthropic: thinking effort level
  [key: string]: any;  // 其他供应商的特定参数
}

export interface AudioMessageData {
  transcribed_text: string;
  assistant_response: string;
}

// UI State Types
export type ViewMode = 'chat' | 'admin';
export type AdminTab = 'models' | 'characters' | 'vrm';

// 7. ASR
export interface ASRConfigField {
  type: 'string' | 'password' | 'number' | 'select' | 'file';
  label: string;
  description: string;
  default: any;
  required: boolean;
  placeholder?: string;
  sensitive?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  value?: any;
}

export interface ASRProvider {
  id: string;
  name: string;
  is_configured: boolean;
  config?: Record<string, ASRConfigField>;
}

export interface ASRConfigResponse {
  active_provider: string | null;
  providers: ASRProvider[];
}

// 8. TTS
export interface TTSConfigField {
  type: 'string' | 'password' | 'number' | 'select' | 'file';
  label: string;
  description: string;
  default: any;
  required: boolean;
  placeholder?: string;
  sensitive?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  value?: any;
}

export interface TTSProvider {
  id: string;
  name: string;
  is_configured: boolean;
  config?: Record<string, TTSConfigField>;
}

export interface TTSConfigResponse {
  active_provider: string | null;
  providers: TTSProvider[];
}


// VRM 类型定义
export interface VRMModel {
  vrm_model_id: string;
  name: string;
  model_path: string;
  thumbnail_path?: string;
  description?: string;
  created_at: string;
  animations?: VRMAnimation[];
}

export interface VRMAnimation {
  animation_id: string;
  vrm_model_id: string;
  name: string;
  name_cn: string;
  animation_path: string;
  duration?: number;
  type: string;
}

// 9. 错误处理类型
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: number;
}
