/**
 * VRM 动作平滑过渡管理器
 * 实现动作之间的淡入淡出效果，避免切换时的突兀感
 */

import * as THREE from 'three';
import { TIME_CONVERSION } from './constants';

export class AnimationTransitionManager {
    private mixer: THREE.AnimationMixer;
    private currentAction: THREE.AnimationAction | null = null;
    private defaultTransitionDuration: number = 0.5; // 默认过渡时间（秒）

    constructor(mixer: THREE.AnimationMixer) {
        this.mixer = mixer;
    }

    /**
     * 播放动作并进行平滑过渡
     * @param clip - 要播放的动画剪辑
     * @param options - 配置选项
     * @returns 返回新的动作对象
     */
    playWithTransition(clip: THREE.AnimationClip, options: {
        transitionDuration?: number;
        loop?: boolean;
        timeScale?: number;
        startTime?: number;
    } = {}): THREE.AnimationAction {
        // 验证输入
        if (!clip) {
            throw new Error('AnimationClip不能为空');
        }

        if (!clip.tracks || clip.tracks.length === 0) {
            throw new Error(`AnimationClip "${clip.name}" 没有有效的轨道数据`);
        }

        const {
            transitionDuration = this.defaultTransitionDuration,
            loop = true,
            timeScale = 1.0,
            startTime = 0
        } = options;

        // 创建新动作
        const newAction = this.mixer.clipAction(clip);
        
        if (!newAction) {
            throw new Error(`无法创建AnimationAction for clip "${clip.name}"`);
        }
        
        // 设置循环模式
        try {
            if (loop) {
                newAction.setLoop(THREE.LoopRepeat, Infinity);
            } else {
                newAction.setLoop(THREE.LoopOnce, 1);
                newAction.clampWhenFinished = true;
            }
        } catch (error) {
            console.error('设置循环模式失败:', error);
            // 降级处理：使用默认设置
        }
        
        newAction.timeScale = timeScale;
        newAction.time = startTime;

        // 如果有当前动作，进行淡出
        if (this.currentAction && this.currentAction !== newAction) {
            // 当前动作淡出
            this.currentAction.fadeOut(transitionDuration);
            
            // 新动作淡入
            newAction.reset();
            newAction.fadeIn(transitionDuration);
            newAction.play();
        } else {
            // 没有当前动作，直接播放
            newAction.reset();
            newAction.fadeIn(transitionDuration);
            newAction.play();
        }

        this.currentAction = newAction;
        return newAction;
    }

    /**
     * 交叉淡入淡出过渡（更平滑的过渡效果）
     * @param clip - 要播放的动画剪辑
     * @param duration - 过渡时间（秒）
     * @returns 返回新的动作对象
     */
    crossFade(clip: THREE.AnimationClip, duration: number = this.defaultTransitionDuration): THREE.AnimationAction {
        const newAction = this.mixer.clipAction(clip);
        
        if (this.currentAction && this.currentAction !== newAction) {
            // 同步权重过渡
            newAction.reset();
            newAction.setEffectiveTimeScale(1);
            newAction.setEffectiveWeight(1);
            newAction.play();
            
            // 使用 crossFadeTo 实现更平滑的过渡
            this.currentAction.crossFadeTo(newAction, duration, true);
        } else {
            newAction.reset();
            newAction.play();
        }

        this.currentAction = newAction;
        return newAction;
    }

    /**
     * 停止当前动作并淡出
     * @param duration - 淡出时间（秒）
     */
    stopWithFadeOut(duration: number = this.defaultTransitionDuration): void {
        if (this.currentAction) {
            this.currentAction.fadeOut(duration);
            setTimeout(() => {
                if (this.currentAction) {
                    this.currentAction.stop();
                }
            }, duration * TIME_CONVERSION.MS_PER_SECOND);
        }
    }

    /**
     * 暂停当前动作
     */
    pause(): void {
        if (this.currentAction) {
            this.currentAction.paused = true;
        }
    }

    /**
     * 恢复当前动作
     */
    resume(): void {
        if (this.currentAction) {
            this.currentAction.paused = false;
        }
    }

    /**
     * 设置播放速度（带平滑过渡）
     * @param speed - 新的播放速度
     * @param duration - 过渡时间（秒）
     */
    setSpeed(speed: number, duration: number = 0.3): void {
        if (!this.currentAction) {return;}

        const startSpeed = this.currentAction.timeScale;
        const startTime = Date.now();
        const endTime = startTime + duration * TIME_CONVERSION.MS_PER_SECOND;

        const updateSpeed = () => {
            const now = Date.now();
            if (now >= endTime) {
                this.currentAction!.timeScale = speed;
                return;
            }

            const progress = (now - startTime) / (duration * TIME_CONVERSION.MS_PER_SECOND);
            const easedProgress = this.easeInOutCubic(progress);
            this.currentAction!.timeScale = startSpeed + (speed - startSpeed) * easedProgress;

            requestAnimationFrame(updateSpeed);
        };

        updateSpeed();
    }

    /**
     * 重置到初始状态
     */
    reset(): void {
        if (this.currentAction) {
            this.currentAction.reset();
            this.currentAction.play();
        }
    }

    /**
     * 停止所有动作
     */
    stopAll(): void {
        this.mixer.stopAllAction();
        this.currentAction = null;
    }

    /**
     * 获取当前动作
     * @returns 当前动作或null
     */
    getCurrentAction(): THREE.AnimationAction | null {
        return this.currentAction;
    }

    /**
     * 检查是否正在播放
     * @returns 是否正在播放
     */
    isPlaying(): boolean {
        return this.currentAction !== null && !this.currentAction.paused;
    }

    /**
     * 缓动函数：三次方缓入缓出
     * @param t - 进度值 (0-1)
     * @returns 缓动后的值
     */
    private easeInOutCubic(t: number): number {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 设置默认过渡时间
     * @param duration - 过渡时间（秒）
     */
    setDefaultTransitionDuration(duration: number): void {
        this.defaultTransitionDuration = duration;
    }
}

/**
 * 创建过渡管理器的便捷函数
 * @param mixer - Three.js 动画混合器
 * @returns AnimationTransitionManager实例
 */
export function createTransitionManager(mixer: THREE.AnimationMixer): AnimationTransitionManager {
    return new AnimationTransitionManager(mixer);
}