import { httpClient, buildURL } from './base';
import { Message, ApiResponse, SendMessageData, AudioMessageData } from '../../types';
import { HTTP_STATUS } from '../../utils/constants';
import { Logger } from '../../utils/logger';

/**
 * 发送消息的参数接口
 */
export interface SendMessageParams {
  conversationId: number | string;
  content: string;
  characterId: number | string;
  modelId: string;
  providerId: string;
  modelParameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    display_mode?: string;
    enable_thinking?: boolean;
    thinking_config?: {
      budget?: number;
      effort?: 'low' | 'medium' | 'high';
      [key: string]: any;
    };
  };
}

/**
 * 流式消息回调接口
 */
export interface StreamCallbacks {
  onChunk?: (content: string) => void;
  onStatus?: (status: string) => void;
  onReasoning?: (reasoning: string) => void;
  onVrmData?: (data: any) => void;
}

/**
 * Message 相关 API
 */
export const messagesApi = {
  /**
   * 获取对话的消息列表
   * @param conversationId - 对话 ID
   */
  getMessages: async (
    conversationId: number | string
  ): Promise<ApiResponse<Message[]>> => {
    const response = await httpClient.get<any>(`/conversations/${conversationId}/messages`);
    Logger.debug('getMessages 原始响应', { conversationId, response });
    
    // 后端返回格式: { code, message, data: { conversation_id, messages } }
    // 需要提取 data.messages
    if (response.code === HTTP_STATUS.OK && response.data && response.data.messages) {
      return {
        code: response.code,
        message: response.message,
        data: response.data.messages
      };
    }
    
    // 如果格式不对，返回空数组
    Logger.warn('getMessages 响应格式异常', { response });
    return {
      code: response.code || HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: response.message || '获取消息失败',
      data: []
    };
  },

  /**
   * 发送消息（支持流式响应）
   * @param params - 发送消息的参数
   * @param callbacks - 流式响应的回调函数
   */
  sendMessage: async (
    params: SendMessageParams,
    callbacks?: StreamCallbacks
  ): Promise<ApiResponse<SendMessageData>> => {
    const {
      conversationId,
      content,
      characterId,
      modelId,
      providerId,
      modelParameters
    } = params;

    const body: any = {
      conversation_id: conversationId,
      character_id: characterId,
      model_id: modelId,
      provider_id: providerId,
      content,
      display_mode: 'text' // 默认值
    };

    // 添加模型参数
    if (modelParameters) {
      if (modelParameters.temperature !== undefined) {
        body.temperature = modelParameters.temperature;
      }
      if (modelParameters.max_tokens !== undefined) {
        body.max_tokens = modelParameters.max_tokens;
      }
      if (modelParameters.top_p !== undefined) {
        body.top_p = modelParameters.top_p;
      }
      if (modelParameters.display_mode !== undefined) {
        body.display_mode = modelParameters.display_mode;
      }
      if (modelParameters.enable_thinking !== undefined) {
        body.enable_thinking = modelParameters.enable_thinking;
      }
      if (modelParameters.thinking_config !== undefined) {
        body.thinking_config = modelParameters.thinking_config;
      }
    }

    // 使用统一的 URL 构建工具
    const response = await fetch(buildURL('/messages'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        return {
          code: response.status,
          message: errorJson.message || '发送消息失败',
          data: errorJson.data || { message: '' }
        };
      } catch {
        return {
          code: response.status,
          message: errorText || '发送消息失败',
          data: { message: '' }
        };
      }
    }

    // 处理流式响应（Server-Sent Events）
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullReasoning = '';
    let buffer = '';
    
    // VRM 模式下收集所有段的文本
    let vrmSegments: string[] = [];
    const isVrmMode = body.display_mode === 'vrm';

    // SSE 消息处理器（策略模式）
    const handleMessage = (data: any) => {
      const handlers: Record<string, () => void> = {
        status: () => callbacks?.onStatus?.(data.content),
        reasoning: () => {
          fullReasoning += data.content;
          callbacks?.onReasoning?.(fullReasoning);
        },
        text: () => {
          fullContent += data.content;
          callbacks?.onChunk?.(fullContent);
        },
        vrm_segment: () => {
          if (data.data && callbacks?.onVrmData) {
            callbacks.onVrmData({
              sentence_index: data.data.index,
              marked_text: data.data.marked_text,
              audio_url: data.data.audio_url
            });
            
            // 收集 VRM 段的纯文本用于消息历史
            if (isVrmMode) {
              // 去除标记，提取纯文本
              const cleanText = data.data.marked_text.replace(/\[[^\]]+:[^\]]+\]/g, '').trim();
              if (cleanText) {
                vrmSegments.push(cleanText);
                // 实时更新完整内容，让 useChat 能收到文本
                fullContent = vrmSegments.join('');
                callbacks?.onChunk?.(fullContent);
              }
            }
          }
        },
        vrm_complete: () => Logger.debug('VRM音频生成完成', { total_segments: data.total_segments })
      };

      handlers[data.type]?.();
    };

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                return {
                  code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                  message: data.message || '发送消息失败',
                  data: { message: '', error: data.error, error_type: data.error_type }
                };
              }

              if (data.done) break;

              handleMessage(data);

            } catch (e) {
              Logger.error('解析SSE数据失败', e instanceof Error ? e : undefined, { line });
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      code: HTTP_STATUS.OK,
      message: '消息发送成功',
      data: {
        message: fullContent
      }
    };
  },

  /**
   * 发送音频消息
   * @param conversationId - 对话 ID
   * @param audioBlob - 音频数据
   */
  sendAudioMessage: async (
    conversationId: number | string,
    audioBlob: Blob
  ): Promise<ApiResponse<AudioMessageData>> => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('conversation_id', String(conversationId));

    return httpClient.post<AudioMessageData>('/tts/audio-message', formData);
  }
};
