/**
 * 流式TTS播放管理器
 * 
 * 核心功能：
 * 1. 维护三个维度的状态：网络状态、播放器状态、数据队列
 * 2. 支持"停止播放但继续缓存"
 * 3. 支持从缓存恢复播放
 * 4. 防止重复请求
 * 5. 支持全局音频缓存
 */

import { PCMStreamPlayer } from './pcmStreamPlayer';
import { audioCache } from './audioCache';

interface AudioChunk {
  data: Uint8Array;
  index: number;
}

type NetworkState = 'idle' | 'fetching' | 'finished';
type PlayerState = 'playing' | 'paused';

export class StreamTTSPlayer {
  // 状态管理
  private audioQueue: AudioChunk[] = [];
  private currentIndex: number = 0;
  private networkState: NetworkState = 'idle';
  private playerState: PlayerState = 'paused';
  
  // 播放器
  private pcmPlayer: PCMStreamPlayer | null = null;
  private currentPlayingIndex: number = -1;
  
  // 音频参数
  private volume: number = 1.0;
  
  // 当前文本（用于判断是否是新请求）
  private currentText: string = '';

  constructor(volume: number = 1.0) {
    this.volume = volume;
  }

  /**
   * 用户点击播放按钮
   */
  async onPlay(
    text: string,
    fetchMethod: () => Promise<{ stream: ReadableStream<Uint8Array>, sampleRate: number, channels: number }>
  ): Promise<void> {
    // 场景1：之前暂停过，且缓存已完成，现在是恢复播放（同一文本）
    if (this.currentText === text && 
        this.audioQueue.length > 0 && 
        this.currentIndex < this.audioQueue.length &&
        this.networkState === 'finished') {
      console.log('[StreamTTS] 从本地队列恢复播放...');
      this.resume();
      return;
    }

    // 场景2：正在缓存中（未完成），再次点击从头播放
    if (this.currentText === text && 
        this.networkState === 'fetching' && 
        this.audioQueue.length > 0) {
      console.log('[StreamTTS] 缓存未完成，从头播放...');
      // 重置播放索引，从头开始
      this.currentIndex = 0;
      this.currentPlayingIndex = -1;
      this.playerState = 'playing';
      
      // 停止当前播放
      if (this.pcmPlayer) {
        this.pcmPlayer.stopPlayback();
      }
      
      // 从头开始播放
      this.playNextChunk();
      return;
    }

    // 场景3：已经在播放中，防止重复点击
    if (this.playerState === 'playing') {
      console.log('[StreamTTS] 正在播放中，忽略重复点击');
      return;
    }

    // 场景4：检查全局缓存
    const cached = audioCache.get(text);
    if (cached) {
      console.log('[StreamTTS] 从全局缓存播放...');
      this.reset();
      this.currentText = text;
      
      // 将缓存数据加载到队列
      cached.data.forEach((data, index) => {
        this.audioQueue.push({ data, index });
      });
      
      this.networkState = 'finished';
      this.playerState = 'playing';
      
      // 创建播放器
      this.pcmPlayer = new PCMStreamPlayer(this.volume, cached.sampleRate, cached.channels);
      
      // 开始播放
      this.playNextChunk();
      return;
    }

    // 场景5：全新的播放请求
    console.log('[StreamTTS] 发起新请求...');
    this.reset();
    this.currentText = text;
    this.playerState = 'playing';
    this.networkState = 'fetching';

    try {
      // 发起请求
      const { stream, sampleRate, channels } = await fetchMethod();

      // 创建播放器
      this.pcmPlayer = new PCMStreamPlayer(this.volume, sampleRate, channels);

      // 开始接收流
      await this.handleStream(stream);
      
      // 流接收完成后，保存到全局缓存
      if (this.audioQueue.length > 0) {
        const cacheData = this.audioQueue.map(chunk => chunk.data);
        audioCache.set(text, cacheData, sampleRate, channels);
        console.log('[StreamTTS] 已保存到全局缓存');
      }
    } catch (error) {
      console.error('[StreamTTS] 播放失败:', error);
      this.networkState = 'idle';
      this.playerState = 'paused';
      throw error;
    }
  }

