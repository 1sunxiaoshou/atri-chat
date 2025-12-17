import { VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Logger } from '../../utils/logger';

export enum MotionPresetName {
    Idle = 'idle',
    Wave = 'wave',
    Dance = 'dance',
    Bow = 'bow',
    Clap = 'clap',
    // 可以添加更多预设动作
    Happy = 'happy',
    Sad = 'sad',
    Thinking = 'thinking'
}

/**
 * 动作预设配置
 */
interface MotionPresetConfig {
    url: string;
    name: string;
    loop?: boolean; // 默认是否循环
}

/**
 * 动作控制器 - 管理VRM模型的动作播放和过渡
 * 参考 lobe-vidol 的设计，优化了动画管理和状态控制
 */
export class MotionController {
    private vrm: VRM;
    private mixer: THREE.AnimationMixer;
    private currentAction: THREE.AnimationAction | null = null;
    private currentClip: THREE.AnimationClip | null = null;
    private animationClips: Map<string, THREE.AnimationClip> = new Map();
    private isTransitioning = false;
    private isPlaying = false;

    // 动作预设映射 - 可以根据实际情况配置
    private motionPresets: Map<MotionPresetName, MotionPresetConfig> = new Map([
        [MotionPresetName.Idle, { 
            url: '/animations/idle.vrma', 
            name: 'Idle/Stand',
            loop: true 
        }],
        [MotionPresetName.Wave, { 
            url: '/animations/wave.vrma', 
            name: 'Gesture/Wave',
            loop: false 
        }],
        [MotionPresetName.Dance, { 
            url: '/animations/dance.vrma', 
            name: 'Dance/Basic',
            loop: true 
        }],
        [MotionPresetName.Bow, { 
            url: '/animations/bow.vrma', 
            name: 'Gesture/Bow',
            loop: false 
        }],
        [MotionPresetName.Clap, { 
            url: '/animations/clap.vrma', 
            name: 'Gesture/Clap',
            loop: false 
        }],
        [MotionPresetName.Happy, { 
            url: '/animations/happy.vrma', 
            name: 'Emotion/Happy',
            loop: true 
        }],
        [MotionPresetName.Sad, { 
            url: '/animations/sad.vrma', 
            name: 'Emotion/Sad',
            loop: true 
        }],
        [MotionPresetName.Thinking, { 
            url: '/animations/thinking.vrma', 
            name: 'Emotion/Thinking',
            loop: true 
        }]
    ]);

    constructor(vrm: VRM) {
        this.vrm = vrm;
        this.mixer = new THREE.AnimationMixer(vrm.scene);
        Logger.info('MotionController 初始化完成');
    }

