/**
 * ModelManager - 模型动画管理器
 * 
 * 职责：
 * 1. VRM 模型加载
 * 2. 动画加载与管理
 * 3. 表情控制
 * 4. 口型同步
 * 5. 视线跟踪
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { EmoteController } from '../../../libs/emoteController/emoteController';
import { AutoLookAt } from '../../../libs/emoteController/autoLookAt';
import { SceneManager } from '../scene/sceneManager';
import { Logger } from '../../logger';

export class ModelManager {
  private currentVrm: VRM | null = null;
  private emoteController: EmoteController | null = null;
  private autoLookAt: AutoLookAt | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private updateCallback: ((delta: number) => void) | null = null;

  constructor(private sceneManager: SceneManager) {
    Logger.debug('ModelManager: 初始化模型管理器');
  }

  /**
   * 加载 VRM 模型
   */
  async loadModel(url: string): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      Logger.debug('ModelManager: 开始加载VRM模型', { url });

      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm;

      if (!vrm) {
        throw new Error('文件不是有效的VRM模型');
      }

      // 优化VRM
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);

      // 移除旧模型
      if (this.currentVrm) {
        this.sceneManager.removeFromScene(this.currentVrm.scene);
        if (this.mixer) {
          this.mixer.stopAllAction();
        }
        VRMUtils.deepDispose(this.currentVrm.scene);
      }

      this.currentVrm = vrm;

      // 禁用视锥剔除和描边
      vrm.scene.traverse((obj: any) => {
        obj.frustumCulled = false;
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat: any) => {
            if (mat.isMToonMaterial) {
              mat.outlineWidthMode = 'none';
              mat.outlineWidthFactor = 0;
              mat.outlineLightingMixFactor = 0;
              mat.needsUpdate = true;
            }
            if (mat.outlineWidth !== undefined) {
              mat.outlineWidth = 0;
            }
          });
        }
      });

      // 初始化动画混合器
      this.mixer = new THREE.AnimationMixer(vrm.scene);

      // 初始化情感控制器
      this.emoteController = new EmoteController(vrm);

      // 初始化自动视线跟踪
      this.autoLookAt = new AutoLookAt(vrm, this.sceneManager.getCamera());

      // 注册更新回调
      this.updateCallback = (delta: number) => {
        if (this.currentVrm) {
          this.currentVrm.update(delta);
        }
        if (this.mixer) {
          this.mixer.update(delta);
        }
        if (this.emoteController) {
          this.emoteController.update(delta);
        }
      };
      this.sceneManager.registerUpdateCallback(this.updateCallback);

      Logger.debug('ModelManager: VRM模型加载完成');

      return vrm;
    } catch (error) {
      Logger.error('VRM模型加载失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * 加载闲置动画
   */
  async loadIdleAnimation(url: string): Promise<void> {
    if (!this.emoteController) {
      Logger.warn('情感控制器未初始化，无法加载闲置动画');
      return;
    }

    try {
      this.emoteController.setIdleAnimationUrl(url);
      await this.emoteController.loadIdleAnimation();
      Logger.debug('ModelManager: 闲置动画加载完成', { url });
    } catch (error) {
      Logger.error('闲置动画加载失败', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * 预加载动画
   */
  async preloadAnimation(name: string, url: string): Promise<void> {
    if (!this.emoteController) {
      Logger.warn('情感控制器未初始化，无法预加载动画');
      return;
    }

    await this.emoteController.preloadAnimation(name, url);
    Logger.debug('ModelManager: 动画预加载完成', { name, url });
  }

  /**
   * 批量预加载动画
   */
  async preloadAnimations(
    animations: Array<{ name: string; animation_path: string }>,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    if (!this.emoteController) {
      Logger.warn('情感控制器未初始化，无法预加载动画');
      return;
    }

    const animationMap: Record<string, string> = {};
    animations.forEach((anim) => {
      animationMap[anim.name] = anim.animation_path;
    });

    try {
      await this.emoteController.preloadAnimations(animationMap, onProgress);
      Logger.info(`预加载 ${animations.length} 个动画完成`);
    } catch (error) {
      Logger.warn('部分动画加载失败，但不影响使用', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 设置表情
   */
  setExpression(presetName: string): void {
    if (!this.emoteController) {
      return;
    }

    try {
      this.emoteController.playEmotion(presetName);
      Logger.debug(`设置表情: ${presetName}`);
    } catch (error) {
      Logger.error(`设置表情失败: ${presetName}`, error instanceof Error ? error : undefined);
    }
  }

  /**
   * 播放动画
   */
  async playAnimation(name: string, loop: boolean = true): Promise<void> {
    if (!this.emoteController) {
      Logger.warn('情感控制器未初始化，无法播放动画');
      return;
    }

    await this.emoteController.playAnimation(name, loop);
    Logger.debug(`播放动画: ${name}`, { loop });
  }

  /**
   * 更新口型同步
   */
  updateLipSync(volume: number): void {
    if (!this.emoteController) {
      return;
    }

    // 调整口型大小：降低系数让嘴巴张得小一点
    const adjustedVolume = Math.sqrt(volume) * 0.8;
    const value = Math.min(1.0, adjustedVolume);

    this.emoteController.lipSync('aa', value);

    if (value > 0.1) {
      Logger.debug(`口型同步: aa = ${value.toFixed(3)}`);
    }
  }

  /**
   * 重置到闲置状态
   */
  async resetToIdle(): Promise<void> {
    if (!this.emoteController) {
      return;
    }

    try {
      await this.emoteController.resetToIdle();
      Logger.info('已重置到闲置状态');
    } catch (error) {
      Logger.error('重置到闲置状态失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取可用的表情列表
   */
  getAvailableExpressions(): string[] {
    if (!this.currentVrm?.expressionManager) {
      return [];
    }
    return Object.keys(this.currentVrm.expressionManager.expressionMap);
  }

  /**
   * 获取当前VRM实例
   */
  getCurrentVRM(): VRM | null {
    return this.currentVrm;
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    Logger.debug('ModelManager: 销毁模型管理器');

    // 取消注册更新回调
    if (this.updateCallback) {
      this.sceneManager.unregisterUpdateCallback(this.updateCallback);
      this.updateCallback = null;
    }

    // 清理自动视线跟踪
    if (this.autoLookAt) {
      this.autoLookAt.dispose();
      this.autoLookAt = null;
    }

    // 清理情感控制器
    if (this.emoteController) {
      this.emoteController.dispose();
      this.emoteController = null;
    }

    // 清理VRM模型
    if (this.currentVrm) {
      this.sceneManager.removeFromScene(this.currentVrm.scene);
      VRMUtils.deepDispose(this.currentVrm.scene);
      this.currentVrm = null;
    }

    this.mixer = null;

    Logger.debug('ModelManager: 模型管理器已销毁');
  }
}
