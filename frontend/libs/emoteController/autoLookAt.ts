import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { Logger } from '../../utils/logger';

/**
 * 自动视线跟踪控制器
 * 参考 lobe-vidol 的 AutoLookAt 实现
 * 让VRM角色的眼睛自动跟随相机，增加互动感
 * 
 * 注意：VRM 的 VRMLookAtSmoother 已经内置了 Saccade（眼球快速运动）效果，
 * 所以这里只需要设置目标对象即可
 */
export class AutoLookAt {
    private lookAtTarget: THREE.Object3D;
    private vrm: VRM;
    private camera: THREE.Object3D;
    private isEnabled: boolean = true;

    constructor(vrm: VRM, camera: THREE.Object3D) {
        this.vrm = vrm;
        this.camera = camera;
        
        // 创建一个目标对象，附加到相机上
        this.lookAtTarget = new THREE.Object3D();
        camera.add(this.lookAtTarget);

        // 设置 VRM 的视线目标
        if (vrm.lookAt) {
            vrm.lookAt.target = this.lookAtTarget;
            Logger.debug('AutoLookAt 初始化完成，视线目标已设置');
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
                // 启用时，设置目标为相机
                this.vrm.lookAt.target = this.lookAtTarget;
            } else {
                // 禁用时，移除目标
                this.vrm.lookAt.target = null;
            }
            Logger.debug(`自动视线跟踪已${enabled ? '启用' : '禁用'}`);
        }
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
        } else {
            // 恢复跟随相机
            this.vrm.lookAt.target = this.lookAtTarget;
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
