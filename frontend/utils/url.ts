/**
 * URL 工具函数
 * 统一处理资源 URL
 */

import { buildResourceUrl } from './constants';

/**
 * 构建头像 URL
 * 如果没有提供头像路径，返回默认头像
 */
export const buildAvatarUrl = (avatarPath: string | undefined): string => {
  if (!avatarPath) {
    return '/default-avatar.png';
  }
  return buildResourceUrl(avatarPath);
};

/**
 * 构建 Logo URL
 */
export const buildLogoUrl = (logoPath: string | undefined): string => {
  if (!logoPath) {
    return '/default-logo.png'; // 返回默认 logo
  }
  return buildResourceUrl(logoPath);
};

// 重新导出
export { buildResourceUrl } from './constants';
