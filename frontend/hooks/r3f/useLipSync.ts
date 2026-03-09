import { VRM } from '@pixiv/three-vrm';
import { useEffect, useRef } from 'react';

interface LipSyncController {
    update: (delta: number) => void;
    setAudioData: (data: Uint8Array | null) => void;
    cleanup: () => void;
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
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioDataRef = useRef<Uint8Array | null>(null);
    const smoothedVolumeRef = useRef(0);
    const connectedAudioElementRef = useRef<HTMLAudioElement | null>(null); // 追踪已连接的 audio 元素

    useEffect(() => {
        if (!vrm || !enabled) {
            // 清理现有的 AudioContext
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            analyserRef.current = null;
            audioDataRef.current = null;
            connectedAudioElementRef.current = null;
            controllerRef.current = null;
            return;
        }

        // 初始化 Web Audio API
        // 只有当 audioElement 存在且与之前连接的不同时才创建新的连接
        if (audioElement && audioElement !== connectedAudioElementRef.current) {
            try {
                // 清理旧的 AudioContext
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }

                const audioContext = new AudioContext();
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;

                const source = audioContext.createMediaElementSource(audioElement);
                source.connect(analyser);
                analyser.connect(audioContext.destination);

                audioContextRef.current = audioContext;
                analyserRef.current = analyser;
                audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
                connectedAudioElementRef.current = audioElement; // 记录已连接的元素
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
            }
        }

        // 创建控制器
        controllerRef.current = {
            update: (_delta: number) => {
                if (!vrm.expressionManager) return;

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
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
                analyserRef.current = null;
                audioDataRef.current = null;
            },
        };

        return () => {
            if (audioContextRef.current) {
                console.log('[useLipSync] Cleaning up AudioContext');
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            analyserRef.current = null;
            audioDataRef.current = null;
            connectedAudioElementRef.current = null;
            controllerRef.current?.cleanup();
        };
    }, [vrm, audioElement, enabled]);

    return controllerRef;
}