  /**
   * 用户点击停止（暂停）按钮
   */
  onStop(): void {
    console.log('[StreamTTS] 用户点击停止');
    this.playerState = 'paused';

    // 立即停止当前正在播放的音频
    if (this.pcmPlayer) {
      this.pcmPlayer.stopPlayback();
    }

    // 注意：不清除 queue，也不断开网络，实现"继续缓存"
  }

  /**
   * 内部方法：从暂停状态恢复
   */
  private resume(): void {
    this.playerState = 'playing';
    
    // 从当前索引继续播放
    this.playNextChunk();
  }

  /**
   * 处理流式数据
   */
  private async handleStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();

    try {
      let chunkIndex = 0;
      
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[StreamTTS] 流式接收完毕');
          this.networkState = 'finished';
          break;
        }

        if (value && value.length > 0) {
          // 推入缓存
          this.audioQueue.push({
            data: value,
            index: chunkIndex++
          });

          console.log(`[StreamTTS] 收到第 ${this.audioQueue.length} 个分片`);

          // 如果当前处于"播放状态"且"没有声音在播"，触发播放
          if (this.playerState === 'playing' && this.currentPlayingIndex === -1) {
            this.playNextChunk();
          }
        }
      }
    } catch (error) {
      console.error('[StreamTTS] 流接收失败:', error);
      this.networkState = 'idle';
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 播放核心逻辑
   */
  private async playNextChunk(): Promise<void> {
    // 1. 边界检查：如果没有处于播放状态（用户点了停止），坚决不播
    if (this.playerState !== 'playing') {
      console.log('[StreamTTS] 检测到处于暂停状态，停止自动播放下一句');
      return;
    }

    // 2. 检查队列是否有数据
    if (this.currentIndex >= this.audioQueue.length) {
      console.log('[StreamTTS] 缓冲已播完，等待新数据或结束');
      this.currentPlayingIndex = -1;
      
      if (this.networkState === 'finished') {
        console.log('[StreamTTS] 全部播放完毕');
        this.playerState = 'paused';
      }
      return;
    }

    // 3. 取出当前分片
    const chunk = this.audioQueue[this.currentIndex];
    this.currentPlayingIndex = this.currentIndex;

    console.log(`[StreamTTS] 播放第 ${this.currentIndex + 1} 个分片`);

    try {
      // 4. 播放
      if (this.pcmPlayer) {
        await this.pcmPlayer.playChunk(chunk.data);
      }

      // 5. 播放完成后，准备播下一句
      this.currentIndex++;
      this.currentPlayingIndex = -1;

      // 6. 递归调用尝试播下一句（会在开头检查 playerState）
      await this.playNextChunk();
    } catch (error) {
      console.error('[StreamTTS] 播放分片失败:', error);
      this.currentPlayingIndex = -1;
    }
  }

  /**
   * 重置所有状态
   */
  private reset(): void {
    this.onStop();
    this.audioQueue = [];
    this.currentIndex = 0;
    this.currentPlayingIndex = -1;
    this.currentText = '';
    
    if (this.pcmPlayer) {
      this.pcmPlayer.stop();
      this.pcmPlayer = null;
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.volume = volume;
    if (this.pcmPlayer) {
      this.pcmPlayer.setVolume(volume);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): { networkState: NetworkState; playerState: PlayerState; queueLength: number; currentIndex: number } {
    return {
      networkState: this.networkState,
      playerState: this.playerState,
      queueLength: this.audioQueue.length,
      currentIndex: this.currentIndex
    };
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.reset();
    if (this.pcmPlayer) {
      await this.pcmPlayer.close();
      this.pcmPlayer = null;
    }
  }
}
