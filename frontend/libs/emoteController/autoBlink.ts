import { VRMExpressionManager } from '@pixiv/three-vrm';
import { Logger } from '../../utils/logger';

// 眨眼时间常量
const BLINK_CLOSE_MAX = 0.12; // 闭眼持续时间（秒）
const BLINK_OPEN_MAX = 5.0;   // 睁眼持续时间（秒）

/**
 * 自动眨眼控制器
 * 参考 lobe-vidol 的 AutoBlink 实现
 * 让VRM角色自动眨眼，增加生动感
 */
export class AutoBlink {
    private expressionManager: VRMExpressionManager;
    private remainingTime: number;
    private isOpen: boolean;
    private isAutoBlink: boolean;

    constructor(expressionManager: VRMExpressionManager) {
        this.expressionManager = expressionManager;
        this.remainingTime = 0;
        this.isAutoBlink = true;
        this.isOpen = true;
        Logger.debug('AutoBlink 初始化完成');
    }

    /**
     * 启用/禁用自动眨眼
     * 
     * 当目前正在闭眼时（blink=1），如果此时切换表情会显得不自然，
     * 因此返回眼睛睁开所需的时间，调用者可以等待这段时间后再切换表情
     * 
     * @param isAuto 是否启用自动眨眼
     * @returns 眼睛睁开所需的时间（秒）
     */
    public setEnable(isAuto: boolean): number {
        this.isAutoBlink = isAuto;

        // 如果目前眼睛是闭着的，返回睁开所需的时间
        if (!this.isOpen) {
            Logger.debug(`自动眨眼状态切换: ${isAuto}, 等待眼睛睁开: ${this.remainingTime.toFixed(2)}s`);
            return this.remainingTime;
        }

        Logger.debug(`自动眨眼状态切换: ${isAuto}`);
        return 0;
    }

    /**
     * 更新眨眼状态（每帧调用）
     */
    public update(delta: number): void {
        if (this.remainingTime > 0) {
            this.remainingTime -= delta;
            return;
        }

        // 如果眼睛睁开且启用了自动眨眼，则闭眼
        if (this.isOpen && this.isAutoBlink) {
            this.close();
            return;
        }

        // 否则睁眼
        this.open();
    }

    /**
     * 闭眼
     */
    private close(): void {
        this.isOpen = false;
        this.remainingTime = BLINK_CLOSE_MAX;
        this.expressionManager.setValue('blink', 1);
    }

    /**
     * 睁眼
     */
    private open(): void {
        this.isOpen = true;
        this.remainingTime = BLINK_OPEN_MAX;
        this.expressionManager.setValue('blink', 0);
    }

    /**
     * 获取当前眨眼状态
     */
    public isBlinking(): boolean {
        return !this.isOpen;
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        // 重置眨眼状态
        if (this.expressionManager) {
            this.expressionManager.setValue('blink', 0);
        }
        Logger.debug('AutoBlink 资源已清理');
    }
}
