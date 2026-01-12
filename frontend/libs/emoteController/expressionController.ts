import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { Logger } from '../../utils/logger';
import { AutoBlink } from './autoBlink';
import { ExpressionName } from './types';

/**
 * 表情控制器 - 管理VRM模型的面部表情
 */
export class ExpressionController {
    private vrm: VRM;
    private currentExpression: ExpressionName = VRMExpressionPresetName.Neutral;
    private targetExpression: ExpressionName = VRMExpressionPresetName.Neutral;
    private transitionProgress = 1.0; // 1.0 表示过渡完成
    private transitionDuration = 0.3; // 过渡时间（秒）
    private autoBlink: AutoBlink | null = null;

    constructor(vrm: VRM, transitionDuration?: number) {
        this.vrm = vrm;
        
        if (transitionDuration !== undefined) {
            this.transitionDuration = transitionDuration;
        }
        
        // 初始化自动眨眼
        if (vrm.expressionManager) {
            this.autoBlink = new AutoBlink(vrm.expressionManager);
            
            // 输出可用的表情列表
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

        this.currentExpression = this.targetExpression;
        this.targetExpression = preset;
        this.transitionProgress = 0;

        // 根据表情类型自动控制眨眼
        this.autoControlBlink(preset);

        Logger.debug(`🎭 表情切换: ${this.currentExpression} -> ${this.targetExpression}`, {
            from: this.currentExpression,
            to: this.targetExpression,
            transitionDuration: this.transitionDuration
        });
    }

    /**
     * 根据表情自动控制眨眼
     * 某些表情（如闭眼、睡觉等）需要禁用自动眨眼
     */
    private autoControlBlink(preset: ExpressionName): void {
        if (!this.autoBlink) {
            return;
        }

        const presetLower = preset.toLowerCase();
        
        // 需要禁用眨眼的表情列表
        const noBlinkExpressions = [
            'blink', 'blinkleft', 'blinkright',  // 眨眼表情本身
            'sleepy', 'sleep', 'sleeping',        // 睡觉
            'relaxed',                             // 放松（可能闭眼）
            'sad', 'sorrow',                       // 悲伤（可能闭眼）
            'angry',                               // 生气（可能眯眼）
        ];

        // 检查是否需要禁用眨眼
        const shouldDisableBlink = noBlinkExpressions.some(expr => 
            presetLower.includes(expr)
        );

        if (shouldDisableBlink) {
            this.autoBlink.setEnable(false);
            Logger.debug(`🚫 表情 ${preset} 禁用自动眨眼`);
        } else {
            this.autoBlink.setEnable(true);
            Logger.debug(`✅ 表情 ${preset} 启用自动眨眼`);
        }
    }

    /**
     * 口型同步
     * @param preset 口型表情名称（通常是 'aa', 'ih', 'ou', 'ee', 'oh'）
     * @param value 音量值 (0-1)
     * 
     * 注意：口型同步使用叠加模式，会与当前表情的嘴部形变混合
     * 为了避免冲突，降低口型的权重
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
            
            // 降低口型权重，避免与表情的嘴部形变过度叠加
            // 保持表情完整（100%），口型使用较低权重（50%）
            const reducedLipValue = clampedValue * 0.5;
            
            expressionManager.setValue(lipSyncExpression, reducedLipValue);
        }
    }

    /**
     * 更新表情控制器（每帧调用）
     */
    public update(delta: number): void {
        if (!this.vrm.expressionManager) {
            return;
        }

        // 更新自动眨眼
        if (this.autoBlink) {
            this.autoBlink.update(delta);
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
            if (!this.isLipSyncExpression(name)) {
                expressionManager.setValue(name, 0);
            }
        }

        // 设置当前表情和目标表情的权重
        // 注意：需要排除嘴部相关的表情组件，让口型同步独立控制
        if (this.currentExpression && expressionNames.includes(this.currentExpression)) {
            this.setExpressionWithoutMouth(this.currentExpression, 1 - t);
        }

        if (this.targetExpression && expressionNames.includes(this.targetExpression)) {
            this.setExpressionWithoutMouth(this.targetExpression, t);
        }
    }

    /**
     * 设置表情（完整权重，不再降低）
     */
    private setExpressionWithoutMouth(expressionName: string, weight: number): void {
        if (!this.vrm.expressionManager) {
            return;
        }

        const expressionManager = this.vrm.expressionManager;
        
        // 直接设置完整权重
        // 口型同步会通过叠加模式工作，VRM会自动混合
        expressionManager.setValue(expressionName, weight);
    }

    /**
     * 判断是否是口型表情或眨眼表情
     * 增强版：支持更多口型表情命名变体
     */
    private isLipSyncExpression(name: string): boolean {
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
     * 启用/禁用自动眨眼
     */
    public setAutoBlinkEnabled(enabled: boolean): void {
        if (this.autoBlink) {
            this.autoBlink.setEnable(enabled);
            Logger.debug(`自动眨眼已${enabled ? '启用' : '禁用'}`);
        }
    }

    /**
     * 检查是否正在眨眼
     */
    public isBlinking(): boolean {
        return this.autoBlink?.isBlinking() ?? false;
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        // 清理自动眨眼
        if (this.autoBlink) {
            this.autoBlink.dispose();
            this.autoBlink = null;
        }

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
