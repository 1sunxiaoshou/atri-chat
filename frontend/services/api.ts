import { Provider, Model, Character, Conversation, Message, ApiResponse, SendMessageData, AudioMessageData, ASRConfigResponse } from '../types';

// 动态获取 API 地址：生产环境使用相对路径，开发环境使用 localhost
const BASE_URL = import.meta.env.PROD
    ? '/api/v1'  // 生产环境：使用相对路径（前后端同域）
    : 'http://localhost:8000/api/v1';  // 开发环境：使用完整地址

/**
 * 处理API响应
 * @param response - 原始响应对象
 * @returns 统一格式的API响应
 */
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            return {
                code: response.status,
                message: errorJson.message || '请求失败',
                data: errorJson.data || {} as T
            };
        } catch (e) {
            return {
                code: response.status,
                message: errorText || '请求失败',
                data: {} as T
            };
        }
    }
    return response.json();
}

export const api = {
    // ==================== 服务商管理 ====================
    /** 获取所有服务商列表 */
    getProviders: async (): Promise<ApiResponse<Provider[]>> => {
        const response = await fetch(`${BASE_URL}/providers`);
        return handleResponse<Provider[]>(response);
    },
    /** 创建新的服务商 */
    createProvider: async (provider: Provider): Promise<ApiResponse<Provider>> => {
        const response = await fetch(`${BASE_URL}/providers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(provider)
        });
        return handleResponse<Provider>(response);
    },
    /** 更新服务商配置 */
    updateProvider: async (provider_id: string, updates: { name?: string; config_json?: any; logo?: string }): Promise<ApiResponse<Provider>> => {
        const response = await fetch(`${BASE_URL}/providers/${provider_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return handleResponse<Provider>(response);
    },
    /** 删除服务商 */
    deleteProvider: async (provider_id: string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/providers/${provider_id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // ==================== 模型管理 ====================
    /** 获取所有模型列表 */
    getModels: async (): Promise<ApiResponse<Model[]>> => {
        const response = await fetch(`${BASE_URL}/models`);
        return handleResponse<Model[]>(response);
    },
    /** 创建新的模型 */
    createModel: async (model: Model): Promise<ApiResponse<Model>> => {
        const response = await fetch(`${BASE_URL}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(model)
        });
        return handleResponse<Model>(response);
    },
    /** 切换模型启用/禁用状态 */
    toggleModel: async (modelId: string, enabled: boolean, providerId: string): Promise<ApiResponse<void>> => {
        // 先获取模型信息
        const getResponse = await fetch(`${BASE_URL}/models/${providerId}/${modelId}`);
        const modelData = await handleResponse<any>(getResponse);

        if (modelData.code !== 200) {
            return modelData;
        }

        // 更新模型
        const response = await fetch(`${BASE_URL}/models/${providerId}/${modelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_type: modelData.data.model_type,
                capabilities: modelData.data.capabilities,
                enabled
            })
        });
        return handleResponse<void>(response);
    },
    /** 删除模型 */
    deleteModel: async (provider_id: string, model_id: string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/models/${provider_id}/${model_id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // ==================== 角色管理 ====================
    /** 获取所有角色列表 */
    getCharacters: async (): Promise<ApiResponse<Character[]>> => {
        const response = await fetch(`${BASE_URL}/characters`);
        return handleResponse<Character[]>(response);
    },
    /** 创建新的角色 */
    createCharacter: async (characterData: Omit<Character, 'id'>): Promise<ApiResponse<Character>> => {
        const response = await fetch(`${BASE_URL}/characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(characterData)
        });
        return handleResponse<Character>(response);
    },
    /** 更新角色信息 */
    updateCharacter: async (id: string | number, updates: Partial<Character>): Promise<ApiResponse<Character>> => {
        const response = await fetch(`${BASE_URL}/characters/${id}`, {
            method: 'PATCH',  // 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return handleResponse<Character>(response);
    },
    /** 删除角色 */
    deleteCharacter: async (id: string | number): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/characters/${id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // ==================== 对话管理 ====================
    /** 获取对话列表，可按角色ID筛选 */
    getConversations: async (characterId?: number | string | null): Promise<ApiResponse<Conversation[]>> => {
        let url = `${BASE_URL}/conversations`;
        if (characterId) {
            url += `?character_id=${characterId}`;
        }
        const response = await fetch(url);
        return handleResponse<Conversation[]>(response);
    },
    /** 创建新的对话 */
    createConversation: async (characterId: number | string): Promise<ApiResponse<Conversation>> => {
        const response = await fetch(`${BASE_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: characterId })
        });
        return handleResponse<Conversation>(response);
    },
    /** 删除对话 */
    deleteConversation: async (id: number | string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/conversations/${id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // ==================== 消息管理 ====================
    getMessages: async (conversationId: number | string): Promise<ApiResponse<Message[]>> => {
        const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`);
        return handleResponse<Message[]>(response);
    },

    sendMessage: async (
        conversationId: number | string,
        content: string,
        characterId: number | string,
        modelId: string,
        providerId: string,
        modelParameters?: {
            temperature?: number;
            max_tokens?: number;
            top_p?: number;
        },
        onChunk?: (content: string) => void,
        onStatus?: (status: string) => void,
        onReasoning?: (reasoning: string) => void
    ): Promise<ApiResponse<SendMessageData>> => {
        const body: any = {
            conversation_id: conversationId,
            character_id: characterId,
            model_id: modelId,
            provider_id: providerId,
            content
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
        }

        const response = await fetch(`${BASE_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            return handleResponse<SendMessageData>(response);
        }

        // 处理流式响应
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let fullReasoning = '';
        let buffer = ''; // 用于累积不完整的行

        if (reader) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

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
                                        code: 500,
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
                                    if (onStatus) {
                                        onStatus(data.content);
                                    }
                                } else if (data.type === 'reasoning' && data.content) {
                                    // 思维链内容（累积）
                                    fullReasoning += data.content;
                                    if (onReasoning) {
                                        onReasoning(fullReasoning);
                                    }
                                } else if (data.type === 'text' && data.content) {
                                    // 实际文本内容
                                    fullContent += data.content;
                                    if (onChunk) {
                                        onChunk(fullContent);
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE data:', line, e);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        }

        return {
            code: 200,
            message: '消息发送成功',
            data: {
                message: fullContent
            }
        };
    },

    // TTS / Audio
    sendAudioMessage: async (conversationId: number | string, audioBlob: Blob): Promise<ApiResponse<AudioMessageData>> => {
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('conversation_id', String(conversationId));

        const response = await fetch(`${BASE_URL}/tts/audio-message`, {
            method: 'POST',
            body: formData
        });
        return handleResponse<AudioMessageData>(response);
    },

    // ==================== 文件上传 ====================
    /** 上传角色头像 */
    uploadAvatar: async (file: File): Promise<ApiResponse<{ url: string; filename: string }>> => {
        const formData = new FormData();
        formData.append('file', file);

        const uploadUrl = import.meta.env.PROD ? '/api/upload/avatar' : 'http://localhost:8000/api/upload/avatar';
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });
        return handleResponse<{ url: string; filename: string }>(response);
    },

    /** 上传供应商Logo */
    uploadProviderLogo: async (file: File, providerId?: string): Promise<ApiResponse<{ url: string; filename: string; provider_id?: string }>> => {
        const formData = new FormData();
        formData.append('file', file);

        let url = import.meta.env.PROD ? '/api/upload/provider-logo' : 'http://localhost:8000/api/upload/provider-logo';
        if (providerId) {
            url += `?provider_id=${providerId}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        return handleResponse<{ url: string; filename: string; provider_id?: string }>(response);
    },

    // ==================== ASR (语音转文本) ====================
    /** 获取ASR配置列表与状态 */
    getASRProviders: async (): Promise<ApiResponse<ASRConfigResponse>> => {
        const response = await fetch(`${BASE_URL}/asr/providers`);
        return handleResponse<ASRConfigResponse>(response);
    },

    /** 测试ASR连接 */
    testASRConnection: async (providerId: string, config: any): Promise<ApiResponse<any>> => {
        const response = await fetch(`${BASE_URL}/asr/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_id: providerId, config })
        });
        return handleResponse<any>(response);
    },

    /** 保存ASR配置 */
    saveASRConfig: async (providerId: string, config: any): Promise<ApiResponse<any>> => {
        const response = await fetch(`${BASE_URL}/asr/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_id: providerId, config })
        });
        return handleResponse<any>(response);
    },

    /** 语音转文本 */
    transcribeAudio: async (file: Blob, language?: string): Promise<ApiResponse<{ text: string }>> => {
        const formData = new FormData();
        formData.append('file', file);
        if (language) {
            formData.append('language', language);
        }

        const response = await fetch(`${BASE_URL}/asr/transcribe`, {
            method: 'POST',
            body: formData
        });
        return handleResponse<{ text: string }>(response);
    },

    // ==================== Provider Templates ====================
    /** 获取所有供应商模板 */
    getProviderTemplates: async (): Promise<ApiResponse<any[]>> => {
        const response = await fetch(`${BASE_URL}/providers/templates/list`);
        return handleResponse<any[]>(response);
    },

    // ==================== TTS (文本转语音) ====================
    /** 获取TTS配置列表与状态 */
    getTTSProviders: async (): Promise<ApiResponse<any>> => {
        const response = await fetch(`${BASE_URL}/tts/providers`);
        return handleResponse<any>(response);
    },

    /** 测试TTS连接 */
    testTTSConnection: async (providerId: string, config: any): Promise<ApiResponse<any>> => {
        const response = await fetch(`${BASE_URL}/tts/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_id: providerId, config })
        });
        return handleResponse<any>(response);
    },

    /** 保存TTS配置 */
    saveTTSConfig: async (providerId: string, config: any): Promise<ApiResponse<any>> => {
        const response = await fetch(`${BASE_URL}/tts/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_id: providerId, config })
        });
        return handleResponse<any>(response);
    },

    /** TTS 流式合成（PCM raw 格式） */
    synthesizeSpeechStream: async (text: string, language?: string): Promise<{ stream: ReadableStream<Uint8Array>, sampleRate: number, channels: number }> => {
        const response = await fetch(`${BASE_URL}/tts/synthesize?stream=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language })
        });

        if (!response.ok) {
            throw new Error(`TTS 失败: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('响应体为空');
        }

        // 从响应头读取音频参数
        const sampleRate = parseInt(response.headers.get('X-Sample-Rate') || '32000');
        const channels = parseInt(response.headers.get('X-Channels') || '1');

        return {
            stream: response.body,
            sampleRate,
            channels
        };
    }
};
