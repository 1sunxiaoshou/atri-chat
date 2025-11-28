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
  template_type: 'openai' | 'anthropic' | 'google' | 'tongyi' | 'local';
}

// 3. Models
export interface Model {
  provider_id: string;
  model_id: string;
  model_type: 'text' | 'embedding';
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
  created_at: string;
  isStreaming?: boolean; // UI only
}

export interface SendMessageData {
  message: string; // AI回复的纯文本内容
}

export interface AudioMessageData {
  transcribed_text: string;
  assistant_response: string;
}

// UI State Types
export type ViewMode = 'chat' | 'admin';
export type AdminTab = 'providers' | 'models' | 'characters';
