import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { Logger } from '../../utils/logger';

/**
 * 表情控制器 - 管理VRM模型的面部表情
 * 参考 lobe-vidol 的 ExpressionController 设计
 */
export class ExpressionController {
    private vrm: VRM;
    private currentExpression: VRMExpressionPresetName | string = VRMExpressionPresetName.Neutral;
    private targetExpression: VRMExpressionPresetName | string = VRMExpressionPresetName.Neutral;
    private transitionProgress = 1.0; // 1.0 表示过渡完成
    private transitionDuration = 0.3; // 过渡时间（秒）

    constructor(vrm: VRM) {
        this.vrm = vrm;
        Logger.info('ExpressionController 初始化完成');
    }

    /**
     * 播放表情
     */
    public playEmotion(preset: VRMExpressionPresetName | string): void {
        if (!this.vrm.expressionManager) {
            Logger.warn('表情管理器未初始化');
            return;
        }

        // 如果已经是目标表情，不需要切换
        if (this.targetExpression === preset && this.transitionProgress >= 1.0) {
            return;
        }

        this.currentExpression = this.targetExpression;
        this.targetExpression = preset;
        this.transitionProgress = 0;

        Logger.debug(`切换表情: ${this.currentExpression} -> ${this.targetExpression}`);
    }

    /**
     * 口型同步
     * @param preset 口型表情名称（通常是 'aa', 'ih', 'ou', 'ee', 'oh'）
     * @param value 音量值 (0-1)
     */
    public lipSync(preset: VRMExpressionPresetName | string, value: number): void {
        if (!this.vrm.expressionManager) {
            return;
        }

        const expressionManager = this.vrm.expressionManager;
        const expressionNames = Object.keys(expressionManager.expressionMap);

        // 查找可用的口型表情
        const lipSyncCandidates = [preset, preset.toLowerCase(), preset.toUpperCase()];
        let lipSyncExpression: string | null = null;

        for (const candidate of lipSyncCandidates) {
            if (expressionNames.includes(candidate)) {
                lipSyncExpression = candidate;
                break;
            }
        }

        if (lipSyncExpression) {
            // 限制值在 0-1 范围内
            const clampedValue = Math.max(0, Math.min(1, value));
            expressionManager.setValue(lipSyncExpression, clampedValue);
        }
    }

    /**
     * 更新表情控制器（每帧调用）
     */
    public update(delta: number): void {
        if (!this.vrm.expressionManager) {
            return;
        }

        // 如果正在过渡中
        if (this.transitionProgress < 1.0) {
            this.transitionProgress += delta / this.transitionDuration;
            this.transitionProgress = Math.min(1.0, this.transitionProgress);

            // 平滑插值
            const t = this.easeInOutCubic(this.transitionProgress);

            // 更新表情权重
            this.updateExpressionWeights(t);
        }
    }

    /**
     * 更新表情权重
     */
    private updateExpressionWeights(t: number): void {
        if (!this.vrm.expressionManager) {
            return;
        }

        const expressionManager = this.vrm.expressionManager;
        const expressionNames = Object.keys(expressionManager.expressionMap);

        // 重置所有表情（除了口型相关的）
        for (const name of expressionNames) {
            if (!this.isLipSyncExpression(name)) {
                expressionManager.setValue(name, 0);
            }
        }

        // 设置当前表情和目标表情的权重
        if (this.currentExpression && expressionNames.includes(this.currentExpression)) {
            expressionManager.setValue(this.currentExpression, 1 - t);
        }

        if (this.targetExpression && expressionNames.includes(this.targetExpression)) {
            expressionManager.setValue(this.targetExpression, t);
        }
    }

    /**
     * 判断是否是口型表情
     */
    private isLipSyncExpression(name: string): boolean {
        const lipSyncNames = ['aa', 'ih', 'ou', 'ee', 'oh', 'Aa', 'Ih', 'Ou', 'Ee', 'Oh'];
        return lipSyncNames.includes(name);
    }

    /**
     * 缓动函数 - 三次方缓入缓出
     */
    private easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * 重置表情到中性
     */
    public resetToNeutral(): void {
        this.playEmotion(VRMExpressionPresetName.Neutral);
        Logger.info('重置表情到中性');
    }

    /**
     * 获取当前表情
     */
    public getCurrentExpression(): string {
        return this.targetExpression;
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        if (this.vrm.expressionManager) {
            const expressionManager = this.vrm.expressionManager;
            const expressionNames = Object.keys(expressionManager.expressionMap);
            
            // 重置所有表情
            for (const name of expressionNames) {
                expressionManager.setValue(name, 0);
            }
        }
        
        Logger.info('ExpressionController 资源已清理');
    }
}
