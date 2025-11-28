import { Provider, Model, Character, Conversation, Message, ApiResponse, SendMessageData, AudioMessageData } from '../types';

const BASE_URL = 'http://localhost:8000/api/v1';

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            return {
                code: response.status,
                message: errorJson.message || 'Request failed',
                data: errorJson.data || {} as T
            };
        } catch (e) {
            return {
                code: response.status,
                message: errorText || 'Request failed',
                data: {} as T
            };
        }
    }
    return response.json();
}

export const api = {
    // Providers
    getProviders: async (): Promise<ApiResponse<Provider[]>> => {
        const response = await fetch(`${BASE_URL}/providers`);
        return handleResponse<Provider[]>(response);
    },
    createProvider: async (provider: Provider): Promise<ApiResponse<Provider>> => {
        const response = await fetch(`${BASE_URL}/providers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(provider)
        });
        return handleResponse<Provider>(response);
    },
    updateProvider: async (provider_id: string, config_json: any): Promise<ApiResponse<Provider>> => {
        const response = await fetch(`${BASE_URL}/providers/${provider_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config_json })
        });
        return handleResponse<Provider>(response);
    },
    deleteProvider: async (provider_id: string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/providers/${provider_id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // Models
    getModels: async (): Promise<ApiResponse<Model[]>> => {
        const response = await fetch(`${BASE_URL}/models`);
        return handleResponse<Model[]>(response);
    },
    createModel: async (model: Model): Promise<ApiResponse<Model>> => {
        const response = await fetch(`${BASE_URL}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(model)
        });
        return handleResponse<Model>(response);
    },
    toggleModel: async (modelId: string, enabled: boolean, providerId: string): Promise<ApiResponse<void>> => {
        // API docs: PUT /models/{provider_id}/{model_id}
        const response = await fetch(`${BASE_URL}/models/${providerId}/${modelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        return handleResponse<void>(response);
    },
    deleteModel: async (provider_id: string, model_id: string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/models/${provider_id}/${model_id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // Characters
    getCharacters: async (): Promise<ApiResponse<Character[]>> => {
        const response = await fetch(`${BASE_URL}/characters`);
        return handleResponse<Character[]>(response);
    },
    createCharacter: async (characterData: Omit<Character, 'id'>): Promise<ApiResponse<Character>> => {
        const response = await fetch(`${BASE_URL}/characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(characterData)
        });
        return handleResponse<Character>(response);
    },
    updateCharacter: async (id: string | number, updates: Partial<Character>): Promise<ApiResponse<Character>> => {
        const response = await fetch(`${BASE_URL}/characters/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return handleResponse<Character>(response);
    },
    deleteCharacter: async (id: string | number): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/characters/${id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // Conversations
    getConversations: async (characterId?: number | string | null): Promise<ApiResponse<Conversation[]>> => {
        let url = `${BASE_URL}/conversations`;
        if (characterId) {
            url += `?character_id=${characterId}`;
        }
        const response = await fetch(url);
        return handleResponse<Conversation[]>(response);
    },
    createConversation: async (characterId: number | string): Promise<ApiResponse<Conversation>> => {
        const response = await fetch(`${BASE_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: characterId })
        });
        return handleResponse<Conversation>(response);
    },
    deleteConversation: async (id: number | string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${BASE_URL}/conversations/${id}`, {
            method: 'DELETE'
        });
        return handleResponse<void>(response);
    },

    // Messages
    getMessages: async (conversationId: number | string): Promise<ApiResponse<Message[]>> => {
        const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`);
        return handleResponse<Message[]>(response);
    },

    sendMessage: async (conversationId: number | string, content: string, characterId?: number | string): Promise<ApiResponse<SendMessageData>> => {
        // API docs: POST /messages
        // Body: { conversation_id, content, ... }
        const body: any = { conversation_id: conversationId, content };
        // characterId is not strictly needed if conversation_id is present, but maybe for overrides?
        // The real API handles this on backend.

        const response = await fetch(`${BASE_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return handleResponse<SendMessageData>(response);
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
    }
};
