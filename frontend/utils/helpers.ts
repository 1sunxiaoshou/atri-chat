/**
 * 共享工具函数
 */

import { Character, Conversation } from '../types';

/**
 * 获取角色 ID（兼容 character_id 和 id 字段）
 */
export const getCharacterId = (char: Character): number => {
  return (char.character_id || char.id || 0) as number;
};

/**
 * 获取对话 ID（兼容 conversation_id 和 id 字段）
 */
export const getConversationId = (conv: Conversation): number => {
  return Number(conv.conversation_id || conv.id || 0);
};

/**
 * 从配置对象中提取值（处理元数据格式）
 */
export const extractConfigValues = (config: any): any => {
  const values: any = {};
  for (const key in config) {
    if (config[key]?.value !== undefined) {
      values[key] = config[key].value;
    } else if (config[key]?.default !== undefined) {
      values[key] = config[key].default;
    } else {
      values[key] = config[key];
    }
  }
  return values;
};