    /**
     * 预加载动作
     */
    public async preloadMotion(motion: MotionPresetName): Promise<void> {
        const config = this.motionPresets.get(motion);
        if (!config) {
            Logger.warn(`未找到动作预设: ${motion}`);
            return;
        }

        try {
            await this.loadAnimationClip(motion, config.url);
            Logger.info(`预加载动作成功: ${motion}`);
        } catch (error) {
            Logger.error(`预加载动作失败: ${motion}`, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 预加载自定义动作URL
     */
    public async preloadMotionUrl(url: string): Promise<void> {
        try {
            await this.loadAnimationClip(url, url);
            Logger.info(`预加载自定义动作成功: ${url}`);
        } catch (error) {
            Logger.error(`预加载自定义动作失败: ${url}`, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 播放预设动作
     */
    public async playMotion(preset: MotionPresetName, loop?: boolean): Promise<void> {
        const config = this.motionPresets.get(preset);
        if (!config) {
            Logger.warn(`未找到动作预设: ${preset}`);
            return;
        }

        // 如果没有指定 loop，使用预设的默认值
        const shouldLoop = loop !== undefined ? loop : (config.loop ?? true);
        await this.playAnimationClip(preset, shouldLoop);
    }

    /**
     * 加载闲置动画（初始姿态）
     * 参考 lobe-vidol 的 loadIdleAnimation 方法
     */
    public async loadIdleAnimation(): Promise<void> {
        Logger.info('加载闲置动画');
        try {
            await this.playMotion(MotionPresetName.Idle, true);
            this.isPlaying = true;
        } catch (error) {
            Logger.error('加载闲置动画失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 重置到闲置状态
     */
    public async resetToIdle(): Promise<void> {
        Logger.info('重置到闲置状态');
        this.stopCurrentMotion();
        await this.loadIdleAnimation();
    }

    /**
     * 播放自定义动作URL
     */
    public async playMotionUrl(url: string, loop: boolean = true): Promise<void> {
        // 如果动画未加载，先加载
        if (!this.animationClips.has(url)) {
            await this.loadAnimationClip(url, url);
        }

        await this.playAnimationClip(url, loop);
    }

    /**
     * 加载动画剪辑
     */
    private async loadAnimationClip(key: string, url: string): Promise<void> {
        if (this.animationClips.has(key)) {
            return; // 已加载
        }

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

        try {
            const gltf = await loader.loadAsync(url);
            const vrmAnimations = gltf.userData.vrmAnimations;

            if (vrmAnimations && vrmAnimations.length > 0) {
                const clip = createVRMAnimationClip(vrmAnimations[0], this.vrm);
                this.animationClips.set(key, clip);
                Logger.info(`动画加载成功: ${key}, 时长: ${clip.duration.toFixed(2)}s`);
            } else {
                throw new Error('未找到VRM动画数据');
            }
        } catch (error) {
            Logger.error(`动画加载失败: ${key}`, error instanceof Error ? error : undefined);
            throw error;
        }
    }

    /**
     * 播放动画剪辑
     * 参考 lobe-vidol 的实现，优化了动画切换逻辑
     */
    private async playAnimationClip(key: string, loop: boolean): Promise<void> {
        const clip = this.animationClips.get(key);
        if (!clip) {
            Logger.warn(`未找到动画剪辑: ${key}`);
            return;
        }

        // 如果正在过渡中，等待过渡完成
        if (this.isTransitioning) {
            await new Promise<void>(resolve => {
                const checkTransition = () => {
                    if (!this.isTransitioning) {
                        resolve();
                    } else {
                        setTimeout(checkTransition, 50);
                    }
                };
                checkTransition();
            });
        }

        // 停止当前动作（参考 lobe-vidol 的 stopMotion）
        if (this.currentAction) {
            this.currentAction.stop();
        }

        // 创建新动作
        const newAction = this.mixer.clipAction(clip);
        newAction.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
        newAction.clampWhenFinished = !loop;

        // 如果有当前动作且不是同一个，进行平滑过渡
        if (this.currentAction && this.currentAction !== newAction) {
            await this.transitionToAction(newAction);
        } else {
            // 直接播放新动作
            newAction.reset().play();
            this.currentAction = newAction;
        }

        this.currentClip = clip;
        this.isPlaying = true;

        Logger.info(`播放动作: ${key}, 循环: ${loop}, 时长: ${clip.duration.toFixed(2)}s`);
    }

    /**
     * 平滑过渡到新动作
     */
    private async transitionToAction(newAction: THREE.AnimationAction, duration: number = 0.5): Promise<void> {
        if (!this.currentAction) {
            newAction.reset().play();
            this.currentAction = newAction;
            return;
        }

        this.isTransitioning = true;

        return new Promise((resolve) => {
            const oldAction = this.currentAction!;

            // 设置新动作
            newAction.reset();
            newAction.setEffectiveWeight(0);
            newAction.play();

            // 开始过渡
            oldAction.crossFadeTo(newAction, duration, true);

            // 过渡完成后的清理
            setTimeout(() => {
                oldAction.stop();
                newAction.setEffectiveWeight(1);
                this.currentAction = newAction;
                this.isTransitioning = false;
                resolve();
            }, duration * 1000);
        });
    }

    /**
     * 停止当前动作
     * 参考 lobe-vidol 的 stopMotion 方法
     */
    public stopCurrentMotion(): void {
        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        if (this.currentAction) {
            this.currentAction.stop();
            this.currentAction = null;
        }

        this.currentClip = null;
        this.isPlaying = false;
        Logger.info('停止当前动作');
    }

    /**
     * 更新动作控制器
     */
    public update(delta: number): void {
        this.mixer.update(delta);
    }

    /**
     * 获取当前动作信息
     */
    public getCurrentMotionInfo(): { name: string; time: number; duration: number; isPlaying: boolean } | null {
        if (!this.currentAction || !this.currentClip) {
            return null;
        }

        return {
            name: this.currentClip.name,
            time: this.currentAction.time,
            duration: this.currentClip.duration,
            isPlaying: this.isPlaying
        };
    }

    /**
     * 检查是否正在播放动作
     */
    public isMotionPlaying(): boolean {
        return this.isPlaying && this.currentAction !== null;
    }

    /**
     * 预加载所有动作
     * 参考 lobe-vidol 的 preloadAllMotions
     */
    public async preloadAllMotions(onProgress?: (loaded: number, total: number) => void): Promise<void> {
        const motions = Array.from(this.motionPresets.keys());
        let loaded = 0;
        const total = motions.length;

        Logger.info(`开始预加载 ${total} 个动作`);

        for (const motion of motions) {
            try {
                await this.preloadMotion(motion);
                loaded++;
                onProgress?.(loaded, total);
            } catch (error) {
                Logger.error(`预加载动作失败: ${motion}`, error instanceof Error ? error : undefined);
            }
        }

        Logger.info(`预加载完成: ${loaded}/${total}`);
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        this.mixer.stopAllAction();
        this.animationClips.clear();
        this.currentAction = null;
        Logger.info('MotionController 资源已清理');
    }
}
