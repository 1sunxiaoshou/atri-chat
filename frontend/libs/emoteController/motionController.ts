import { VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Logger } from '../../utils/logger';

/**
 * 动作控制器 - 管理VRM模型的动作播放和过渡
 * 参考 lobe-vidol 的设计，优化了动画管理和状态控制
 * 
 * 注意：动作由后端数据库管理，前端不再硬编码预设
 */
export class MotionController {
    private vrm: VRM;
    private mixer: THREE.AnimationMixer;
    private currentAction: THREE.AnimationAction | null = null;
    private currentClip: THREE.AnimationClip | null = null;
    private animationClips: Map<string, THREE.AnimationClip> = new Map();
    private isTransitioning = false;
    private isPlaying = false;
    private idleAnimationUrl: string | null = null;

    constructor(vrm: VRM) {
        this.vrm = vrm;
        this.mixer = new THREE.AnimationMixer(vrm.scene);
        Logger.info('MotionController 初始化完成');
    }

    /**
     * 设置闲置动画 URL
     * 由外部（如从后端获取）设置闲置动画的 URL
     */
    public setIdleAnimationUrl(url: string): void {
        this.idleAnimationUrl = url;
        Logger.info(`设置闲置动画 URL: ${url}`);
    }

    /**
     * 预加载动画（通过 URL）
     */
    public async preloadAnimation(name: string, url: string): Promise<void> {
        try {
            await this.loadAnimationClip(name, url);
            Logger.info(`预加载动画成功: ${name}`);
        } catch (error) {
            Logger.error(`预加载动画失败: ${name}`, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 批量预加载动画
     * @param animations 动画映射 { name: url }
     */
    public async preloadAnimations(
        animations: Record<string, string>,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<void> {
        const entries = Object.entries(animations);
        let loaded = 0;
        const total = entries.length;

        Logger.info(`开始预加载 ${total} 个动画`);

        for (const [name, url] of entries) {
            try {
                await this.preloadAnimation(name, url);
                loaded++;
                onProgress?.(loaded, total);
            } catch (error) {
                Logger.error(`预加载动画失败: ${name}`, error instanceof Error ? error : undefined);
            }
        }

        Logger.info(`预加载完成: ${loaded}/${total}`);
    }

    /**
     * 播放动画（通过名称）
     * @param name 动画名称（之前预加载时使用的名称）
     * @param loop 是否循环播放
     */
    public async playAnimation(name: string, loop: boolean = true): Promise<void> {
        await this.playAnimationClip(name, loop);
    }

    /**
     * 播放动画（通过 URL）
     * 如果动画未加载，会自动加载
     */
    public async playAnimationUrl(url: string, loop: boolean = true): Promise<void> {
        // 如果动画未加载，先加载
        if (!this.animationClips.has(url)) {
            await this.loadAnimationClip(url, url);
        }

        await this.playAnimationClip(url, loop);
    }

    /**
     * 加载闲置动画（初始姿态）
     * 参考 lobe-vidol 的 loadIdleAnimation 方法
     */
    public async loadIdleAnimation(): Promise<void> {
        if (!this.idleAnimationUrl) {
            Logger.warn('未设置闲置动画 URL，跳过加载');
            return;
        }

        Logger.info('加载闲置动画');
        try {
            await this.playAnimationUrl(this.idleAnimationUrl, true);
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
                // 设置动画名称为key，而不是使用原始的clip.name
                clip.name = key;
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
     */
    private async playAnimationClip(key: string, loop: boolean): Promise<void> {
        const clip = this.animationClips.get(key);
        if (!clip) {
            Logger.warn(`未找到动画剪辑: ${key}`);
            return;
        }

        // 如果正在过渡中，等待过渡完成
        if (this.isTransitioning) {
            Logger.debug(`等待动作过渡完成...`);
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

        // 创建新动作
        const newAction = this.mixer.clipAction(clip);
        
        // 设置循环模式
        if (loop) {
            newAction.loop = THREE.LoopRepeat;
            newAction.repetitions = Infinity; // 无限循环
        } else {
            newAction.loop = THREE.LoopOnce;
            newAction.repetitions = 1;
            newAction.clampWhenFinished = true; // 保持最后一帧
        }

        Logger.debug(`动作配置: loop=${loop}, loopMode=${newAction.loop}, repetitions=${newAction.repetitions}, clampWhenFinished=${newAction.clampWhenFinished}`);

        // 如果有当前动作且不是同一个，进行平滑过渡
        if (this.currentAction && this.currentAction !== newAction) {
            const currentClipName = this.currentClip?.name || '未知';
            Logger.info(`🎬 动作切换: ${currentClipName} -> ${key}`, {
                from: currentClipName,
                to: key,
                loop: loop,
                duration: clip.duration.toFixed(2) + 's'
            });
            await this.transitionToAction(newAction, loop);
        } else {
            // 直接播放新动作
            Logger.info(`🎬 开始播放动作: ${key}`, {
                loop: loop,
                duration: clip.duration.toFixed(2) + 's',
                isFirstAction: !this.currentAction
            });
            newAction.reset().play();
            this.currentAction = newAction;
        }

        this.currentClip = clip;
        this.isPlaying = true;

        // 如果是非循环动画，监听结束事件自动回到闲置状态
        if (!loop) {
            this.setupAnimationEndHandler(newAction, key);
        }

        Logger.debug(`动作播放详情: ${key}, 循环: ${loop}, 时长: ${clip.duration.toFixed(2)}s, 循环模式: ${newAction.loop}`);
    }

    /**
     * 平滑过渡到新动作
     */
    private async transitionToAction(newAction: THREE.AnimationAction, _isLoop: boolean, duration: number = 0.3): Promise<void> {
        if (!this.currentAction) {
            newAction.reset().play();
            this.currentAction = newAction;
            return;
        }

        this.isTransitioning = true;
        Logger.debug(`开始动作过渡，过渡时长: ${duration}s`);

        return new Promise((resolve) => {
            const oldAction = this.currentAction!;

            // 重要：不要reset新动作，这会导致闪回初始姿态
            // 而是从当前姿态开始播放
            newAction.time = 0;
            newAction.setEffectiveWeight(0);
            newAction.enabled = true;
            newAction.play();

            // 开始交叉淡入淡出
            // warp=false 避免时间轴同步导致的跳跃
            oldAction.crossFadeTo(newAction, duration, false);

            // 过渡完成后的清理
            setTimeout(() => {
                // 停止旧动作
                oldAction.enabled = false;
                oldAction.stop();
                
                // 确保新动作权重为1
                newAction.setEffectiveWeight(1);
                this.currentAction = newAction;
                this.isTransitioning = false;
                
                Logger.info(`✅ 动作过渡完成，当前动作权重: ${newAction.getEffectiveWeight()}`);
                resolve();
            }, duration * 1000);
        });
    }

    /**
     * 设置动画结束处理器
     * 非循环动画播放完毕后自动回到闲置状态
     */
    private setupAnimationEndHandler(action: THREE.AnimationAction, animationName: string): void {
        // 移除之前的监听器（如果有）
        if (this.animationEndListener) {
            this.mixer.removeEventListener('finished', this.animationEndListener);
        }

        // 创建新的监听器
        this.animationEndListener = (event: any) => {
            if (event.action === action) {
                Logger.info(`🏁 动画播放完毕: ${animationName}，准备回到闲置状态`, {
                    animationName: animationName,
                    duration: action.getClip().duration.toFixed(2) + 's'
                });
                
                // 延迟一小段时间再回到闲置状态，让动画自然结束
                setTimeout(() => {
                    this.resetToIdle();
                }, 200);
                
                // 移除监听器
                this.mixer.removeEventListener('finished', this.animationEndListener!);
                this.animationEndListener = null;
            }
        };

        // 添加监听器
        this.mixer.addEventListener('finished', this.animationEndListener);
        Logger.debug(`已设置动画结束监听器: ${animationName}`);
    }

    private animationEndListener: ((event: any) => void) | null = null;

    /**
     * 停止当前动作
     * 参考 lobe-vidol 的 stopMotion 方法
     */
    public stopCurrentMotion(): void {
        // 移除动画结束监听器
        if (this.animationEndListener) {
            this.mixer.removeEventListener('finished', this.animationEndListener);
            this.animationEndListener = null;
        }

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
     * 获取已加载的动画列表
     */
    public getLoadedAnimations(): string[] {
        return Array.from(this.animationClips.keys());
    }

    /**
     * 检查动画是否已加载
     */
    public isAnimationLoaded(name: string): boolean {
        return this.animationClips.has(name);
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        // 移除动画结束监听器
        if (this.animationEndListener) {
            this.mixer.removeEventListener('finished', this.animationEndListener);
            this.animationEndListener = null;
        }

        this.mixer.stopAllAction();
        this.animationClips.clear();
        this.currentAction = null;
        Logger.info('MotionController 资源已清理');
    }
}
