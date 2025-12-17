import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { ExpressionController } from './expressionController';
import { MotionController, MotionPresetName } from './motionController';
import { Logger } from '../../utils/logger';

/**
 * 情感控制器 - 统一管理表情和动作
 * 参考 lobe-vidol 的 EmoteController 设计
 * 作为 Expression 和 Motion 的统一操作接口
 */
export class EmoteController {
    private expressionController: ExpressionController;
    private motionController: MotionController;

    constructor(vrm: VRM) {
        this.expressionController = new ExpressionController(vrm);
        this.motionController = new MotionController(vrm);
        Logger.info('EmoteController 初始化完成');
    }

    /**
     * 预加载动作
     */
    public async preloadMotion(motion: MotionPresetName): Promise<void> {
        await this.motionController.preloadMotion(motion);
    }

    /**
     * 预加载自定义动作URL
     */
    public async preloadMotionUrl(url: string): Promise<void> {
        await this.motionController.preloadMotionUrl(url);
    }

    /**
     * 预加载所有动作
     */
    public async preloadAllMotions(onProgress?: (loaded: number, total: number) => void): Promise<void> {
        await this.motionController.preloadAllMotions(onProgress);
    }

    /**
     * 播放表情
     */
    public playEmotion(preset: VRMExpressionPresetName | string): void {
        this.expressionController.playEmotion(preset);
    }

    /**
     * 播放预设动作
     */
    public async playMotion(preset: MotionPresetName, loop?: boolean): Promise<void> {
        await this.motionController.playMotion(preset, loop);
    }

    /**
     * 播放自定义动作URL
     */
    public async playMotionUrl(url: string, loop: boolean = true): Promise<void> {
        await this.motionController.playMotionUrl(url, loop);
    }

    /**
     * 口型同步
     */
    public lipSync(preset: VRMExpressionPresetName | string, value: number): void {
        this.expressionController.lipSync(preset, value);
    }

    /**
     * 加载闲置动画
     */
    public async loadIdleAnimation(): Promise<void> {
        this.expressionController.playEmotion(VRMExpressionPresetName.Neutral);
        await this.motionController.loadIdleAnimation();
        Logger.info('闲置动画已加载');
    }

    /**
     * 重置到闲置状态
     */
    public async resetToIdle(): Promise<void> {
        this.expressionController.resetToNeutral();
        await this.motionController.resetToIdle();
        Logger.info('已重置到闲置状态');
    }

    /**
     * 停止当前动作
     */
    public stopCurrentMotion(): void {
        this.motionController.stopCurrentMotion();
    }

    /**
     * 更新控制器（每帧调用）
     */
    public update(delta: number): void {
        this.expressionController.update(delta);
        this.motionController.update(delta);
    }

    /**
     * 获取当前动作信息
     */
    public getCurrentMotionInfo() {
        return this.motionController.getCurrentMotionInfo();
    }

    /**
     * 获取当前表情
     */
    public getCurrentExpression(): string {
        return this.expressionController.getCurrentExpression();
    }

    /**
     * 检查是否正在播放动作
     */
    public isMotionPlaying(): boolean {
        return this.motionController.isMotionPlaying();
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        this.expressionController.dispose();
        this.motionController.dispose();
        Logger.info('EmoteController 资源已清理');
    }
}

// 导出类型
export { MotionPresetName } from './motionController';
export { VRMExpressionPresetName } from '@pixiv/three-vrm';
