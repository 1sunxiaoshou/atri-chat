import { VRMExpressionManager } from '@pixiv/three-vrm';
import { Logger } from '../../utils/logger';

// 眨眼时间常量 - 参考 Airi 的实现
const BLINK_DURATION = 0.2;      // 眨眼持续时间（秒）
const MIN_BLINK_INTERVAL = 1.0;  // 最小眨眼间隔（秒）
const MAX_BLINK_INTERVAL = 6.0;  // 最大眨眼间隔（秒）

/**
 * 自动眨眼控制器
 * 参考 Airi 的实现，使用正弦曲线让眨眼更自然
 */
export class AutoBlink {
    private expressionManager: VRMExpressionManager;
    private isAutoBlink: boolean;
    private isBlinking: boolean;
    private blinkProgress: number;
    private timeSinceLastBlink: number;
    private nextBlinkTime: number;
    private blinkExpressionName: string = 'blink'; // 使用的眨眼表情名称

    constructor(expressionManager: VRMExpressionManager) {
        this.expressionManager = expressionManager;
        this.isAutoBlink = true;
        this.isBlinking = false;
        this.blinkProgress = 0;
        this.timeSinceLastBlink = 0;
        this.nextBlinkTime = this.randomBlinkInterval();
        
        // 检查可用的眨眼表情
        const availableExpressions = Object.keys(expressionManager.expressionMap);
        
        // 优先使用 blink，如果不存在则使用 blinkLeft + blinkRight
        if (availableExpressions.includes('blink')) {
            this.blinkExpressionName = 'blink';
        } else if (availableExpressions.includes('blinkLeft') && availableExpressions.includes('blinkRight')) {
            this.blinkExpressionName = 'blinkBoth'; // 特殊标记，表示使用双眼
        } else {
            const blinkExpressions = availableExpressions.filter(name => 
                name.toLowerCase().includes('blink')
            );
            if (blinkExpressions.length > 0) {
                this.blinkExpressionName = blinkExpressions[0]!;
            }
        }
        
        Logger.debug('AutoBlink 初始化', { usingExpression: this.blinkExpressionName });
    }

    /**
     * 生成随机眨眼间隔
     */
    private randomBlinkInterval(): number {
        return Math.random() * (MAX_BLINK_INTERVAL - MIN_BLINK_INTERVAL) + MIN_BLINK_INTERVAL;
    }

    /**
     * 启用/禁用自动眨眼
     */
    public setEnable(isAuto: boolean): void {
        this.isAutoBlink = isAuto;
        
        // 如果禁用且正在眨眼，重置状态
        if (!isAuto && this.isBlinking) {
            this.isBlinking = false;
            this.blinkProgress = 0;
            this.expressionManager.setValue('blink', 0);
        }
        
        Logger.debug(`自动眨眼状态切换: ${isAuto}`);
    }

    /**
     * 更新眨眼状态（每帧调用）
     * 参考 Airi：使用正弦曲线让眨眼更平滑自然
     */
    public update(delta: number): void {
        if (!this.isAutoBlink) {
            return;
        }

        this.timeSinceLastBlink += delta;

        // 检查是否到了下次眨眼的时间
        if (!this.isBlinking && this.timeSinceLastBlink >= this.nextBlinkTime) {
            this.isBlinking = true;
            this.blinkProgress = 0;
        }

        // 处理眨眼动画
        if (this.isBlinking) {
            this.blinkProgress += delta / BLINK_DURATION;

            // 使用正弦曲线计算眨眼值，让动画更平滑
            const blinkValue = Math.sin(Math.PI * this.blinkProgress);
            
            // 根据表情类型设置权重
            if (this.blinkExpressionName === 'blinkBoth') {
                // 使用 blinkLeft + blinkRight
                this.expressionManager.setValue('blinkLeft', blinkValue);
                this.expressionManager.setValue('blinkRight', blinkValue);
            } else {
                // 使用单个眨眼表情
                this.expressionManager.setValue(this.blinkExpressionName, blinkValue);
            }

            // 眨眼完成
            if (this.blinkProgress >= 1.0) {
                this.isBlinking = false;
                this.timeSinceLastBlink = 0;
                
                // 重置眨眼权重
                if (this.blinkExpressionName === 'blinkBoth') {
                    this.expressionManager.setValue('blinkLeft', 0);
                    this.expressionManager.setValue('blinkRight', 0);
                } else {
                    this.expressionManager.setValue(this.blinkExpressionName, 0);
                }
                
                this.nextBlinkTime = this.randomBlinkInterval();
            }
        }
    }

    /**
     * 获取当前眨眼状态
     */
    public isBlinkingNow(): boolean {
        return this.isBlinking;
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        if (this.expressionManager) {
            if (this.blinkExpressionName === 'blinkBoth') {
                this.expressionManager.setValue('blinkLeft', 0);
                this.expressionManager.setValue('blinkRight', 0);
            } else {
                this.expressionManager.setValue(this.blinkExpressionName, 0);
            }
        }
        Logger.debug('AutoBlink 资源已清理');
    }
}
