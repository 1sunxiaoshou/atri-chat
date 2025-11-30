/**
 * 音频缓存管理器
 * 缓存TTS生成的音频数据，避免重复请求
 */

interface CacheEntry {
  data: Uint8Array[];
  sampleRate: number;
  channels: number;
  timestamp: number;
}

class AudioCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number = 50; // 最多缓存50条
  private maxAge: number = 30 * 60 * 1000; // 30分钟过期

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

    return entry;
  }

  /**
   * 设置缓存
   */
  set(text: string, data: Uint8Array[], sampleRate: number, channels: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const key = this.getCacheKey(text);
    this.cache.set(key, {
      data,
      sampleRate,
      channels,
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
