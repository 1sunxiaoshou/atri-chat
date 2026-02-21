/**
 * ThinkingMotionManager - 思考动作管理器
 * 
 * 职责：
 * 1. 检测等待响应状态
 * 2. 自动播放思考动作
 * 3. 管理思考动作队列
 */
import { CharacterMotionBindings } from '../../../types/motion';
import { Logger } from '../../../utils/logger';

export class ThinkingMotionManager {
    private thinkingTimeout: number | null = null;
    private isThinking = false;
    private motionBindings: CharacterMotionBindings | null = null;
    private onPlayMotion?: (motionName: string) => void;

    // 配置
    private readonly THINKING_DELAY_MS = 2000; // 2秒后开始播放思考动作
    private readonly THINKING_MOTION_INTERVAL_MS = 4000; // 思考动作播放间隔

    constructor(onPlayMotion?: (motionName: string) => void) {
        this.onPlayMotion = onPlayMotion;
        Logger.debug('ThinkingMotionManager: 初始化思考动作管理器');
    }

    /**
     * 设置动作绑定
     */
    setMotionBindings(bindings: CharacterMotionBindings | null): void {
        this.motionBindings = bindings;
    }

    /**
     * 开始思考状态（发送消息后调用）
     */
    startThinking(): void {
        if (this.isThinking) {
            return;
        }

        this.isThinking = true;
        Logger.debug('开始思考状态');

        // 延迟后播放第一个思考动作
        this.thinkingTimeout = window.setTimeout(() => {
            if (this.isThinking) {
                this.playRandomThinkingMotion();
                this.scheduleNextThinkingMotion();
            }
        }, this.THINKING_DELAY_MS);
    }

    /**
     * 停止思考状态（收到完整响应后调用）
     */
    stopThinking(): void {
        if (!this.isThinking) {
            return;
        }

        this.isThinking = false;
        Logger.debug('停止思考状态');

        if (this.thinkingTimeout !== null) {
            clearTimeout(this.thinkingTimeout);
            this.thinkingTimeout = null;
        }
    }

    /**
     * 安排下一次思考动作
     */
    private scheduleNextThinkingMotion(): void {
        if (!this.isThinking) {
            return;
        }

        this.thinkingTimeout = window.setTimeout(() => {
            if (this.isThinking) {
                this.playRandomThinkingMotion();
                this.scheduleNextThinkingMotion();
            }
        }, this.THINKING_MOTION_INTERVAL_MS);
    }

    /**
     * 播放随机思考动作
     */
    private playRandomThinkingMotion(): void {
        const motionName = this.selectRandomMotion('thinking');
        if (motionName && this.onPlayMotion) {
            Logger.info(`播放思考动作: ${motionName}`);
            this.onPlayMotion(motionName);
        } else {
            Logger.debug('没有可用的思考动作');
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

        const categoryKey = category.toLowerCase() as 'idle' | 'thinking' | 'reply';
        const bindings = this.motionBindings.bindings_by_category[categoryKey];

        if (!bindings || bindings.length === 0) {
            Logger.debug(`分类 ${category} 没有绑定的动作`);
            return null;
        }

        // 计算总权重
        const totalWeight = bindings.reduce((sum, binding) => sum + binding.weight, 0);

        // 随机选择
        let random = Math.random() * totalWeight;
        for (const binding of bindings) {
            random -= binding.weight;
            if (random <= 0) {
                return binding.motion_name;
            }
        }

        // 降级：返回第一个
        return bindings[0]?.motion_name || null;
    }

    /**
     * 销毁资源
     */
    dispose(): void {
        this.stopThinking();
        this.motionBindings = null;
        this.onPlayMotion = undefined;
        Logger.debug('ThinkingMotionManager: 思考动作管理器已销毁');
    }
}
