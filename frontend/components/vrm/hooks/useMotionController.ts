import { useRef, useEffect, useCallback } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';

interface PlayOptions {
    loop?: boolean;
    fadeDuration?: number; // 过渡时间，默认 0.7秒
    force?: boolean; // 强制重新播放，即使是相同的 URL
}

/**
 * LRU 缓存实现 - 限制缓存大小，防止内存溢出
 */
class LRUCache<K, V> {
    private cache: Map<K, V>;
    private maxSize: number;

    constructor(maxSize: number = 20) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;

        // 移到最后（最近使用）
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: K, value: V): void {
        // 如果已存在，先删除（会重新添加到最后）
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // 如果超过最大容量，删除最旧的（第一个）
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
                console.log(`[MotionController] Evicted oldest motion: ${firstKey}`);
            }
        }

        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

/**
 * 全局动作缓存池：(URL + VRM UUID) -> AnimationClip
 * 使用 LRU 策略，最多缓存 20 个动作文件
 * 注意：AnimationClip 是绑定到特定 VRM 模型的，所以缓存 key 必须包含模型标识
 */
const globalClipCache = new LRUCache<string, THREE.AnimationClip>(20);

/**
 * 纯粹的动作控制器 Hook
 * 
 * 职责：
 * 1. 缓存 (Cache)：加载过的动作存起来，下次秒切
 * 2. 融合 (CrossFade)：提供平滑切换动作的能力
 * 3. 事件 (Events)：告诉上层业务"某个不循环的动作播完了"
 * 
 * 不包含任何业务状态（不知道什么是 Idle，什么是预览）
 */
