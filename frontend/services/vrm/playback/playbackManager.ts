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
import { AudioSegment, ParsedAudioSegment, TimedMarkup, parseMarkedText } from '../../../types/vrm';
import { Logger } from '../../../utils/logger';

export class PlaybackManager {
  // 常量配置
  private static readonly FALLBACK_DELAY_MS = 1000;
  private static readonly MARKUP_ONLY_DELAY_MS = 500;

  private segments: ParsedAudioSegment[] = [];
  private isPlaying = false;
  private savedExpression: string | null = null; // 保存说话前的表情

  // 音频管理
  private audioContext: AudioContext | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  // 音频缓存（预加载优化）
  private audioCache: Map<string, AudioBuffer> = new Map();

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

    // 预加载音频（异步，不阻塞）
    if (parsed.audio_url) {
      this.prepareAudio(parsed.audio_url).catch(error => {
        Logger.warn('音频预加载失败', error instanceof Error ? error : undefined);
      });
    }

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

    // 保存当前表情并切换到默认表情
    this.savedExpression = this.modelManager.getCurrentExpression();
    if (this.savedExpression && this.savedExpression !== 'neutral') {
      Logger.debug(`保存当前表情: ${this.savedExpression}，切换到 neutral`);
      this.modelManager.setExpression('neutral');
    }

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

