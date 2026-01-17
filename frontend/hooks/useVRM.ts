import { useState, useRef, useEffect, useCallback } from 'react';
import { Character } from '../types';
import { VRMManager } from '../services/vrm';
import { AudioSegment } from '../types/vrm';
import { Logger } from '../utils/logger';

/**
 * VRM Hook - 封装 VRM 模型加载、动画播放逻辑
 * 
 * 重构后职责：
 * 1. React 生命周期管理
 * 2. 状态暴露给组件
 * 3. 简单的接口封装
 */
export const useVRM = (character: Character | null, isVRMMode: boolean) => {
  // VRM 管理器引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<VRMManager | null>(null);

  // VRM 状态
  const [subtitle, setSubtitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载 VRM 模型
   */
  const loadModel = useCallback(async (vrmModelId: string) => {
    if (!managerRef.current) {
      Logger.warn('VRM管理器未初始化');
      return;
    }

    try {
      await managerRef.current.loadModel(vrmModelId);
    } catch (err) {
      Logger.error('加载VRM模型失败', err instanceof Error ? err : undefined);
    }
  }, []);

  /**
   * 播放 VRM 动画片段
   */
  const playSegments = useCallback((segments: AudioSegment[]) => {
    if (managerRef.current && Array.isArray(segments)) {
      managerRef.current.playSegments(segments);
    }
  }, []);

  /**
   * 停止 VRM 播放
   */
  const stop = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stop();
    }
  }, []);

  /**
   * 初始化 VRM
   */
  useEffect(() => {
    if (isVRMMode && canvasRef.current) {
      if (!managerRef.current) {
        // 初始化 VRM 管理器
        managerRef.current = new VRMManager(canvasRef.current, {
          onSubtitleChange: (text) => setSubtitle(text),
          onError: (error) => setError(error),
          onLoadingChange: (loading) => setIsLoading(loading)
        });

        // 调试：暴露到全局
        if (typeof window !== 'undefined') {
          (window as any).__vrmManager = managerRef.current;
          Logger.debug('VRMManager 已暴露到 window.__vrmManager');
        }

        // 加载模型
        if (character?.vrm_model_id) {
          loadModel(character.vrm_model_id);
        } else {
          Logger.warn('当前角色未配置 VRM 模型ID');
          setSubtitle('请先为角色配置VRM模型');
        }
      }
    } else {
      // 切换出 VRM 模式，清理资源
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
        
        // 清理全局变量
        if (typeof window !== 'undefined') {
          delete (window as any).__vrmManager;
        }
      }
      setSubtitle('');
    }
  }, [isVRMMode, character?.character_id, character?.vrm_model_id, loadModel]);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
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
    managerRef,
    subtitle,
    isLoading,
    error,
    loadModel,
    playSegments,
    stop,
    clearError
  };
};