export function useMotionController(vrm: VRM | null, mixer: THREE.AnimationMixer | null) {
    // 核心状态 Refs (不触发 React 渲染)
    const currentActionRef = useRef<THREE.AnimationAction | null>(null);
    const currentUrlRef = useRef<string | null>(null);
    const loaderRef = useRef<GLTFLoader | null>(null);

    // 记录最新请求播放的 URL，防止连续点击导致的异步竞态问题
    const latestRequestedUrlRef = useRef<string | null>(null);

    // 业务层传入的回调函数：当一个【非循环】动作播完时触发
    const onMotionFinishRef = useRef<((url: string) => void) | null>(null);

    // 过渡状态标记
    const isTransitioningRef = useRef(false);

    // 初始化 GLTFLoader
    useEffect(() => {
        if (!loaderRef.current) {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
            loaderRef.current = loader;
        }
    }, []);

    // ==========================================
    // 核心播放逻辑：带缓存和交叉融合
    // ==========================================
    const play = useCallback(async (url: string, options: PlayOptions = {}) => {
        if (!vrm || !mixer || !loaderRef.current) return;

        const { loop = true, fadeDuration = 0.7, force = false } = options;

        // 避免重复播放同一个动作（除非强制重新播放）
        if (currentUrlRef.current === url && !force) return;

        latestRequestedUrlRef.current = url;

        // 缓存 key = url + vrm.scene.uuid（确保每个模型有独立的缓存）
        const cacheKey = `${url}::${vrm.scene.uuid}`;
        let clip = globalClipCache.get(cacheKey);

        // 1. 如果没缓存，则加载
        if (!clip) {
            try {
                // 临时屏蔽 VRM 动画加载的警告
                const originalWarn = console.warn;
                console.warn = (...args: any[]) => {
                    const message = args[0];
                    if (typeof message === 'string' && (
                        message.includes('specVersion of the VRMA is not defined') ||
                        message.includes('VRMLookAtQuaternionProxy is not found')
                    )) {
                        return; // 忽略这些警告
                    }
                    originalWarn.apply(console, args);
                };

                try {
                    // 使用 GLTFLoader 加载 VRMA 文件
                    const gltf = await loaderRef.current.loadAsync(url);

                    // 加载完成后，如果业务层已经请求了别的动作，则丢弃当前加载
                    if (latestRequestedUrlRef.current !== url) return;

                    // 从 userData 中获取 VRM 动画
                    const vrmAnimations = gltf.userData.vrmAnimations;

                    if (!vrmAnimations || vrmAnimations.length === 0) {
                        console.error('[MotionController] No VRM animations found in file');
                        return;
                    }

                    // 使用第一个动画
                    const vrmAnimation = vrmAnimations[0];

                    // 创建 VRM 动画剪辑
                    clip = createVRMAnimationClip(vrmAnimation, vrm);

                    // 存入缓存（使用 url + vrm.scene.uuid 作为 key）
                    globalClipCache.set(cacheKey, clip);
                } finally {
                    // 恢复原始的 console.warn
                    console.warn = originalWarn;
                }
            } catch (error) {
                console.error('[MotionController] Failed to load motion:', error);
                return;
            }
        }

        if (!clip) return;

        // 2. 创建 Action
        const newAction = mixer.clipAction(clip);

        if (loop) {
            newAction.setLoop(THREE.LoopRepeat, Infinity);
            newAction.clampWhenFinished = false;
        } else {
            newAction.setLoop(THREE.LoopOnce, 1);
            newAction.clampWhenFinished = true; // 停在最后一帧，防止闪烁
        }

        // 3. 执行平滑过渡 (CrossFade)
        newAction.reset();
        newAction.setEffectiveWeight(1);
        newAction.enabled = true;

        if (currentActionRef.current && currentActionRef.current !== newAction) {
            // 如果正在过渡中，等待完成
            if (isTransitioningRef.current) {
                await new Promise<void>(resolve => {
                    const checkTransition = () => {
                        if (!isTransitioningRef.current) {
                            resolve();
                        } else {
                            setTimeout(checkTransition, 50);
                        }
                    };
                    checkTransition();
                });
            }

            isTransitioningRef.current = true;

            // 将旧动作淡出，新动作淡入
            currentActionRef.current.crossFadeTo(newAction, fadeDuration, false);
            newAction.play();

            // 等待过渡完成
            setTimeout(() => {
                if (currentActionRef.current && currentActionRef.current !== newAction) {
                    // 停止并清理旧动作
                    const oldAction = currentActionRef.current;
                    oldAction.stop();
                    oldAction.enabled = false;

                    // 从混合器中移除旧动作（释放内存）
                    try {
                        const oldClip = oldAction.getClip();
                        if (oldClip && mixer) {
                            mixer.uncacheAction(oldClip);
                        }
                    } catch (error) {
                        // 忽略清理错误
                    }
                }

                // 确保新动作权重为1
                newAction.setEffectiveWeight(1);
                isTransitioningRef.current = false;
            }, fadeDuration * 1000);
        } else {
            // 第一次播放，直接启动
            newAction.play();
        }

        // 4. 更新内部记录
        currentActionRef.current = newAction;
        currentUrlRef.current = url;
    }, [vrm, mixer]);

    // ==========================================
    // 监听动画播放结束事件
    // ==========================================
    useEffect(() => {
        if (!mixer) return;

        const handleFinished = (event: any) => {
            // 确保是当前正在播放的动作结束了 (针对 loop: false 的动作)
            if (event.action === currentActionRef.current && currentUrlRef.current) {
                if (onMotionFinishRef.current) {
                    onMotionFinishRef.current(currentUrlRef.current);
                }
            }
        };

        mixer.addEventListener('finished', handleFinished);
        return () => mixer.removeEventListener('finished', handleFinished);
    }, [mixer]);

    // ==========================================
    // 每帧更新
    // ==========================================
    const update = useCallback((delta: number) => {
        if (mixer) {
            mixer.update(delta);
        }
    }, [mixer]);

    // ==========================================
    // 预加载动作到缓存
    // ==========================================
    const preload = useCallback(async (url: string) => {
        if (!vrm || !loaderRef.current) return;

        const cacheKey = `${url}::${vrm.scene.uuid}`;
        if (globalClipCache.has(cacheKey)) return;

        try {
            const originalWarn = console.warn;
            console.warn = () => { }; // 静默加载

            const gltf = await loaderRef.current.loadAsync(url);
            const vrmAnimations = gltf.userData.vrmAnimations;

            if (vrmAnimations && vrmAnimations.length > 0) {
                const clip = createVRMAnimationClip(vrmAnimations[0], vrm);
                globalClipCache.set(cacheKey, clip);
                console.log(`[MotionController] Preloaded: ${url}`);
            }

            console.warn = originalWarn;
        } catch (error) {
            console.error('[MotionController] Preload failed:', error);
        }
    }, [vrm]);

    // ==========================================
    // 清理
    // ==========================================
    useEffect(() => {
        return () => {
            if (currentActionRef.current) {
                currentActionRef.current.stop();
                currentActionRef.current = null;
            }
            currentUrlRef.current = null;
        };
    }, []);

    // ==========================================
    // 暴露 API 给业务层
    // ==========================================
    return {
        play,
        update,
        // 注册完成回调
        onFinished: (callback: (url: string) => void) => {
            onMotionFinishRef.current = callback;
        },
        // 获取当前播放的 URL (用于 UI 状态同步)
        getCurrentUrl: () => currentUrlRef.current,
        // 预加载动作到缓存
        preload,
        // 获取缓存统计信息
        getCacheStats: () => ({
            size: globalClipCache.size,
            maxSize: 20,
        }),
    };
}

/**
 * 获取全局动作缓存统计信息
 */
export function getMotionCacheStats() {
    return {
        size: globalClipCache.size,
        maxSize: 20,
    };
}
