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
    // 使用 ReadableStream 读取器逐块读取响应数据
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullReasoning = '';
    let buffer = ''; // 用于累积不完整的行（SSE 可能会分块传输）

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {break;}

          // 解码并累积到 buffer
          buffer += decoder.decode(value, { stream: true });

          // 按行分割
          const lines = buffer.split('\n');

          // 保留最后一个不完整的行
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // 检查是否有错误
                if (data.error) {
                  return {
                    code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                    message: data.message || '发送消息失败',
                    data: {
                      message: '',
                      error: data.error,
                      error_type: data.error_type
                    }
                  };
                }

                if (data.done) {
                  break;
                }

                // 处理新的 JSON 格式
                if (data.type === 'status' && data.content) {
                  // 工具调用状态
                  if (callbacks?.onStatus) {
                    callbacks.onStatus(data.content);
                  }
                } else if (data.type === 'reasoning' && data.content) {
                  // 思维链内容（累积）
                  fullReasoning += data.content;
                  if (callbacks?.onReasoning) {
                    callbacks.onReasoning(fullReasoning);
                  }
                } else if (data.type === 'text' && data.content) {
                  // 文本内容（累积）
                  fullContent += data.content;
                  if (callbacks?.onChunk) {
                    callbacks.onChunk(fullContent);
                  }
                } else if (data.type === 'vrm_data' && data.content) {
                  // 兼容旧格式的VRM数据
                  if (callbacks?.onVrmData) {
                    callbacks.onVrmData(data.content);
                  }
                } else if (data.type === 'vrm_audio_segment' && data.segment) {
                  // 新格式：单个VRM音频段
                  if (callbacks?.onVrmData) {
                    callbacks.onVrmData(data.segment);
                  }
                } else if (data.type === 'vrm_audio_complete') {
                  // VRM音频生成完成信号
                  Logger.debug('VRM audio generation completed', { data });
                } else if (data.type === 'vrm_error') {
                  // VRM错误处理
                  Logger.error('VRM error', undefined, { error: data.error, details: data.details });
                }
              } catch (e) {
                Logger.error('Failed to parse SSE data', e instanceof Error ? e : undefined, { line });
              }
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
