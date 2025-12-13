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
  name: string;
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
  character_id?: number; // Backend uses character_id
  id?: string | number; // For backward compatibility
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
  id?: string | number; // Optional for backward compatibility
  conversation_id?: string | number; // Backend field
  character_id: string | number;
  title: string;
  updated_at?: string; // Optional in doc, but good for sorting
}

// 6. Messages
export interface Message {
  message_id: string | number;
  conversation_id: string | number;
  message_type: 'user' | 'assistant';
  content: string;
  reasoning?: string; // 思维链内容
  created_at: string;
  isStreaming?: boolean; // UI only
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
}

export interface AudioMessageData {
  transcribed_text: string;
  assistant_response: string;
}

// UI State Types
export type ViewMode = 'chat' | 'admin';
export type AdminTab = 'providers' | 'models' | 'characters' | 'vrm';

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
