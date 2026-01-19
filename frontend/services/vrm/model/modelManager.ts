/**
 * ModelManager - 模型动画管理器
 * 
 * 职责：
 * 1. VRM 模型加载
 * 2. 动画加载与管理
 * 3. 表情控制
 * 4. 眨眼控制（独立系统）
 * 5. 口型同步
 * 6. 视线跟踪
 * 
 * 更新顺序（参考 Airi）：
 * 1. 动画混合器
 * 2. 自定义帧钩子
 * 3. 人形骨骼
 * 4. 视线追踪（VRM 内置）
 * 5. 眨眼
 * 6. 眼球扫视
 * 7. 表情
 * 8. 口型（外部调用）
 * 9. 弹簧骨骼
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { EmoteController } from '../../../libs/vrm-emote/emoteController';
import { AutoBlink } from '../../../libs/vrm-emote/autoBlink';
import { AutoLookAt } from '../../../libs/vrm-emote/autoLookAt';
import { SceneManager } from '../scene/sceneManager';
import { Logger } from '../../../utils/logger';

export class ModelManager {
  private currentVrm: VRM | null = null;
  private emoteController: EmoteController | null = null;
  private autoBlink: AutoBlink | null = null;
  private autoLookAt: AutoLookAt | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private updateCallback: ((delta: number) => void) | null = null;
  private frameHook: ((vrm: VRM, delta: number) => void) | null = null;

  constructor(private sceneManager: SceneManager) {
    // 初始化日志已删除，太冗余
  }

  /**
   * 加载 VRM 模型
   */
  async loadModel(url: string): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      Logger.debug('ModelManager.loadModel 开始执行', { url });

      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm;

      if (!vrm) {
        throw new Error('文件不是有效的VRM模型');
      }

      Logger.info('✅ VRM 模型文件加载成功，开始初始化...');

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

      // 初始化动画混合器
      this.mixer = new THREE.AnimationMixer(vrm.scene);
      Logger.info('✅ 动画混合器已初始化');

      // 初始化情感控制器
      this.emoteController = new EmoteController(vrm);
      Logger.info('✅ 情感控制器已初始化');

      // 初始化自动眨眼（独立于表情控制器）
      if (vrm.expressionManager) {
        this.autoBlink = new AutoBlink(vrm.expressionManager);
        Logger.debug('自动眨眼已初始化');
      } else {
        Logger.warn('⚠️ VRM 没有 expressionManager，无法初始化眨眼');
      }

      // 初始化自动视线跟踪
      this.autoLookAt = new AutoLookAt(vrm, this.sceneManager.getCamera());
      Logger.debug('自动视线跟踪已初始化');

      // 注册更新回调 - 完全按照 Airi 的顺序
      this.updateCallback = (delta: number) => {
        // 1. 动画混合器（先更新动画）
        if (this.mixer) {
          this.mixer.update(delta);
        }

        // 2. 自定义帧钩子（用户扩展点）
        if (this.currentVrm && this.frameHook) {
          try {
            this.frameHook(this.currentVrm, delta);
          } catch (error) {
            Logger.error('自定义帧钩子执行失败', error instanceof Error ? error : undefined);
          }
        }

        // 3. 人形骨骼（应用动画到骨骼）
        if (this.currentVrm) {
          this.currentVrm.humanoid.update();
        }

        // 4. 视线追踪（VRM 内置的 lookAt）
        if (this.currentVrm?.lookAt) {
          this.currentVrm.lookAt.update(delta);
        }

        // 5. 眨眼（独立系统）
        // 参考 Airi：无条件更新，依赖 VRM 的 expressionManager 自动混合权重
        if (this.autoBlink && this.currentVrm) {
          this.autoBlink.update(delta);
        }

        // 6. 眼球扫视（微调视线）
        if (this.autoLookAt) {
          this.autoLookAt.update(delta);
        }

        // 7. 表情（整体面部）
        if (this.emoteController) {
          this.emoteController.update(delta);
        }

        // 8. 口型同步在外部通过 updateLipSync 调用

        // 9. 表情管理器更新（应用所有表情权重到模型）
        // 这一步非常关键！必须在所有表情设置之后调用
        if (this.currentVrm?.expressionManager) {
          this.currentVrm.expressionManager.update();
        }

        // 10. 弹簧骨骼（物理模拟）
        if (this.currentVrm?.springBoneManager) {
          this.currentVrm.springBoneManager.update(delta);
        }
      };
      this.sceneManager.registerUpdateCallback(this.updateCallback);

      Logger.debug('更新回调已注册', {
        hasMixer: !!this.mixer,
        hasEmoteController: !!this.emoteController,
        hasAutoBlink: !!this.autoBlink,
        hasAutoLookAt: !!this.autoLookAt
      });

      Logger.info('🎉 ModelManager: VRM模型加载完成');

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
   * 参考 airi 项目改进：使用多音素、平滑过渡、静音检测
   */
  updateLipSync(volume: number): void {
    if (!this.emoteController) {
      return;
    }

    // 静音检测
    const SILENCE_THRESHOLD = 0.04;
    if (volume < SILENCE_THRESHOLD) {
      // 静音时，逐渐关闭所有口型
      this.emoteController.lipSync('aa', 0);
      this.emoteController.lipSync('ih', 0);
      this.emoteController.lipSync('ou', 0);
      this.emoteController.lipSync('ee', 0);
      this.emoteController.lipSync('oh', 0);
      return;
    }

    // 音量映射：使用平方根让小音量更敏感
    const normalizedVolume = Math.sqrt(volume);
    
    // 限制最大值为 0.7（参考 airi）
    const CAP = 0.7;
    const lipValue = Math.min(normalizedVolume * 0.9, CAP);

    // 简化版：主要使用 'aa' 口型，配合少量其他音素
    // 完整版需要音素分析库（如 wlipsync）
    this.emoteController.lipSync('aa', lipValue);
    
    // 添加一些变化，避免只张嘴不动
    const variation = Math.sin(Date.now() / 100) * 0.1;
    this.emoteController.lipSync('ih', lipValue * 0.3 + variation);
    this.emoteController.lipSync('ou', lipValue * 0.2);

    if (lipValue > 0.1) {
      Logger.debug(`口型同步: aa=${lipValue.toFixed(3)}, volume=${volume.toFixed(3)}`);
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
   * 获取当前表情
   */
  getCurrentExpression(): string | null {
    if (!this.emoteController) {
      return null;
    }
    return this.emoteController.getCurrentExpression();
  }

  /**
   * 获取当前VRM实例
   */
  getCurrentVRM(): VRM | null {
    return this.currentVrm;
  }

  /**
   * 设置自定义帧钩子
   * 参考 Airi：允许用户在更新循环中插入自定义逻辑
   */
  setFrameHook(hook: ((vrm: VRM, delta: number) => void) | null): void {
    this.frameHook = hook;
    Logger.debug('自定义帧钩子已设置');
  }

  /**
   * 启用/禁用自动眨眼
   */
  setAutoBlinkEnabled(enabled: boolean): void {
    if (this.autoBlink) {
      this.autoBlink.setEnable(enabled);
    }
  }

  /**
   * 检查是否正在眨眼
   */
  isBlinking(): boolean {
    return this.autoBlink?.isBlinkingNow() ?? false;
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

    // 清理自动眨眼
    if (this.autoBlink) {
      this.autoBlink.dispose();
      this.autoBlink = null;
    }

    // 清理情感控制器
    if (this.emoteController) {
      this.emoteController.dispose();
      this.emoteController = null;
    }

    // 清理自定义钩子
    this.frameHook = null;

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
