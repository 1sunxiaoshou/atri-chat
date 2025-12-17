import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { ExpressionController } from './expressionController';
import { MotionController } from './motionController';
import { Logger } from '../../utils/logger';

/**
 * 情感控制器 - 统一管理表情和动作
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
     * 设置闲置动画 URL
     */
    public setIdleAnimationUrl(url: string): void {
        this.motionController.setIdleAnimationUrl(url);
    }

    /**
     * 预加载单个动画
     */
    public async preloadAnimation(name: string, url: string): Promise<void> {
        await this.motionController.preloadAnimation(name, url);
    }

    /**
     * 批量预加载动画
     */
    public async preloadAnimations(
        animations: Record<string, string>,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<void> {
        await this.motionController.preloadAnimations(animations, onProgress);
    }

    /**
     * 播放表情
     */
    public playEmotion(preset: VRMExpressionPresetName | string): void {
        this.expressionController.playEmotion(preset);
    }

    /**
     * 播放动画（通过名称）
     */
    public async playAnimation(name: string, loop: boolean = true): Promise<void> {
        await this.motionController.playAnimation(name, loop);
    }

    /**
     * 播放动画（通过 URL）
     */
    public async playAnimationUrl(url: string, loop: boolean = true): Promise<void> {
        await this.motionController.playAnimationUrl(url, loop);
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
     * 获取已加载的动画列表
     */
    public getLoadedAnimations(): string[] {
        return this.motionController.getLoadedAnimations();
    }

    /**
     * 检查动画是否已加载
     */
    public isAnimationLoaded(name: string): boolean {
        return this.motionController.isAnimationLoaded(name);
    }

    /**
     * 启用/禁用自动眨眼
     */
    public setAutoBlinkEnabled(enabled: boolean): void {
        this.expressionController.setAutoBlinkEnabled(enabled);
    }

    /**
     * 检查是否正在眨眼
     */
    public isBlinking(): boolean {
        return this.expressionController.isBlinking();
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
export { VRMExpressionPresetName } from '@pixiv/three-vrm';
