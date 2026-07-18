export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id?: string;
  process_time?: string;
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
  id: number;
  name: string;
  description?: string;
  config_payload: ProviderConfig;
  provider_type: string;  // 动态模板类型
}

// 3. Models
export interface Model {
  id: number; // Integer (primary key)
  provider_config_id: number;
  model_id: string;
  model_type: 'chat' | 'embedding' | 'rerank';
  has_vision: boolean;
  has_audio: boolean;
  has_video: boolean;
  has_reasoning: boolean;
  has_tool_use: boolean;
  has_document: boolean;
  has_structured_output: boolean;
  context_window?: number;
  max_output?: number;
  enabled: boolean;
  parameters?: Record<string, any>;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// 4. Characters
export interface Character {
  id: string; // UUID (primary key from backend)
  name: string;
  portrait_url?: string; // 2D立绘URL
  avatar?: Avatar; // Avatar object (from API with relationships)
  avatar_id?: string; // Avatar asset ID (可选)
  avatar_position?: 'left' | 'center' | 'right'; // Avatar display position (前端使用)
  system_prompt: string;
  primary_model_id?: number; // Integer ID of the model (references models.id, 可选)
  primary_provider_config_id?: number;
  primary_model?: { // 模型详情（从后端返回）
    id: number;
    model_id: string;
    provider_config_id: number;
  };
  voice_asset_id?: number; // Voice asset ID (可选)
  voice_speaker_id?: string; // Voice speaker ID (可选)
  voice_asset?: VoiceAsset; // Voice asset object (from API with relationships)
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// Avatar 资产（3D VRM 模型）
export interface Avatar {
  id: string;
  name: string;
  file_url: string;
  thumbnail_url?: string;
  model_path: string;      // 完整可访问的 VRM 模型 URL（由后端 build_url 拼接返回）
  thumbnail_path?: string; // 完整可访问的缩略图 URL（由后端 build_url 拼接返回）
  available_expressions?: string[]; // 可用表情列表
  created_at: string;
  updated_at: string;
}

// 音色资产
export interface VoiceAsset {
  id: number;
  name: string;
  provider_id: number;
  voice_config: Record<string, any>;
  created_at: string;
  updated_at: string;
  provider?: {
    id: number;
    name: string;
    provider_type: string;
  };
}

// 5. Conversations
export interface Conversation {
  id?: string; // 后端返回的字段名（UUID）
  conversation_id?: number; // 兼容旧代码
  character_id: string; // UUID
  title: string;
  updated_at?: string;
  created_at?: string;
  message_count?: number;
  character_name?: string;
}

export interface ToolCall {
  run_id: string;
  tool: string;
  input: any;
  output?: any;
  status: 'running' | 'completed' | 'error';
}

export interface AgentStreamContext {
  conversation_id: string;
  turn_id?: string;
  user_message_id?: string;
  character_id: string;
  model_id: string;
  provider_config_id: number;
  display_mode: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  enable_thinking?: boolean;
  thinking_config?: ThinkingConfig;
}

export interface AgentStreamMessageEvent {
  id?: string;
  event: 'messages';
  data: unknown;
}

export interface AgentStreamUpdateEvent {
  event: 'updates';
  data: Record<string, unknown>;
}

export interface AgentStreamCustomEvent {
  type: string;
  content?: string;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

export interface AgentStreamMetadataEvent {
  conversation_id: string;
  turn_id?: string;
  thread_id: string;
  usage?: Record<string, unknown>;
}

export interface RuntimeCapabilityStatus {
  capability: 'agent' | 'asr' | 'tts' | 'vrm' | string;
  status: 'disabled' | 'uninitialized' | 'warming' | 'ready' | 'busy' | 'failed' | string;
  summary: string;
  details: Record<string, unknown>;
  updated_at: string;
  manifest?: {
    capability: string;
    label: string;
    adapters: string[];
    modes: string[];
    runtime_managed: boolean;
    supports_warmup: boolean;
    supports_shutdown: boolean;
    supports_reset: boolean;
    supports_frontend_feedback: boolean;
  };
}

export interface RuntimeStatusResponse {
  control_plane: {
    status: string;
    startup: {
      process_started_at: string;
      phases_ms: Record<string, number>;
      health_ready_ms: number | null;
    };
  };
  capabilities: RuntimeCapabilityStatus[];
  summary: {
    total_count: number;
    ready_count: number;
    warming_count: number;
    failed_count: number;
    counts: Record<string, number>;
    statuses: Record<string, string>;
  };
}

export interface CapabilityEvent {
  capability: string;
  adapter: string;
  thread_id: string | null;
  run_id: string | null;
  phase: string;
  status: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// 6. Messages
export interface Message {
  message_id: number | string; // 支持数字 ID 和临时字符串 ID
  conversation_id: number | string; // 支持两种类型
  turn_id?: string;
  lc_message_id?: string;
  message_type: 'user' | 'assistant' | 'tool';
  content: string;
  reasoning?: string; // 思维链内容
  status?: string; // 工具调用状态
  tool_calls?: ToolCall[]; // 消息相关的工具调用
  tool_call_id?: string;
  tool_name?: string;
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
  [key: string]: any; // 支持动态参数
}

// 思考配置（模型特定参数）
export interface ThinkingConfig {
  budget?: number;  // OpenAI: thinking tokens 预算
  effort?: 'low' | 'medium' | 'high';  // Anthropic: thinking effort level
  [key: string]: any;  // 其他供应商的特定参数
}

// 参数 Schema 定义
export interface ParameterSchema {
  type: 'slider' | 'number' | 'boolean' | 'select' | 'text' | 'segmented';
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  default?: any;
  options?: Array<{ value: string | number; label: string }>;
  applicable_model_types?: string[];
  applicable_capabilities?: string[];
  order?: number;
}

export interface ModelParameterSchemaResponse {
  model_id: string;
  provider_config_id: number;
  model_type: string;
  capabilities: string[];
  common_parameters: Record<string, ParameterSchema>;
  provider_parameters: Record<string, ParameterSchema>;
}

export interface AudioMessageData {
  transcribed_text: string;
  assistant_response: string;
}

// UI State Types
export type ViewMode = 'chat' | 'admin' | 'settings' | 'characters';
export type AdminTab = 'models' | 'vrm' | 'animations' | 'voice';

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
