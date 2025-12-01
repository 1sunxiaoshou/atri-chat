/**
 * PCM 流式音频播放器
 * 使用 Web Audio API (AudioContext) 实现真正的边接收边播放
 * 
 * 优势：
 * - 支持所有现代浏览器（包括 iOS Safari）
 * - 延迟最低（无需解码）
 * - 真正的流式播放
 */

export class PCMStreamPlayer {
  private audioContext: AudioContext;
  private sampleRate: number;
  private channels: number;
  private nextStartTime: number = 0;
  public isPlaying: boolean = false;
  private volume: number;
  private gainNode: GainNode;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private pendingResolvers: Array<{ resolve: () => void; reject: (reason?: any) => void }> = [];

  constructor(
    volume: number = 1.0,
    sampleRate: number = 32000, // GPT-SoVITS 默认 32kHz
    channels: number = 1 // 单声道
  ) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.volume = volume;
    this.isPlaying = true;
    
    // 创建全局增益节点用于音量控制
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = volume;
    this.gainNode.connect(this.audioContext.destination);
  }

  /**
   * 播放单个音频块
   */
  async playChunk(pcmData: Uint8Array): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // 记录 resolver，以便在 stopPlayback 时可以 reject
      const resolver = { resolve, reject };
      this.pendingResolvers.push(resolver);

      try {
        // 将 Uint8Array 转换为 Int16Array（PCM 16-bit）
        const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
        
        // 转换为 Float32Array（AudioContext 需要）
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0; // 归一化到 [-1, 1]
        }

        // 创建 AudioBuffer
        const audioBuffer = this.audioContext.createBuffer(
          this.channels,
          float32Array.length / this.channels,
          this.sampleRate
        );

        // 填充数据
        for (let channel = 0; channel < this.channels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] = float32Array[i * this.channels + channel];
          }
        }

        // 创建音频源节点
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // 连接到全局增益节点
        source.connect(this.gainNode);

        // 计算播放时间，确保无缝衔接
        const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
        
        // 播放结束后清理并 resolve Promise
        source.onended = () => {
          const index = this.activeSourceNodes.indexOf(source);
          if (index > -1) {
            this.activeSourceNodes.splice(index, 1);
          }
          
          // 从 pending resolvers 中移除并 resolve
          const resolverIndex = this.pendingResolvers.indexOf(resolver);
          if (resolverIndex > -1) {
            this.pendingResolvers.splice(resolverIndex, 1);
          }
          resolve();
        };

        // 记录活跃的源节点
        this.activeSourceNodes.push(source);

        // 开始播放
        source.start(startTime);

        // 更新下一个块的开始时间
        this.nextStartTime = startTime + audioBuffer.duration;
      } catch (error) {
        // 从 pending resolvers 中移除
        const resolverIndex = this.pendingResolvers.indexOf(resolver);
        if (resolverIndex > -1) {
          this.pendingResolvers.splice(resolverIndex, 1);
        }
        reject(error);
      }
    });
  }

  /**
   * 停止播放（但不中断流的接收和缓存）
   */
  stopPlayback(): void {
    // 立即停止所有活跃的音频源节点
    this.activeSourceNodes.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // 忽略已经停止的节点
      }
    });
    this.activeSourceNodes = [];
    
    // Reject 所有等待中的 Promise
    this.pendingResolvers.forEach(({ reject }) => {
      reject(new Error('Playback stopped by user'));
    });
    this.pendingResolvers = [];
    
    // 重置时间
    this.nextStartTime = 0;
  }

  /**
   * 完全停止（包括流的接收）
   */
  stop(): void {
    this.isPlaying = false;
    this.stopPlayback();
  }

  /**
   * 设置音量（实时生效）
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.value = this.volume;
  }

  /**
   * 关闭音频上下文
   */
  async close(): Promise<void> {
    this.stop();
    await this.audioContext.close();
  }
}


