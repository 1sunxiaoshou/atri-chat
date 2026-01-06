/**
 * URL 工具函数
 * 统一处理资源 URL
 */

import { buildResourceUrl } from './constants';

/**
 * 构建头像 URL
 */
export const buildAvatarUrl = (avatarPath: string | undefined): string => {
  return buildResourceUrl(avatarPath);
};

/**
 * 构建 Logo URL
 */
export const buildLogoUrl = (logoPath: string | undefined): string => {
  return buildResourceUrl(logoPath);
};

// 重新导出
export { buildResourceUrl } from './constants';
