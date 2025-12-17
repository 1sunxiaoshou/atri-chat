/**
 * API 服务层统一导出
 * 按业务领域组织的 API 模块
 */

import { httpClient } from './base';
import { providersApi } from './providers';
import { modelsApi } from './models';
import { charactersApi } from './characters';
import { conversationsApi } from './conversations';
import { messagesApi } from './messages';
import { vrmApi } from './vrm';
import { asrApi } from './asr';
import { ttsApi } from './tts';

export { 
  httpClient, 
  getBaseURL, 
  getUploadBaseURL,
  buildURL,
  buildUploadURL 
} from './base';
export { ErrorType, type AppError } from '../../types';
export { providersApi } from './providers';
export { modelsApi } from './models';
export { charactersApi } from './characters';
export { conversationsApi } from './conversations';
export { messagesApi, type SendMessageParams, type StreamCallbacks } from './messages';
export { vrmApi } from './vrm';
export { asrApi } from './asr';
export { ttsApi } from './tts';

/**
 * 向后兼容的 API 对象
 * 保持与旧代码的兼容性，同时推荐使用新的模块化导入
 * @deprecated 建议直接导入具体的 API 模块，如 import { providersApi } from './api'
 */
export const api = {
  // 通用 HTTP 方法
  get: httpClient.get.bind(httpClient),
  post: httpClient.post.bind(httpClient),
  put: httpClient.put.bind(httpClient),
  delete: httpClient.delete.bind(httpClient),

  // Provider API
  getProviders: providersApi.getProviders,
  createProvider: providersApi.createProvider,
  updateProvider: providersApi.updateProvider,
  deleteProvider: providersApi.deleteProvider,
  getProviderTemplates: providersApi.getProviderTemplates,
  uploadProviderLogo: providersApi.uploadProviderLogo,

  // Model API
  getModels: modelsApi.getModels,
  createModel: modelsApi.createModel,
  toggleModel: modelsApi.toggleModel,
  deleteModel: modelsApi.deleteModel,

  // Character API
  getCharacters: charactersApi.getCharacters,
  createCharacter: charactersApi.createCharacter,
  updateCharacter: charactersApi.updateCharacter,
  deleteCharacter: charactersApi.deleteCharacter,
  uploadAvatar: charactersApi.uploadAvatar,

  // Conversation API
  getConversations: conversationsApi.getConversations,
  createConversation: conversationsApi.createConversation,
  deleteConversation: conversationsApi.deleteConversation,

  // Message API
  getMessages: messagesApi.getMessages,
  sendMessage: messagesApi.sendMessage,
  sendAudioMessage: messagesApi.sendAudioMessage,

  // ASR API
  getASRProviders: asrApi.getASRProviders,
  testASRConnection: asrApi.testASRConnection,
  saveASRConfig: asrApi.saveASRConfig,
  transcribeAudio: asrApi.transcribeAudio,

  // TTS API
  getTTSProviders: ttsApi.getTTSProviders,
  testTTSConnection: ttsApi.testTTSConnection,
  saveTTSConfig: ttsApi.saveTTSConfig,
  synthesizeSpeechStream: ttsApi.synthesizeSpeechStream,

  // VRM API
  getVRMModels: vrmApi.getVRMModels,
  getVRMModel: vrmApi.getVRMModel,
  uploadVRMModel: vrmApi.uploadVRMModel,
  updateVRMModel: vrmApi.updateVRMModel,
  deleteVRMModel: vrmApi.deleteVRMModel,
  getVRMAnimations: vrmApi.getVRMAnimations,
  getVRMAnimation: vrmApi.getVRMAnimation,
  uploadVRMAnimation: vrmApi.uploadVRMAnimation,
  updateVRMAnimation: vrmApi.updateVRMAnimation,
  deleteVRMAnimation: vrmApi.deleteVRMAnimation,
  getVRMAnimationModels: vrmApi.getVRMAnimationModels,
  getModelAnimations: vrmApi.getModelAnimations,
  addModelAnimation: vrmApi.addModelAnimation,
  uploadAndBindModelAnimation: vrmApi.uploadAndBindModelAnimation,
  batchAddModelAnimations: vrmApi.batchAddModelAnimations,
  removeModelAnimation: vrmApi.removeModelAnimation,
  batchRemoveModelAnimations: vrmApi.batchRemoveModelAnimations
};
