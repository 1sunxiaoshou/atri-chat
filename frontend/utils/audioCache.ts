import { AUDIO_CONFIG } from './constants';

/**
 * 音频缓存管理器
 * 缓存TTS生成的完整音频 Blob 数据，避免重复请求
 */

interface CacheEntry {
  blob: Blob;
  timestamp: number;
}

class AudioCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number = AUDIO_CONFIG.DEFAULT_CACHE_LIMIT;
  private maxAge: number = AUDIO_CONFIG.CACHE_MAX_AGE;

  /**
   * 生成缓存键
   */
  private getCacheKey(text: string): string {
    return `tts_${text}`;
  }

  /**
   * 获取缓存
   */
  get(text: string): CacheEntry | null {
    const key = this.getCacheKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // LRU: 删除后重新插入，使其移到 Map 末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry;
  }

  /**
   * 设置缓存
   */
  set(text: string, blob: Blob): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.getCacheKey(text);
    this.cache.set(key, {
      blob,
      timestamp: Date.now()
    });
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
}

export const audioCache = new AudioCacheManager();
