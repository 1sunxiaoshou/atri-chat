/**
 * PlaybackManager - 播放控制管理器
 * 
 * 职责：
 * 1. 音频播放控制
 * 2. 标记触发（表情、动作）
 * 3. 口型同步
 * 4. 字幕更新
 */
import { ModelManager } from '../model/modelManager';
import { AudioSegment, ParsedAudioSegment, TimedMarkup, parseMarkedText } from '../types';
import { Logger } from '../../logger';

export class PlaybackManager {
  private segments: ParsedAudioSegment[] = [];
  private isPlaying = false;

  // 音频管理
  private audioContext: AudioContext | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  constructor(
    private modelManager: ModelManager,
    private onTextUpdate?: (text: string) => void
  ) {
    this.initAudioContext();
    this.syncLipLoop();
    Logger.debug('PlaybackManager: 初始化播放管理器');
  }

  /**
   * 初始化音频上下文
   */
  private initAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 创建音频分析器用于口型同步
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;

      Logger.debug('音频上下文初始化成功', {
        fftSize: this.analyser.fftSize,
        sampleRate: this.audioContext.sampleRate
      });
    } catch (error) {
      Logger.error('音频上下文初始化失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 解析原始音频段为内部格式
   */
  private parseSegment(segment: AudioSegment): ParsedAudioSegment {
    const { text, markups } = parseMarkedText(segment.marked_text);
    return {
      sentence_index: segment.sentence_index,
      text,
      marked_text: segment.marked_text,
      audio_url: segment.audio_url,
      markups
    };
  }

  /**
   * 设置音频片段列表（批量模式）
   */
  setSegments(segments: AudioSegment[]): void {
    if (this.isPlaying) {
      this.stop();
    }

    this.segments = segments.map(s => this.parseSegment(s));
    Logger.debug(`设置新的音频片段列表，共 ${segments.length} 个片段`);
  }

  /**
   * 追加音频片段（流式模式）
   */
  appendSegment(segment: AudioSegment): void {
    const parsed = this.parseSegment(segment);
    this.segments.push(parsed);

    // 如果当前没有播放，自动开始播放
    if (!this.isPlaying && this.segments.length === 1) {
      Logger.debug('收到第一个音频段，开始播放');
      this.play();
    }
  }

  /**
   * 开始播放
   */
  async play(): Promise<void> {
    if (this.segments.length === 0) {
      Logger.warn('没有音频片段可播放');
      return;
    }

    if (this.isPlaying) {
      Logger.debug('已经在播放中，忽略重复调用');
      return;
    }

    this.isPlaying = true;

    Logger.debug(`PlaybackManager: 开始播放 ${this.segments.length} 个音频片段`);

    // 逐个播放音频片段
    for (let i = 0; i < this.segments.length; i++) {
      if (!this.isPlaying) {
        break;
      }

      const segment = this.segments[i];
      if (!segment) {
        continue;
      }

      // 触发标记（表情、动作）
      this.triggerMarkups(segment.markups);

      // 更新字幕（如果有文本）
      if (this.onTextUpdate && segment.text) {
        this.onTextUpdate(segment.text);
      }

      // 播放音频（如果有音频 URL）
      if (segment.audio_url) {
        try {
          await this.playAudioSegment(segment);
        } catch (error) {
          Logger.error('音频播放失败', error instanceof Error ? error : undefined, { 
            index: segment.sentence_index 
          });
          // 降级：等待一小段时间后继续
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        // 没有音频，只有动作标记，等待一小段时间让动作播放
        Logger.debug(`段 ${segment.sentence_index} 仅包含标记，无音频`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 播放完成，清理状态
    this.isPlaying = false;
    this.segments = [];

    // 不再自动重置表情，由AI通过标记控制
    // this.modelManager.setExpression('neutral');
    
    if (this.onTextUpdate) {
      this.onTextUpdate('');
    }

    Logger.debug('PlaybackManager: VRM音频播放完成');
  }

  /**
   * 播放单个音频片段
   */
  private async playAudioSegment(segment: ParsedAudioSegment): Promise<void> {
    if (!this.audioContext) {
      throw new Error('音频上下文未初始化');
    }

    if (!segment.audio_url) {
      throw new Error('音频 URL 为空');
    }

    return new Promise(async (resolve, reject) => {
      try {
        // 停止之前的音频
        if (this.currentAudioSource) {
          try {
            this.currentAudioSource.stop();
          } catch (e) {
            // 忽略已经停止的错误
          }
          this.currentAudioSource = null;
        }

        // 获取音频数据
        const response = await fetch(segment.audio_url!);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // 解码音频
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

        // 创建音频源
        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        this.currentAudioSource = source;

        // 连接到分析器和输出（用于口型同步）
        if (this.analyser) {
          source.connect(this.analyser);
          this.analyser.connect(this.audioContext!.destination);
        } else {
          source.connect(this.audioContext!.destination);
        }

        // 播放完成回调
        source.onended = () => {
          if (this.currentAudioSource === source) {
            this.currentAudioSource = null;
          }
          resolve();
        };

        // 检查是否还在播放状态
        if (!this.isPlaying) {
          reject(new Error('播放已停止'));
          return;
        }

        // 开始播放
        source.start();

        Logger.debug(`开始播放音频段: ${segment.sentence_index}`, {
          text: segment.text,
          url: segment.audio_url
        });

        // 设置超时保护（音频时长 + 5秒缓冲）
        const duration = audioBuffer.duration;
        const timeoutId = setTimeout(() => {
          if (this.currentAudioSource === source) {
            try {
              source.stop();
            } catch (e) {
              // 忽略已经停止的错误
            }
            this.currentAudioSource = null;
          }
          resolve();
        }, (duration * 1000) + 5000);

        // 清理超时
        source.addEventListener('ended', () => {
          clearTimeout(timeoutId);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 触发标记（表情、动作）
   */
  private triggerMarkups(markups: TimedMarkup[]): void {
    Logger.info(`触发标记数量: ${markups.length}`, { markups });
    
    for (const markup of markups) {
      if (markup.type === 'state') {
        Logger.info(`触发表情: ${markup.value}`);
        this.modelManager.setExpression(markup.value);
      } else if (markup.type === 'action') {
        Logger.info(`触发动作: ${markup.value}`);
        this.modelManager.playAnimation(markup.value, false);
      }
    }
  }

  /**
   * 口型同步循环
   */
  private syncLipLoop(): void {
    const analyser = this.analyser;

    if (analyser && this.isPlaying) {
      // 使用时域数据计算RMS音量
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i]! - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);

      // 增加敏感度
      const volume = Math.min(rms * 3.0, 1.0);

      this.modelManager.updateLipSync(volume);
    } else if (!this.isPlaying) {
      // 不在播放时，逐渐减少口型值
      this.modelManager.updateLipSync(0);
    }

    requestAnimationFrame(() => this.syncLipLoop());
  }

  /**
   * 停止播放
   */
  stop(): void {
    Logger.debug('停止VRM播放');

    this.isPlaying = false;

    // 停止当前音频
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch (e) {
        // 忽略已经停止的错误
      }
      this.currentAudioSource = null;
    }

    // 清空段队列
    this.segments = [];

    // 不再自动重置表情，由AI通过标记控制
    // this.modelManager.setExpression('neutral');
    
    if (this.onTextUpdate) {
      this.onTextUpdate('');
    }
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    Logger.debug('PlaybackManager: 销毁播放管理器');

    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    Logger.debug('PlaybackManager: 播放管理器已销毁');
  }
}
