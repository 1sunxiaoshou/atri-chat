import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { Logger } from '../../utils/logger';
import { ExpressionName } from '../../types/vrm';

/**
 * 表情控制器 - 管理VRM模型的面部表情
 * 参考 Airi 的实现：表情和眨眼完全独立
 */
export class ExpressionController {
    private vrm: VRM;
    private currentExpression: ExpressionName = VRMExpressionPresetName.Neutral;
    private targetExpression: ExpressionName = VRMExpressionPresetName.Neutral;
    private transitionProgress = 1.0; // 1.0 表示过渡完成
    private transitionDuration = 0.3; // 过渡时间（秒）

    constructor(vrm: VRM, transitionDuration?: number) {
        this.vrm = vrm;
        
        if (transitionDuration !== undefined) {
            this.transitionDuration = transitionDuration;
        }
        
        // 输出可用的表情列表
        if (vrm.expressionManager) {
            const expressionNames = Object.keys(vrm.expressionManager.expressionMap);
            Logger.debug('ExpressionController 初始化完成', {
                availableExpressions: expressionNames,
                expressionCount: expressionNames.length,
                transitionDuration: this.transitionDuration
            });
        } else {
            Logger.warn('ExpressionController 初始化完成，但表情管理器未找到');
        }
    }

    /**
     * 播放表情
     */
    public playEmotion(preset: ExpressionName): void {
        if (!this.vrm.expressionManager) {
            Logger.warn('表情管理器未初始化');
            return;
        }

        const expressionManager = this.vrm.expressionManager;
        const expressionNames = Object.keys(expressionManager.expressionMap);

        // 检查表情是否存在
        if (!expressionNames.includes(preset)) {
            Logger.warn(`⚠️ 表情 "${preset}" 不存在于当前VRM模型`, {
                requestedExpression: preset,
                availableExpressions: expressionNames
            });
            return;
        }

        // 如果已经是目标表情，不需要切换
        if (this.targetExpression === preset && this.transitionProgress >= 1.0) {
            Logger.debug(`表情已是 ${preset}，跳过切换`);
            return;
        }

        // 关键修复：切换表情前，清空所有非口型、非眨眼的表情
        // 参考 Airi 项目的实现
        for (const name of expressionNames) {
            if (!this.isLipSyncOrBlinkExpression(name)) {
                expressionManager.setValue(name, 0);
            }
        }

        this.currentExpression = this.targetExpression;
        this.targetExpression = preset;
        this.transitionProgress = 0;

        Logger.debug(`🎭 表情切换: ${this.currentExpression} -> ${this.targetExpression}`, {
            from: this.currentExpression,
            to: this.targetExpression,
            transitionDuration: this.transitionDuration
        });
    }

    /**
     * 口型同步
     * @param preset 口型表情名称（通常是 'aa', 'ih', 'ou', 'ee', 'oh'）
     * @param value 音量值 (0-1)
     * 
     * 改进：参考 airi 项目
     * - 口型直接设置，不降低权重
     * - 口型和表情在不同的更新周期中处理
     * - 表情过渡不会覆盖口型
     */
    public lipSync(preset: ExpressionName, value: number): void {
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
            
            // 直接设置口型权重，不再降低
            // 口型和表情的混合由 VRM 的 expressionManager 自动处理
            expressionManager.setValue(lipSyncExpression, clampedValue);
        }
    }

    /**
     * 更新表情控制器（每帧调用）
     * 参考 Airi：表情和眨眼完全独立，眨眼由外部管理
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
     * @param t 过渡进度 (0-1)
     */
    private updateExpressionWeights(t: number): void {
        if (!this.vrm.expressionManager) {
            return;
        }

        const expressionManager = this.vrm.expressionManager;
        const expressionNames = Object.keys(expressionManager.expressionMap);

        // 重置所有表情（除了口型和眨眼相关的）
        for (const name of expressionNames) {
            if (!this.isLipSyncOrBlinkExpression(name)) {
                expressionManager.setValue(name, 0);
            }
        }

        // 设置当前表情和目标表情的权重
        // 参考 Airi：直接设置完整权重，VRM 会自动混合
        if (this.currentExpression && expressionNames.includes(this.currentExpression)) {
            expressionManager.setValue(this.currentExpression, 1 - t);
        }

        if (this.targetExpression && expressionNames.includes(this.targetExpression)) {
            expressionManager.setValue(this.targetExpression, t);
        }
    }

    /**
     * 判断是否是口型表情或眨眼表情
     * 增强版：支持更多口型表情命名变体
     */
    private isLipSyncOrBlinkExpression(name: string): boolean {
        const lowerName = name.toLowerCase();
        
        // 标准口型表情
        const lipSyncNames = ['aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'];
        
        // 眨眼表情
        const blinkNames = ['blink', 'blinkleft', 'blinkright'];
        
        // 检查是否包含口型或嘴部相关关键词
        const mouthKeywords = ['mouth', 'lip', 'viseme', 'vrc.v_'];
        
        // 精确匹配
        if (lipSyncNames.includes(lowerName) || blinkNames.includes(lowerName)) {
            return true;
        }
        
        // 关键词匹配（避免误判其他表情）
        return mouthKeywords.some(keyword => lowerName.includes(keyword));
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
        Logger.debug('重置表情到中性');
    }

    /**
     * 获取当前表情
     */
    public getCurrentExpression(): ExpressionName {
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
        
        Logger.debug('ExpressionController 资源已清理');
    }
}
