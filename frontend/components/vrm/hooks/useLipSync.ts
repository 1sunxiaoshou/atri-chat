import { VRM } from '@pixiv/three-vrm';
import { useEffect, useRef } from 'react';

interface LipSyncController {
    update: (delta: number) => void;
    setAudioData: (data: Uint8Array | null) => void;
    cleanup: () => void;
}

/**
 * 全局 AudioContext 管理器
 * 确保每个 audioElement 只创建一次 MediaElementSourceNode
 */
class GlobalAudioContextManager {
    private static contexts = new WeakMap<HTMLAudioElement, {
        context: AudioContext;
        analyser: AnalyserNode;
        source: MediaElementAudioSourceNode;
    }>();

    static getOrCreate(audioElement: HTMLAudioElement) {
        // 如果已经存在，直接返回
        if (this.contexts.has(audioElement)) {
            return this.contexts.get(audioElement)!;
        }

        // 创建新的 AudioContext
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;

        const source = context.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(context.destination);

        const result = { context, analyser, source };
        this.contexts.set(audioElement, result);

        return result;
    }

    static cleanup(audioElement: HTMLAudioElement) {
        const entry = this.contexts.get(audioElement);
        if (entry) {
            entry.context.close();
            this.contexts.delete(audioElement);
        }
    }
}

/**
 * 口型同步 Hook
 * 基于 Web Audio API 实时分析音频并驱动口型
 * 
 * @param vrm - VRM 实例
 * @param audioElement - 音频元素（可选）
 * @param enabled - 是否启用口型同步
 * @returns 控制器引用
 */
export function useLipSync(
    vrm: VRM | null,
    audioElement?: HTMLAudioElement | null,
    enabled: boolean = true
) {
    const controllerRef = useRef<LipSyncController | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioDataRef = useRef<Uint8Array | null>(null);
    const smoothedVolumeRef = useRef(0);
    const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!vrm || !enabled) {
            analyserRef.current = null;
            audioDataRef.current = null;
            currentAudioElementRef.current = null;
            controllerRef.current = null;
            return;
        }

        // 初始化 Web Audio API
        if (audioElement) {
            try {
                // 使用全局管理器获取或创建 AudioContext
                const { analyser } = GlobalAudioContextManager.getOrCreate(audioElement);

                analyserRef.current = analyser;
                audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
                currentAudioElementRef.current = audioElement;
            } catch (error) {
                console.error('[useLipSync] Failed to initialize audio context:', error);
            }
        }

        // 创建控制器
        controllerRef.current = {
            update: (_delta: number) => {
                if (!vrm.expressionManager) {return;}

                let volume = 0;

                // 从音频分析器获取音量
                if (analyserRef.current && audioDataRef.current) {
                    // 类型断言以解决 ArrayBuffer 兼容性问题
                    analyserRef.current.getByteFrequencyData(audioDataRef.current as Uint8Array<ArrayBuffer>);

                    // 计算平均音量
                    const sum = audioDataRef.current.reduce((a, b) => a + b, 0);
                    volume = sum / audioDataRef.current.length / 255;
                }

                // 平滑处理，避免抖动
                const smoothingFactor = 0.3;
                smoothedVolumeRef.current =
                    smoothedVolumeRef.current * (1 - smoothingFactor) +
                    volume * smoothingFactor;

                // 映射到口型表情（aa = 张嘴）
                const mouthValue = Math.min(smoothedVolumeRef.current * 2, 1);
                vrm.expressionManager.setValue('aa', mouthValue);
            },

            setAudioData: (data: Uint8Array | null) => {
                audioDataRef.current = data as Uint8Array<ArrayBuffer> | null;
            },

            cleanup: () => {
                // 不在这里清理 AudioContext，因为它是全局共享的
                analyserRef.current = null;
                audioDataRef.current = null;
            },
        };

        return () => {
            analyserRef.current = null;
            audioDataRef.current = null;
            currentAudioElementRef.current = null;
            controllerRef.current?.cleanup();
            // 注意：不清理 AudioContext，因为它可能被其他组件使用
        };
    }, [vrm, audioElement, enabled]);

    return controllerRef;
}
