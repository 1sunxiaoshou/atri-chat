import { MotionBinding } from '../services/api/motions';
import { motionBindingsApi } from '../services/api';

export type MotionState = 'idle' | 'thinking' | 'reply';

/**
 * 动作播放引擎
 * 根据角色状态自动选择和播放动作
 */
export class MotionEngine {
    private characterId: string;
    private bindings: MotionBinding[] = [];
    private currentState: MotionState = 'idle';
    private vrmViewer: any; // VRMViewer 实例

    constructor(characterId: string, vrmViewer: any) {
        this.characterId = characterId;
        this.vrmViewer = vrmViewer;
        this.loadBindings();
    }

    /**
     * 加载角色的动作绑定
     */
    async loadBindings() {
        try {
            const response = await motionBindingsApi.getCharacterBindings(this.characterId);
            if (response.code === 200) {
                this.bindings = response.data;
            }
        } catch (error) {
            console.error('Failed to load motion bindings:', error);
        }
    }

    /**
     * 切换到指定状态并播放对应动作
     * @param state - 目标状态
     */
    async transitionTo(state: MotionState) {
        this.currentState = state;
        const binding = this.selectMotion(state);
        if (binding && binding.motion) {
            await this.playMotion(binding);
        }
    }

    /**
     * 根据权重随机选择动作
     * @param category - 动作类别
     * @returns 选中的动作绑定
     */
    private selectMotion(category: string): MotionBinding | null {
        const candidates = this.bindings.filter(b => b.category === category);
        if (candidates.length === 0) return null;

        // 基于权重随机选择
        const totalWeight = candidates.reduce((sum, b) => sum + b.weight, 0);
        let random = Math.random() * totalWeight;

        for (const binding of candidates) {
            random -= binding.weight;
            if (random <= 0) return binding;
        }

        return candidates[0];
    }

    /**
     * 播放动作
     * @param binding - 动作绑定
     */
    private async playMotion(binding: MotionBinding) {
        if (!binding.motion) return;

        try {
            // 加载动作文件
            const response = await fetch(binding.motion.file_url);
            const motionData = await response.arrayBuffer();

            // 播放动作（需要 VRMViewer 支持）
            if (this.vrmViewer && typeof this.vrmViewer.playAnimation === 'function') {
                await this.vrmViewer.playAnimation(motionData);
            }
        } catch (error) {
            console.error('Failed to play motion:', error);
        }
    }

    /**
     * 获取当前状态
     */
    getCurrentState(): MotionState {
        return this.currentState;
    }

    /**
     * 重新加载绑定
     */
    async reload() {
        await this.loadBindings();
    }
}
