import { buildURL } from './base';

/**
 * TTS (文本转语音) 相关 API
 */
export const ttsApi = {
  /**
   * TTS 流式合成（PCM raw 格式）
   * @param text - 要合成的文本
   * @param characterId - 可选的角色 ID（使用角色绑定的音色）
   * @param language - 可选的语言参数
   * @returns 包含音频流和参数的对象
   */
  synthesizeSpeechStream: async (
    text: string,
    characterId?: string,
    language?: string
  ): Promise<{ stream: ReadableStream<Uint8Array>; sampleRate: number; channels: number }> => {
    // 使用统一的 URL 构建工具
    const response = await fetch(buildURL('/tts/synthesize?stream=true'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, character_id: characterId, language })
    });

    // 统一的错误处理
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `TTS 失败: ${response.status}`);
      } catch {
        throw new Error(errorText || `TTS 失败: ${response.status}`);
      }
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
