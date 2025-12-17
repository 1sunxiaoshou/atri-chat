/**
 * 本地存储服务
 * 统一管理 localStorage 的读写操作
 */
import { Logger } from '../utils/logger';

export class StorageService {
  private static prefix = 'atri_';

  /**
   * 获取完整的存储键名
   */
  private static getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * 存储数据
   */
  static set<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(this.getKey(key), serializedValue);
      Logger.debug(`存储数据: ${key}`, { value });
    } catch (error) {
      Logger.error(`存储数据失败: ${key}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取数据
   */
  static get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(this.getKey(key));
      if (item === null) {
        return defaultValue ?? null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      Logger.error(`获取数据失败: ${key}`, error instanceof Error ? error : undefined);
      return defaultValue ?? null;
    }
  }

  /**
   * 删除数据
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key));
      Logger.debug(`删除数据: ${key}`);
    } catch (error) {
      Logger.error(`删除数据失败: ${key}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * 清空所有应用数据
   */
  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      Logger.info('清空所有应用数据');
    } catch (error) {
      Logger.error('清空数据失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 检查键是否存在
   */
  static has(key: string): boolean {
    return localStorage.getItem(this.getKey(key)) !== null;
  }

  /**
   * 获取所有应用相关的键
   */
  static getAllKeys(): string[] {
    const keys = Object.keys(localStorage);
    return keys
      .filter(key => key.startsWith(this.prefix))
      .map(key => key.replace(this.prefix, ''));
  }
}

// 便捷的导出函数
export const storage = {
  set: StorageService.set.bind(StorageService),
  get: StorageService.get.bind(StorageService),
  remove: StorageService.remove.bind(StorageService),
  clear: StorageService.clear.bind(StorageService),
  has: StorageService.has.bind(StorageService),
  getAllKeys: StorageService.getAllKeys.bind(StorageService)
};