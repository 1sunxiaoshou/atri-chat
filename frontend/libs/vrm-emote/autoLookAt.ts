import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { Logger } from '../../utils/logger';

/**
 * 眼球快速运动（Saccade）间隔生成
 * 参考 Airi 的实现
 */
const EYE_SACCADE_INT_STEP = 400;
const EYE_SACCADE_INT_P: [number, number][] = [
  [0.075, 800],
  [0.110, 0],
  [0.125, 0],
  [0.140, 0],
  [0.125, 0],
  [0.050, 0],
  [0.040, 0],
  [0.030, 0],
  [0.020, 0],
  [1.000, 0],
];

// 预计算累积概率
for (let i = 1; i < EYE_SACCADE_INT_P.length; i++) {
  EYE_SACCADE_INT_P[i]![0] += EYE_SACCADE_INT_P[i - 1]![0];
  EYE_SACCADE_INT_P[i]![1] = EYE_SACCADE_INT_P[i - 1]![1] + EYE_SACCADE_INT_STEP;
}

function randomSaccadeInterval(): number {
  const r = Math.random();
  for (let i = 0; i < EYE_SACCADE_INT_P.length; i++) {
    if (r <= EYE_SACCADE_INT_P[i]![0]) {
      return (EYE_SACCADE_INT_P[i]![1] + Math.random() * EYE_SACCADE_INT_STEP) / 1000; // 转换为秒
    }
  }
  return (EYE_SACCADE_INT_P[EYE_SACCADE_INT_P.length - 1]![1] + Math.random() * EYE_SACCADE_INT_STEP) / 1000;
}

/**
 * 自动视线跟踪控制器
 * 参考 Airi 的实现，添加眼球扫视（Saccade）功能
 * 让VRM角色的眼睛更自然地移动
 */
export class AutoLookAt {
    private lookAtTarget: THREE.Object3D;
    private vrm: VRM;
    private camera: THREE.Object3D;
    private isEnabled: boolean = true;
    
    // 眼球扫视相关
    private enableSaccade: boolean = true;
    private fixationTarget: THREE.Vector3;
    private timeSinceLastSaccade: number = 0;
    private nextSaccadeAfter: number = -1;

    constructor(vrm: VRM, camera: THREE.Object3D) {
        this.vrm = vrm;
        this.camera = camera;
        
        // 创建一个目标对象，附加到相机上
        this.lookAtTarget = new THREE.Object3D();
        camera.add(this.lookAtTarget);
        
        // 初始化注视点
        this.fixationTarget = new THREE.Vector3(0, 0, 0);

        // 设置 VRM 的视线目标
        if (vrm.lookAt) {
            vrm.lookAt.target = this.lookAtTarget;
            Logger.debug('AutoLookAt 初始化完成（支持眼球扫视）');
        } else {
            Logger.warn('VRM 模型不支持 LookAt 功能');
        }
    }

    /**
     * 启用/禁用自动视线跟踪
     */
    public setEnable(enabled: boolean): void {
        this.isEnabled = enabled;
        
        if (this.vrm.lookAt) {
            if (enabled) {
                this.vrm.lookAt.target = this.lookAtTarget;
            } else {
                this.vrm.lookAt.target = null;
            }
            Logger.debug(`自动视线跟踪已${enabled ? '启用' : '禁用'}`);
        }
    }

    /**
     * 启用/禁用眼球扫视
     */
    public setSaccadeEnabled(enabled: boolean): void {
        this.enableSaccade = enabled;
        Logger.debug(`眼球扫视已${enabled ? '启用' : '禁用'}`);
    }

    /**
     * 更新注视点（添加随机偏移模拟眼球扫视）
     */
    private updateFixationTarget(): void {
        // 在相机前方的一个小范围内随机移动注视点
        // 模拟在 27 英寸显示器上 65cm 距离的视线移动
        this.fixationTarget.set(
            THREE.MathUtils.randFloat(-0.25, 0.25),
            THREE.MathUtils.randFloat(-0.25, 0.25),
            0
        );
    }

    /**
     * 更新视线追踪（每帧调用）
     * 参考 Airi：添加眼球扫视功能
     */
    public update(delta: number): void {
        if (!this.isEnabled || !this.vrm.lookAt) {
            return;
        }

        // 眼球扫视逻辑
        if (this.enableSaccade) {
            if (this.timeSinceLastSaccade >= this.nextSaccadeAfter) {
                this.updateFixationTarget();
                this.timeSinceLastSaccade = 0;
                this.nextSaccadeAfter = randomSaccadeInterval();
            }

            // 平滑过渡到新的注视点
            this.lookAtTarget.position.lerp(this.fixationTarget, 0.1);
            this.timeSinceLastSaccade += delta;
        }

        // 更新 VRM 的视线
        this.vrm.lookAt.update(delta);
    }

    /**
     * 设置自定义视线目标
     * @param target 目标对象，如果为 null 则恢复跟随相机
     */
    public setTarget(target: THREE.Object3D | null): void {
        if (!this.vrm.lookAt) {
            return;
        }

        if (target) {
            this.vrm.lookAt.target = target;
            this.enableSaccade = false; // 禁用扫视
        } else {
            this.vrm.lookAt.target = this.lookAtTarget;
            this.enableSaccade = true; // 恢复扫视
        }
        Logger.debug(`视线目标已更新`);
    }

    /**
     * 获取当前是否启用
     */
    public isLookAtEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        if (this.vrm.lookAt) {
            this.vrm.lookAt.target = null;
        }

        if (this.lookAtTarget && this.camera) {
            this.camera.remove(this.lookAtTarget);
        }

        Logger.debug('AutoLookAt 资源已清理');
    }
}
