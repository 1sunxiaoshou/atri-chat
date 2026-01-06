/**
 * VRMManager - VRM 协调管理器
 * 
 * 职责：
 * 1. 协调三个子管理器（Scene、Model、Playback）
 * 2. 提供统一的对外接口
 * 3. 处理跨层逻辑
 * 4. 错误处理和日志
 */
import { SceneManager } from './scene/sceneManager';
import { ModelManager } from './model/modelManager';
import { PlaybackManager } from './playback/playbackManager';
import { AudioSegment, VRMCallbacks } from './types';
import { api } from '../../services/api/index';
import { HTTP_STATUS, UI_TIMING, DEV_SERVER } from '../constants';
import { Logger } from '../logger';

export class VRMManager {
  private sceneManager: SceneManager;
  private modelManager: ModelManager;
  private playbackManager: PlaybackManager;
  private callbacks: VRMCallbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: VRMCallbacks = {}) {
    this.callbacks = callbacks;

    Logger.debug('VRMManager: 初始化VRM管理器');

    // 初始化三个子管理器
    this.sceneManager = new SceneManager(canvas);
    this.modelManager = new ModelManager(this.sceneManager);
    this.playbackManager = new PlaybackManager(
      this.modelManager,
      callbacks.onSubtitleChange
    );

    Logger.debug('VRMManager: VRM管理器初始化完成');
  }

  /**
   * 加载 VRM 模型
   */
  async loadModel(vrmModelId: string): Promise<void> {
    try {
      this.callbacks.onLoadingChange?.(true);
      this.callbacks.onError?.(null as any);

      Logger.info('🎭 开始加载VRM模型', { vrmModelId });

      // 1. 获取模型数据
      const response = await api.getVRMModel(vrmModelId);
      if (response.code !== HTTP_STATUS.OK || !response.data) {
        throw new Error('获取模型数据失败');
      }

      const modelData = response.data;

      // 2. 构造完整的 URL
      const baseUrl = import.meta.env.PROD ? '' : DEV_SERVER.BACKEND_URL;
      const modelUrl = `${baseUrl}${modelData.model_path}`;

      // 3. 加载模型
      const vrm = await this.modelManager.loadModel(modelUrl);

      // 4. 添加到场景
      this.sceneManager.addToScene(vrm.scene);

      // 5. 加载闲置动画
      const idleAnimationUrl = '/static/animations/idle.vrma';
      await this.modelManager.loadIdleAnimation(idleAnimationUrl);

      // 6. 预加载其他动画（可选）
      if (modelData.animations && modelData.animations.length > 0) {
        Logger.debug(`预加载 ${modelData.animations.length} 个额外动画`);

        // 构造动画数据
        const animations = modelData.animations.map((anim: any) => ({
          name: anim.name,
          animation_path: `${baseUrl}${anim.animation_path}`
        }));

        try {
          await this.modelManager.preloadAnimations(
            animations,
            (loaded, total) => {
              this.callbacks.onSubtitleChange?.(`正在加载动画 ${loaded}/${total}...`);
            }
          );
          Logger.debug('额外动画预加载完成');
        } catch (error) {
          Logger.warn('部分动画加载失败，但不影响使用', error instanceof Error ? error : undefined);
        }
      }

      this.callbacks.onSubtitleChange?.('VRM模型加载完成');

      // 清除提示文字
      setTimeout(() => {
        this.callbacks.onSubtitleChange?.('');
      }, UI_TIMING.SUBTITLE_CLEAR_DELAY);

      Logger.info('✅ VRM模型加载完成', { vrmModelId });

    } catch (error) {
      Logger.error('加载VRM模型失败', error instanceof Error ? error : undefined, { vrmModelId });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.callbacks.onError?.(errorMessage);
      this.callbacks.onSubtitleChange?.('VRM模型加载失败，将使用默认显示');

      // 清除错误提示
      setTimeout(() => {
        this.callbacks.onSubtitleChange?.('');
        this.callbacks.onError?.(null as any);
      }, UI_TIMING.ERROR_CLEAR_DELAY);

      throw error;
    } finally {
      this.callbacks.onLoadingChange?.(false);
    }
  }

  /**
   * 播放音频片段（批量模式）
   */
  async playSegments(segments: AudioSegment[]): Promise<void> {
    if (!Array.isArray(segments) || segments.length === 0) {
      Logger.warn('播放片段为空');
      return;
    }

    Logger.debug(`VRMManager: 播放 ${segments.length} 个音频片段`);

    // 如果是单个段，使用追加模式（流式接收）
    if (segments.length === 1) {
      this.playbackManager.appendSegment(segments[0]!);
    } else {
      // 批量段，使用设置模式
      this.playbackManager.setSegments(segments);
      await this.playbackManager.play();
    }
  }

  /**
   * 追加音频片段（流式模式）
   */
  appendSegment(segment: AudioSegment): void {
    this.playbackManager.appendSegment(segment);
  }

  /**
   * 停止播放
   */
  stop(): void {
    Logger.debug('VRMManager: 停止VRM播放');
    this.playbackManager.stop();
  }

  /**
   * 获取可用的表情列表
   */
  getAvailableExpressions(): string[] {
    return this.modelManager.getAvailableExpressions();
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    Logger.debug('VRMManager: 销毁VRM管理器');

    this.playbackManager.dispose();
    this.modelManager.dispose();
    this.sceneManager.dispose();

    Logger.debug('VRMManager: VRM管理器已销毁');
  }
}
