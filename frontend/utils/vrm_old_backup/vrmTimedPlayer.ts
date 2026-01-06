/**
 * VRM 定时播放器
 * 负责根据时间戳同步播放音频、动作和表情
 */
import { VRMLoader } from './vrmLoader.js';
import { StreamTTSPlayer } from './streamTTSPlayer';
import { TIME_CONVERSION, AUDIO_PLAYBACK } from './constants';
import { Logger } from './logger';

export interface AudioSegment {
    sentence_index: number;
    text: string;
    marked_text: string;
    audio_url?: string;
    duration: number;
    start_time: number;
    end_time: number;
    markups: TimedMarkup[];
}

export interface TimedMarkup {
    type: 'state' | 'action';
    value: string;
    timestamp: number;
}

export class VRMTimedPlayer {
    private loader: VRMLoader;
    private streamPlayer: StreamTTSPlayer;
    private segments: AudioSegment[] = [];
    private isPlaying = false;
    private startTime = 0;

    // 音频管理
    private audioContext: AudioContext | null = null;
    private currentAudioSource: AudioBufferSourceNode | null = null;
    private analyser: AnalyserNode | null = null;

    // 状态回调
    private onTextUpdate?: (text: string) => void;

    constructor(loader: VRMLoader, streamPlayer: StreamTTSPlayer, onTextUpdate?: (text: string) => void) {
        this.loader = loader;
        this.streamPlayer = streamPlayer;
        this.onTextUpdate = onTextUpdate;

        // 初始化音频上下文
        this.initAudioContext();

        // 绑定口型同步循环
        this.syncLipLoop();
    }

    /**
     * 初始化音频上下文
     */
    private initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // 创建音频分析器用于口型同步
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 1024; // 提高精度
            this.analyser.smoothingTimeConstant = 0.8; // 平滑处理
            
