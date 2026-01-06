import { VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Logger } from '../../utils/logger';
import { AnimationProgressCallback, MotionState, AnimationCacheConfig } from './types';

/**
 * 动作控制器 - 管理VRM模型的动作播放和过渡
 * 
 * 注意：动作由后端数据库管理，前端不再硬编码预设
 */
export class MotionController {
    private vrm: VRM;
    private mixer: THREE.AnimationMixer;
    private currentAction: THREE.AnimationAction | null = null;
    private currentClip: THREE.AnimationClip | null = null;
    private animationClips: Map<string, THREE.AnimationClip> = new Map();
    private animationLoadOrder: string[] = []; // 记录加载顺序，用于LRU清理
    private isTransitioning = false;
    private isPlaying = false;
    private idleAnimationUrl: string | null = null;
    private cacheConfig: AnimationCacheConfig = {
        maxSize: 50,
        enableAutoEvict: true
    };

    constructor(vrm: VRM, cacheConfig?: Partial<AnimationCacheConfig>) {
        this.vrm = vrm;
        this.mixer = new THREE.AnimationMixer(vrm.scene);
        
        if (cacheConfig) {
            this.cacheConfig = { ...this.cacheConfig, ...cacheConfig };
        }
        
        Logger.debug('MotionController 初始化完成', {
            maxCacheSize: this.cacheConfig.maxSize,
            autoEvict: this.cacheConfig.enableAutoEvict
        });
    }

    /**
     * 配置动画缓存
     */
    public configureCacheConfig(config: Partial<AnimationCacheConfig>): void {
        this.cacheConfig = { ...this.cacheConfig, ...config };
        Logger.debug('动画缓存配置已更新', this.cacheConfig);
    }

    /**
     * 设置闲置动画 URL
     * 由外部（如从后端获取）设置闲置动画的 URL
     */
    public setIdleAnimationUrl(url: string): void {
        this.idleAnimationUrl = url;
        Logger.debug(`设置闲置动画 URL: ${url}`);
    }