      // 播放音频（如果有音频 URL）
      // 注意：标记和字幕的触发已移到 playAudioSegment 内部，确保与音频同步
      if (segment.audio_url) {
        try {
          await this.playAudioSegment(segment);
        } catch (error) {
          Logger.error('音频播放失败', error instanceof Error ? error : undefined, { 
            index: segment.sentence_index 
          });
          // 降级：手动触发标记和字幕
          this.triggerMarkups(segment.markups);
          if (this.onTextUpdate && segment.text) {
            this.onTextUpdate(segment.text);
          }
          // 等待一小段时间后继续
          await new Promise(resolve => setTimeout(resolve, PlaybackManager.FALLBACK_DELAY_MS));
        }
      } else {
        // 没有音频，只有动作标记，立即触发
        Logger.debug(`段 ${segment.sentence_index} 仅包含标记，无音频`);
        this.triggerMarkups(segment.markups);
        if (this.onTextUpdate && segment.text) {
          this.onTextUpdate(segment.text);
        }
        await new Promise(resolve => setTimeout(resolve, PlaybackManager.MARKUP_ONLY_DELAY_MS));
      }
    }

    // 播放完成，恢复之前的表情
    this.restoreSavedExpression();

    // 清理状态
    this.isPlaying = false;
    this.segments = [];
    this.clearAudioCache();
    
    if (this.onTextUpdate) {
      this.onTextUpdate('');
    }

    Logger.debug('PlaybackManager: VRM音频播放完成');
  }

  /**
   * 清空音频缓存
   */
  private clearAudioCache(): void {
    if (this.audioCache.size > 0) {
      Logger.debug(`清空音频缓存，共 ${this.audioCache.size} 个`);
      this.audioCache.clear();
    }
  }

  /**
   * 预加载音频（不播放）
   */
  private async prepareAudio(audioUrl: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('音频上下文未初始化');
    }

    // 检查缓存（仅在当前播放会话内有效）
    if (this.audioCache.has(audioUrl)) {
      Logger.debug('使用缓存的音频', { url: audioUrl });
      return this.audioCache.get(audioUrl)!;
    }

    // 获取音频数据
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // 解码音频
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // 缓存音频（仅用于当前播放会话）
    this.audioCache.set(audioUrl, audioBuffer);

    Logger.debug('音频预加载完成', { url: audioUrl, duration: audioBuffer.duration });

    return audioBuffer;
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

    // 停止之前的音频
    this.stopCurrentAudio();

    try {
      // 预加载并解码音频（在触发标记前完成）
      const audioBuffer = await this.prepareAudio(segment.audio_url);

      // 检查是否还在播放状态
      if (!this.isPlaying) {
        throw new Error('播放已停止');
      }

      // 音频准备完成，触发标记和字幕（确保同步）
      this.triggerMarkups(segment.markups);
      if (this.onTextUpdate && segment.text) {
        this.onTextUpdate(segment.text);
      }

      // 播放音频
      await this.playAudioBuffer(audioBuffer, segment);

    } catch (error) {
      throw error;
    }
  }

  /**
   * 停止当前音频
   */
  private stopCurrentAudio(): void {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch (e) {
        // 忽略已经停止的错误
      }
      this.currentAudioSource = null;
    }
  }

  /**
   * 播放音频缓冲区
   */
  private playAudioBuffer(audioBuffer: AudioBuffer, segment: ParsedAudioSegment): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error('音频上下文未初始化'));
        return;
      }

      // 创建音频源
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      this.currentAudioSource = source;

      // 连接到分析器和输出（用于口型同步）
      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } else {
        source.connect(this.audioContext.destination);
      }

      // 播放完成回调
      source.onended = () => {
        if (this.currentAudioSource === source) {
          this.currentAudioSource = null;
        }
        resolve();
      };

      // 立即开始播放（与标记、字幕同步）
      source.start();

      Logger.debug(`同步播放音频段: ${segment.sentence_index}`, {
        text: segment.text,
        duration: audioBuffer.duration
      });

      // 设置超时保护（音频时长 + 5秒缓冲）
      const TIMEOUT_BUFFER = 5000;
      const timeoutId = setTimeout(() => {
        if (this.currentAudioSource === source) {
          this.stopCurrentAudio();
        }
        resolve();
      }, (audioBuffer.duration * 1000) + TIMEOUT_BUFFER);

      // 清理超时
      source.addEventListener('ended', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * 触发标记（表情、动作）
   */
  private triggerMarkups(markups: TimedMarkup[]): void {
    Logger.info(`触发标记数量: ${markups.length}`, { markups });
    
    let hasExpressionMarkup = false;
    
    for (const markup of markups) {
      if (markup.type === 'state') {
        Logger.info(`触发表情: ${markup.value}`);
        this.modelManager.setExpression(markup.value);
        hasExpressionMarkup = true;
      } else if (markup.type === 'action') {
        Logger.info(`触发动作: ${markup.value}`);
        this.modelManager.playAnimation(markup.value, false);
      }
    }
    
    // 如果这个片段包含表情标记，清除保存的表情
    // 这样播放结束后就不会恢复到旧表情
    if (hasExpressionMarkup) {
      this.savedExpression = null;
    }
  }

  /**
   * 口型同步循环
   */
  private syncLipLoop(): void {
    const update = () => {
      if (!this.analyser) {
        requestAnimationFrame(update);
        return;
      }

      if (this.isPlaying && this.currentAudioSource) {
        // 使用时域数据计算RMS音量
        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i]! - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);

        // 增加敏感度
        const volume = Math.min(rms * 3.0, 1.0);

        this.modelManager.updateLipSync(volume);
      } else {
        // 不在播放时，重置口型
        this.modelManager.updateLipSync(0);
      }

      requestAnimationFrame(update);
    };

    update();
  }

  /**
   * 停止播放
   */
  stop(): void {
    Logger.debug('停止VRM播放');

    this.isPlaying = false;

    // 停止当前音频
    this.stopCurrentAudio();

    // 清空段队列
    this.segments = [];

    // 清空音频缓存
    this.clearAudioCache();

    // 恢复之前的表情（如果有）
    this.restoreSavedExpression();
    
    if (this.onTextUpdate) {
      this.onTextUpdate('');
    }
  }

  /**
   * 恢复保存的表情
   */
  private restoreSavedExpression(): void {
    if (this.savedExpression && this.savedExpression !== 'neutral') {
      Logger.debug(`恢复之前的表情: ${this.savedExpression}`);
      this.modelManager.setExpression(this.savedExpression);
    }
    this.savedExpression = null;
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    Logger.debug('PlaybackManager: 销毁播放管理器');

    this.stop();

    // 清空音频缓存
    this.audioCache.clear();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    Logger.debug('PlaybackManager: 播放管理器已销毁');
  }
}