            Logger.debug('音频上下文初始化成功', {
                fftSize: this.analyser.fftSize,
                sampleRate: this.audioContext.sampleRate
            });
        } catch (error) {
            Logger.error('音频上下文初始化失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 设置音频片段列表（通常由后端返回）
     * 会清空之前的片段并重新设置
     */
    setSegments(segments: AudioSegment[]) {
        // 停止当前播放
        if (this.isPlaying) {
            this.stop();
        }
        
        // 清空旧片段，设置新片段
        this.segments = segments;
        Logger.debug(`设置新的音频片段列表，共 ${segments.length} 个片段`);
    }

    /**
     * 追加音频片段（用于流式接收）
     */
    appendSegment(segment: AudioSegment) {
        this.segments.push(segment);
        
        // 如果当前没有播放，自动开始播放
        if (!this.isPlaying && this.segments.length === 1) {
            Logger.debug('收到第一个音频段，开始播放');
            this.play();
        }
    }

    /**
     * 开始播放
     */
    async play() {
        if (this.segments.length === 0) {
            Logger.warn('没有音频片段可播放');
            return;
        }

        // 如果已经在播放，不重复启动
        if (this.isPlaying) {
            Logger.debug('已经在播放中，忽略重复调用');
            return;
        }

        this.isPlaying = true;
        this.startTime = Date.now();

        // 重置触发标记记录
        this.triggeredMarkups.clear();

        // 启动标记触发循环
        this.monitoringLoop();

        Logger.info(`开始播放VRM音频，共 ${this.segments.length} 个片段`);

        // 逐个播放音频片段
        for (let i = 0; i < this.segments.length; i++) {
            if (!this.isPlaying) {break;}

            const segment = this.segments[i];
            if (!segment) {continue;}

            // 更新字幕
            if (this.onTextUpdate) {this.onTextUpdate(segment.text);}

            // 播放音频
            if (segment.audio_url) {
                try {
                    await this.playAudioSegment(segment);
                } catch (error) {
                    Logger.error('音频播放失败', error instanceof Error ? error : undefined, { segment });
                    // 降级：只显示文本，继续播放下一段
                    await new Promise(resolve => setTimeout(resolve, segment.duration * TIME_CONVERSION.MS_PER_SECOND));
                }
            } else {
                // 没有音频URL，按时长等待
                await new Promise(resolve => setTimeout(resolve, segment.duration * TIME_CONVERSION.MS_PER_SECOND));
            }
        }

        // 播放完成，清理状态
        this.isPlaying = false;
        this.segments = []; // 清空片段列表，为下次播放做准备
        
        // 恢复默认状态
        this.loader.setExpression('neutral');
        if (this.onTextUpdate) {this.onTextUpdate('');}
        
        Logger.info('VRM音频播放完成，已清空片段列表');
    }

    /**
     * 播放单个音频片段
     */
    private async playAudioSegment(segment: AudioSegment): Promise<void> {
        if (!this.audioContext) {
            throw new Error('音频上下文未初始化');
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
                    duration: segment.duration,
                    url: segment.audio_url
                });
                
                // 设置超时保护
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
                }, (segment.duration * TIME_CONVERSION.MS_PER_SECOND) + AUDIO_PLAYBACK.TIMEOUT_BUFFER);

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
     * 监控循环：检查时间戳并触发动作
     */
    private monitoringLoop() {
        if (!this.isPlaying) {return;}

        const now = Date.now();
        const elapsed = (now - this.startTime) / TIME_CONVERSION.MS_PER_SECOND; // 秒

        // 检查所有标记是否需要触发
        this.segments.forEach(segment => {
            segment.markups.forEach(markup => {
                // 检查是否到了触发时间（允许50ms误差）
                const timeDiff = Math.abs(elapsed - markup.timestamp);
                if (timeDiff <= 0.05 && !this.triggeredMarkups.has(markup)) {
                    this.triggerMarkup(markup);
                    this.triggeredMarkups.add(markup);
                }
            });
        });

        if (this.isPlaying) {
            requestAnimationFrame(() => this.monitoringLoop());
        }
    }

    private triggeredMarkups = new Set<TimedMarkup>();

    /**
     * 触发标记
     */
    private triggerMarkup(markup: TimedMarkup) {
        if (markup.type === 'state') {
            // 触发表情变化
            Logger.info(`⏰ 触发表情标记: ${markup.value} @ ${markup.timestamp.toFixed(2)}s`, {
                type: 'state',
                expression: markup.value,
                timestamp: markup.timestamp
            });
            this.loader.setExpression(markup.value);
        } else if (markup.type === 'action') {
            // 触发动作（非循环）
            Logger.info(`⏰ 触发动作标记: ${markup.value} @ ${markup.timestamp.toFixed(2)}s`, {
                type: 'action',
                animation: markup.value,
                timestamp: markup.timestamp,
                loop: false
            });
            this.loader.playAnimation(markup.value, false);
        }
    }

    /**
     * 口型同步循环
     */
    private syncLipLoop() {
        // 优先使用自己的分析器（VRM模式）
        const analyser = this.analyser || this.streamPlayer.getAnalyser();
        
        if (analyser && this.isPlaying) {
            // 使用时域数据计算RMS音量（更准确）
            const bufferLength = analyser.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            // 计算RMS音量
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const normalized = (dataArray[i]! - 128) / 128; // 转换到 -1 到 1
                sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / bufferLength);
            
            // 增加敏感度
            const volume = Math.min(rms * 3.0, 1.0);

            this.loader.updateLipSync(volume);
        } else if (!this.isPlaying) {
            // 不在播放时，逐渐减少口型值
            this.loader.updateLipSync(0);
        }

        requestAnimationFrame(() => this.syncLipLoop());
    }

    public stop() {
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
        
        // 重置触发标记记录
        this.triggeredMarkups.clear();
        
        // 恢复默认状态
        this.loader.setExpression('neutral');
        if (this.onTextUpdate) {
            this.onTextUpdate('');
        }
        
        this.streamPlayer.onStop();
    }

    /**
     * 销毁资源
     */
    public dispose() {
        this.stop();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        Logger.debug('VRM播放器资源已清理');
    }
}