    /**
     * 预加载动画（通过 URL）
     */
    public async preloadAnimation(name: string, url: string): Promise<void> {
        try {
            await this.loadAnimationClip(name, url);
            Logger.debug(`预加载动画成功: ${name}`);
        } catch (error) {
            Logger.error(`预加载动画失败: ${name}`, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 批量预加载动画
     * @param animations 动画映射 { name: url }
     * @param onProgress 进度回调
     */
    public async preloadAnimations(
        animations: Record<string, string>,
        onProgress?: AnimationProgressCallback
    ): Promise<void> {
        const entries = Object.entries(animations);
        let loaded = 0;
        const total = entries.length;

        Logger.debug(`开始预加载 ${total} 个动画`);

        for (const [name, url] of entries) {
            try {
                await this.preloadAnimation(name, url);
                loaded++;
                onProgress?.(loaded, total);
            } catch (error) {
                Logger.error(`预加载动画失败: ${name}`, error instanceof Error ? error : undefined);
            }
        }

        Logger.debug(`预加载完成: ${loaded}/${total}`);
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

        Logger.debug('加载闲置动画');
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
        Logger.debug('重置到闲置状态');
        
        if (!this.idleAnimationUrl) {
            Logger.warn('未设置闲置动画 URL，只能停止当前动作');
            this.stopCurrentMotion();
            return;
        }

        // 不要先停止动作，而是直接过渡到闲置动画
        // 这样可以避免回到 T-pose
        try {
            await this.playAnimationUrl(this.idleAnimationUrl, true);
            Logger.debug('已平滑过渡到闲置动画');
        } catch (error) {
            Logger.error('过渡到闲置动画失败，回退到停止动作', error instanceof Error ? error : undefined);
            this.stopCurrentMotion();
        }
    }

    /**
     * 加载动画剪辑
     */
    private async loadAnimationClip(key: string, url: string): Promise<void> {
        if (this.animationClips.has(key)) {
            // 更新访问顺序（LRU）
            this.updateLoadOrder(key);
            return; // 已加载
        }

        // 检查缓存是否已满，需要清理
        if (this.cacheConfig.enableAutoEvict && this.animationClips.size >= this.cacheConfig.maxSize) {
            this.evictOldestAnimation();
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
                this.animationLoadOrder.push(key);
                Logger.debug(`动画加载成功: ${key}, 时长: ${clip.duration.toFixed(2)}s`);
            } else {
                throw new Error('未找到VRM动画数据');
            }
        } catch (error) {
            Logger.error(`动画加载失败: ${key}`, error instanceof Error ? error : undefined);
            throw error;
        }
    }

    /**
     * 更新动画访问顺序（LRU）
     */
    private updateLoadOrder(key: string): void {
        const index = this.animationLoadOrder.indexOf(key);
        if (index > -1) {
            this.animationLoadOrder.splice(index, 1);
        }
        this.animationLoadOrder.push(key);
    }

    /**
     * 清理最旧的动画（LRU策略）
     */
    private evictOldestAnimation(): void {
        if (this.animationLoadOrder.length === 0) {
            return;
        }

        const oldestKey = this.animationLoadOrder.shift();
        if (oldestKey) {
            // 不要清理当前正在播放的动画
            if (this.currentClip?.name === oldestKey) {
                this.animationLoadOrder.push(oldestKey); // 放回队列
                return;
            }

            this.animationClips.delete(oldestKey);
            Logger.debug(`缓存已满，清理最旧动画: ${oldestKey}`, {
                currentCacheSize: this.animationClips.size,
                maxCacheSize: this.cacheConfig.maxSize
            });
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
            Logger.debug(`🎬 动作切换: ${currentClipName} -> ${key}`, {
                from: currentClipName,
                to: key,
                loop: loop,
                duration: clip.duration.toFixed(2) + 's'
            });
            await this.transitionToAction(newAction, loop);
        } else {
            // 直接播放新动作
            Logger.debug(`🎬 开始播放动作: ${key}`, {
                loop: loop,
                duration: clip.duration.toFixed(2) + 's',
                isFirstAction: !this.currentAction
            });
            
            // 优化：如果是第一个动作，也使用平滑启动
            if (!this.currentAction) {
                newAction.reset().play();
            } else {
                // 从当前姿态开始播放
                newAction.setEffectiveWeight(0);
                newAction.play();
                newAction.fadeIn(0.3); // 淡入效果
            }
            
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
    private async transitionToAction(newAction: THREE.AnimationAction, _isLoop: boolean, duration: number = 0.5): Promise<void> {
        if (!this.currentAction) {
            newAction.reset().play();
            this.currentAction = newAction;
            return;
        }

        this.isTransitioning = true;
        Logger.debug(`开始动作过渡，过渡时长: ${duration}s`);

        return new Promise((resolve) => {
            const oldAction = this.currentAction!;

            // 关键优化：创建姿态混合过渡
            // 1. 先让新动作以0权重播放，这样它会计算骨骼变换但不影响显示
            newAction.setEffectiveWeight(0);
            newAction.enabled = true;
            newAction.play();

            // 2. 使用 crossFadeTo 进行平滑过渡
            // warp=true 让时间轴同步，减少跳跃
            // 但我们使用更长的过渡时间来让过渡更平滑
            oldAction.crossFadeTo(newAction, duration, true);

            // 3. 在过渡期间，逐渐调整权重分布
            const startTime = Date.now();
            const updateTransition = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                const progress = Math.min(elapsed / duration, 1);
                
                if (progress < 1 && this.isTransitioning) {
                    // 使用缓动函数让过渡更自然
                    const easeProgress = this.easeInOutCubic(progress);
                    
                    // 手动调整权重分布
                    oldAction.setEffectiveWeight(1 - easeProgress);
                    newAction.setEffectiveWeight(easeProgress);
                    
                    requestAnimationFrame(updateTransition);
                } else {
                    // 过渡完成
                    this.finishTransition(oldAction, newAction, resolve);
                }
            };
            
            requestAnimationFrame(updateTransition);
        });
    }

    /**
     * 缓动函数：三次贝塞尔曲线，让过渡更自然
     */
    private easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 完成过渡
     */
    private finishTransition(
        oldAction: THREE.AnimationAction, 
        newAction: THREE.AnimationAction, 
        resolve: () => void
    ): void {
        // 停止旧动作
        oldAction.enabled = false;
        oldAction.stop();
        
        // 确保新动作权重为1
        newAction.setEffectiveWeight(1);
        this.currentAction = newAction;
        this.isTransitioning = false;
        
        Logger.debug(`✅ 动作过渡完成，当前动作权重: ${newAction.getEffectiveWeight()}`);
        resolve();
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
                Logger.debug(`🏁 动画播放完毕: ${animationName}，准备回到闲置状态`, {
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

        // 如果有闲置动画，尝试平滑过渡而不是直接停止
        if (this.idleAnimationUrl && this.currentAction) {
            Logger.debug('尝试平滑过渡到闲置动画而不是直接停止');
            // 异步调用，不阻塞当前流程
            this.playAnimationUrl(this.idleAnimationUrl, true).catch((error) => {
                Logger.error('过渡到闲置动画失败，强制停止', error instanceof Error ? error : undefined);
                this.forceStopAllActions();
            });
            return;
        }

        // 没有闲置动画或没有当前动作，直接停止
        this.forceStopAllActions();
    }

    /**
     * 强制停止所有动作（会导致回到 T-pose）
     */
    private forceStopAllActions(): void {
        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        if (this.currentAction) {
            this.currentAction.stop();
            this.currentAction = null;
        }

        this.currentClip = null;
        this.isPlaying = false;
        Logger.debug('强制停止所有动作');
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
    public getCurrentMotionInfo(): MotionState | null {
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
     * 获取缓存统计信息
     */
    public getCacheStats(): { size: number; maxSize: number; loadOrder: string[] } {
        return {
            size: this.animationClips.size,
            maxSize: this.cacheConfig.maxSize,
            loadOrder: [...this.animationLoadOrder]
        };
    }

    /**
     * 清空动画缓存
     */
    public clearCache(): void {
        // 停止当前动作
        this.stopCurrentMotion();
        
        // 清空缓存
        this.animationClips.clear();
        this.animationLoadOrder = [];
        
        Logger.debug('动画缓存已清空');
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
        this.animationLoadOrder = [];
        this.currentAction = null;
        Logger.debug('MotionController 资源已清理');
    }
}
