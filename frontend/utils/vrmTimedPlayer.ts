/**
 * VRM 定时播放器
 * 负责根据时间戳同步播放音频、动作和表情
 */
import { VRMLoader } from './vrmLoader';
import { StreamTTSPlayer } from './streamTTSPlayer';

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

    // 状态回调
    private onTextUpdate?: (text: string) => void;

    constructor(loader: VRMLoader, streamPlayer: StreamTTSPlayer, onTextUpdate?: (text: string) => void) {
        this.loader = loader;
        this.streamPlayer = streamPlayer;
        this.onTextUpdate = onTextUpdate;

        // 绑定口型同步循环
        this.syncLipLoop();
    }

    /**
     * 设置音频片段列表（通常由后端返回）
     */
    setSegments(segments: AudioSegment[]) {
        this.segments = segments;
    }

    /**
     * 开始播放
     */
    async play() {
        if (this.segments.length === 0) return;

        this.isPlaying = true;
        this.startTime = Date.now();

        // 启动标记触发循环
        this.monitoringLoop();

        // 逐个播放音频片段
        for (const segment of this.segments) {
            if (!this.isPlaying) break;

            // 更新字幕
            if (this.onTextUpdate) this.onTextUpdate(segment.text);

            // 播放音频
            if (segment.audio_url) {
                try {
                    await this.playAudioSegment(segment);
                } catch (error) {
                    console.error('音频播放失败:', error);
                    // 降级：只显示文本，继续播放下一段
                    await new Promise(resolve => setTimeout(resolve, segment.duration * 1000));
                }
            } else {
                // 没有音频URL，按时长等待
                await new Promise(resolve => setTimeout(resolve, segment.duration * 1000));
            }
        }

        this.isPlaying = false;
        // 恢复默认状态
        this.loader.setExpression('neutral');
        if (this.onTextUpdate) this.onTextUpdate('');
    }

    /**
     * 播放单个音频片段
     */
    private async playAudioSegment(segment: AudioSegment): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // 获取音频数据
                const response = await fetch(segment.audio_url!);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                
                // 解码音频
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // 创建音频源
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                // 连接到输出
                source.connect(audioContext.destination);
                
                // 播放完成回调
                source.onended = () => {
                    resolve();
                };
                
                // 开始播放
                source.start();
                
                // 设置超时保护
                setTimeout(() => {
                    source.stop();
                    resolve();
                }, (segment.duration + 1) * 1000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 监控循环：检查时间戳并触发动作
     */
    private monitoringLoop() {
        if (!this.isPlaying) return;

        const now = Date.now();
        const elapsed = (now - this.startTime) / 1000; // 秒

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
            this.loader.setExpression(markup.value);
        } else if (markup.type === 'action') {
            // 触发动作
            this.loader.playAction(markup.value);
        }
        
        console.log(`触发标记: [${markup.type}:${markup.value}] @ ${markup.timestamp.toFixed(2)}s`);
    }

    /**
     * 口型同步循环
     */
    private syncLipLoop() {
        const analyser = this.streamPlayer.getAnalyser();
        if (analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            // 计算平均音量
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const volume = average / 255; // 0.0 - 1.0

            this.loader.updateLipSync(volume);
        }

        requestAnimationFrame(() => this.syncLipLoop());
    }

    public stop() {
        this.isPlaying = false;
        this.streamPlayer.onStop();
    }
}
