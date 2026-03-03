/**
 * IdleMotionManager - 闲置动作管理器
 * 
 * 职责：
 * 1. 检测无交互状态
 * 2. 自动播放闲置动作
 * 3. 管理闲置动作队列
 */
import { CharacterMotionBindings } from '../../../types/motion';
import { Logger } from '../../../utils/logger';

export class IdleMotionManager {
    private idleTimeout: number | null = null;
    private isIdle = false;
    private motionBindings: CharacterMotionBindings | null = null;
    private onPlayMotion?: (motionName: string) => void;

    // 配置
    private readonly IDLE_DELAY_MS = 10000; // 10秒无交互后进入闲置状态
    private readonly IDLE_MOTION_INTERVAL_MS = 5000; // 闲置动作播放间隔

    constructor(onPlayMotion?: (motionName: string) => void) {
        this.onPlayMotion = onPlayMotion;
        Logger.debug('IdleMotionManager: 初始化闲置动作管理器');
    }

    /**
     * 设置动作绑定
     */
    setMotionBindings(bindings: CharacterMotionBindings | null): void {
        this.motionBindings = bindings;
    }

    /**
     * 重置闲置计时器（有交互时调用）
     */
    resetIdleTimer(): void {
        // 清除旧的计时器
        if (this.idleTimeout !== null) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }

        // 退出闲置状态
        if (this.isIdle) {
            this.isIdle = false;
            Logger.debug('退出闲置状态');
        }

        // 启动新的计时器
        this.idleTimeout = window.setTimeout(() => {
            this.enterIdleState();
        }, this.IDLE_DELAY_MS);
    }

    /**
     * 进入闲置状态
     */
    private enterIdleState(): void {
        this.isIdle = true;
        Logger.debug('进入闲置状态');

        // 立即播放一次闲置动作
        this.playRandomIdleMotion();

        // 设置定期播放
        this.scheduleNextIdleMotion();
    }

    /**
     * 安排下一次闲置动作
     */
    private scheduleNextIdleMotion(): void {
        if (!this.isIdle) {
            return;
        }

        this.idleTimeout = window.setTimeout(() => {
            if (this.isIdle) {
                this.playRandomIdleMotion();
                this.scheduleNextIdleMotion();
            }
        }, this.IDLE_MOTION_INTERVAL_MS);
    }

    /**
     * 播放随机闲置动作
     */
    private playRandomIdleMotion(): void {
        const motionName = this.selectRandomMotion('idle');
        if (motionName && this.onPlayMotion) {
            Logger.info(`播放闲置动作: ${motionName}`);
            this.onPlayMotion(motionName);
        } else {
            Logger.debug('没有可用的闲置动作');
        }
    }

    /**
     * 根据分类和权重随机选择动作
     */
    private selectRandomMotion(category: string): string | null {
        if (!this.motionBindings || !this.motionBindings.bindings_by_category) {
            Logger.warn('动作绑定未设置或数据结构不正确');
            return null;
        }

        const categoryKey = category.toLowerCase() as 'initial' | 'idle' | 'thinking' | 'reply';
        const bindings = this.motionBindings.bindings_by_category[categoryKey];

        if (!bindings || bindings.length === 0) {
            Logger.debug(`分类 ${category} 没有绑定的动作`);
            return null;
        }

        // 均等概率随机选择
        const randomIndex = Math.floor(Math.random() * bindings.length);
        return bindings[randomIndex]?.motion_name || null;
    }

    /**
     * 停止闲置动作管理
     */
    stop(): void {
        if (this.idleTimeout !== null) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }
        this.isIdle = false;
    }

    /**
     * 销毁资源
     */
    dispose(): void {
        this.stop();
        this.motionBindings = null;
        this.onPlayMotion = undefined;
        Logger.debug('IdleMotionManager: 闲置动作管理器已销毁');
    }
}
