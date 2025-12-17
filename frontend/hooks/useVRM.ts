import { useState, useRef, useEffect, useCallback } from 'react';
import { Character } from '../types';
import { api } from '../services/api/index';
import { VRMLoader } from '../utils/vrmLoader.js';
import { VRMTimedPlayer } from '../utils/vrmTimedPlayer.js';
import { StreamTTSPlayer } from '../utils/streamTTSPlayer';
import { HTTP_STATUS, UI_TIMING, DEV_SERVER } from '../utils/constants';
import { Logger } from '../utils/logger';

/**
 * VRM Hook - 封装 VRM 模型加载、动画播放逻辑

 */
export const useVRM = (character: Character | null, isVRMMode: boolean) => {
  // VRM 相关的 refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<VRMLoader | null>(null);
  const playerRef = useRef<VRMTimedPlayer | null>(null);

  // VRM 状态
  const [subtitle, setSubtitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载 VRM 模型
   */
  const loadModel = useCallback(async (vrmModelId: string, loader: VRMLoader) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.getVRMModel(vrmModelId);
      if (response.code === HTTP_STATUS.OK && response.data) {
        const modelData = response.data;

        // 构造完整的 URL
        const baseUrl = import.meta.env.PROD ? '' : DEV_SERVER.BACKEND_URL;
        const modelUrl = `${baseUrl}${modelData.model_path}`;
        
        await loader.loadModel(modelUrl);
        
        // 模型加载后，设置闲置动画 URL 并加载
        const idleAnimationUrl = '/static/animations/idle.vrma';
        loader.setIdleAnimationUrl(idleAnimationUrl);
        Logger.info('设置本地闲置动画', { idleAnimationUrl });
        
        // 手动加载闲置动画
        await loader.loadIdleAnimation();
        

        // 如果后端有配置其他动画，也加载（可选）
        if (modelData.animations && modelData.animations.length > 0) {
          const animationMap: Record<string, string> = {};

          modelData.animations.forEach((anim: any) => {
            const animationUrl = `${baseUrl}${anim.animation_path}`;
            animationMap[anim.name] = animationUrl;
          });

          Logger.info(`预加载 ${Object.keys(animationMap).length} 个额外动画`, { animationMap });

          // 预加载其他动画（失败不影响闲置动画）
          try {
            await loader.preloadAnimations(animationMap, (loaded, total) => {
              setSubtitle(`正在加载动画 ${loaded}/${total}...`);
            });
          } catch (error) {
            Logger.warn('部分动画加载失败，但不影响使用', error instanceof Error ? error : undefined);
          }
        }

        setSubtitle('VRM模型加载完成');

        // 清除提示文字
        setTimeout(() => setSubtitle(''), UI_TIMING.SUBTITLE_CLEAR_DELAY);
      }
    } catch (err) {
      Logger.error('加载VRM模型失败', err instanceof Error ? err : undefined, { vrmModelId });
      const errorMessage = err instanceof Error ? err.message : String(err);
      Logger.error('错误详情', undefined, { errorMessage });
      setError('VRM模型加载失败');
      setSubtitle('VRM模型加载失败，将使用默认显示');

      // 清除错误提示
      setTimeout(() => {
        setSubtitle('');
        setError(null);
      }, UI_TIMING.ERROR_CLEAR_DELAY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 播放 VRM 动画片段
   */
  const playSegments = useCallback((segments: any[]) => {
    if (playerRef.current && Array.isArray(segments)) {
      // 如果是单个段，使用追加模式（流式接收）
      if (segments.length === 1) {
        playerRef.current.appendSegment(segments[0]);
      } else {
        // 批量段，使用设置模式
        playerRef.current.setSegments(segments);
        playerRef.current.play();
      }
    }
  }, []);

  /**
   * 停止 VRM 播放
   */
  const stop = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
  }, []);

  /**
   * 初始化 VRM
   */
  useEffect(() => {
    if (isVRMMode && canvasRef.current) {
      if (!loaderRef.current) {
        const loader = new VRMLoader(canvasRef.current);
        loaderRef.current = loader;

        // 初始化播放器
        const streamPlayer = new StreamTTSPlayer(1.0);
        const player = new VRMTimedPlayer(loader, streamPlayer, (text) => setSubtitle(text));
        playerRef.current = player;

        // 加载模型
        if (character?.vrm_model_id) {
          loadModel(character.vrm_model_id, loader);
        } else {
          Logger.warn("当前角色未配置 VRM 模型ID");
          setSubtitle('请先为角色配置VRM模型');
        }
      }
    } else {
      // 切换出 VRM 模式，清理资源
      if (loaderRef.current) {
        loaderRef.current.dispose();
        loaderRef.current = null;
        
        // 清理全局引用
        delete (window as any).vrmLoader;
      }
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
      setSubtitle('');
    }
  }, [isVRMMode, character?.character_id, character?.vrm_model_id, loadModel]);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      if (loaderRef.current) {
        loaderRef.current.dispose();
        loaderRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    canvasRef,
    loaderRef,
    playerRef,
    subtitle,
    isLoading,
    error,
    loadModel,
    playSegments,
    stop,
    clearError
  };
};
