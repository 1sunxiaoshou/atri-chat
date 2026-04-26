import { useRef, useCallback, useEffect } from 'react';
import { Character } from '@/types';
import { buildResourceUrl } from '@/utils/constants';
import { motionBindingsApi } from '@/services/api/motions';
import { useVRMStore } from '@/store/vrm/useVRMStore';
import { adaptActionCommands } from './streamAdapter';

/**
 * 角色动作绑定数据结构
 */
interface CharacterMotionBindings {
  initial?: any[];
  idle?: any[];
  thinking?: any[];
  reply?: any[];
}

/**
 * 随机选择动作
 */
function selectMotionByWeight(bindings: any[]): any {
  if (bindings.length === 0) {return null;}
  if (bindings.length === 1) {return bindings[0];}

  // 随机选择一个动作
  const randomIndex = Math.floor(Math.random() * bindings.length);
  return bindings[randomIndex];
}

/**
 * 根据动作名称或ID从 reply 分类中查找动作 URL
 * 只从 reply 分类搜索（不区分大小写，支持模糊匹配）
 */
async function findMotionByName(
  bindingsRef: React.MutableRefObject<CharacterMotionBindings | null>,
  motionName: string
): Promise<string | null> {
  if (!bindingsRef.current) {
    return null;
  }

  const normalizedName = motionName.toLowerCase().trim();

  // 只从 reply 分类中查找
  const bindings = bindingsRef.current.reply;
  if (!bindings || bindings.length === 0) {
    console.warn(`[useVRM] No reply motions available for character`);
    return null;
  }

  // 1. 精确匹配 motion_id（优先级最高）
  const idMatch = bindings.find(
    (b: any) => b.motion_id?.toLowerCase() === normalizedName
  );
  if (idMatch?.motion_file_url) {
    return buildResourceUrl(idMatch.motion_file_url);
  }

  // 2. 精确匹配 motion_name
  const exactMatch = bindings.find(
    (b: any) => b.motion_name?.toLowerCase() === normalizedName
  );
  if (exactMatch?.motion_file_url) {
    return buildResourceUrl(exactMatch.motion_file_url);
  }

  // 3. 包含匹配 motion_name（模糊匹配）
  const partialMatch = bindings.find(
    (b: any) => b.motion_name?.toLowerCase().includes(normalizedName)
  );
  if (partialMatch?.motion_file_url) {
    return buildResourceUrl(partialMatch.motion_file_url);
  }

  // 找不到匹配的动作
  console.warn(`[useVRM] Motion not found in reply category: ${motionName}`);
  return null;
}

/**
 * 获取角色指定分类的动作 URL
 * 从已缓存的动作绑定中选择（不再请求 API）
 */
async function getCharacterMotionUrl(
  bindingsRef: React.MutableRefObject<CharacterMotionBindings | null>,
  characterId: string,
  category: 'initial' | 'idle' | 'thinking' | 'reply',
  randomSelect: boolean = true
): Promise<string | null> {
  try {
    // 如果缓存为空，说明还没加载，返回 null
    if (!bindingsRef.current) {
      console.warn(`[useVRM] Motion bindings not loaded for character ${characterId}`);
      return null;
    }

    const bindings = bindingsRef.current[category];

    if (!bindings || bindings.length === 0) {
      return null;
    }

    // 选择动作
    let selectedBinding;
    if (randomSelect && category !== 'reply') {
      // initial/idle/thinking: 随机选择
      selectedBinding = selectMotionByWeight(bindings);
    } else {
      // reply: 使用第一个
      selectedBinding = bindings[0];
    }

    if (!selectedBinding || !selectedBinding.motion_file_url) {
      return null;
    }

    return buildResourceUrl(selectedBinding.motion_file_url);
  } catch (error) {
    console.error(`[useVRM] Failed to get ${category} motion:`, error);
    return null;
  }
}

/**
 * VRM Hook - R3F 架构实现
 * 
 * 功能：
 * - 管理 VRM 模型 URL
 * - 处理 AI 音频片段（TTS → 口型同步）
 * - 映射 AI 情感到 VRM 表情
 * - 控制动作状态（思考/闲置/回复）
 * - 显示字幕
 */
export const useVRM = (character: Character | null, isVRMMode: boolean) => {
  // Zustand Store
  const setRuntime = useVRMStore((state) => state.setRuntime);
  const setMotion = useVRMStore((state) => state.setMotion);
  const setExpression = useVRMStore((state) => state.setExpression);
  const setSubtitle = useVRMStore((state) => state.setSubtitle);
  const { modelUrl, expression, motionUrl, subtitle, isLoading, error } = useVRMStore((state) => state.runtime);

  const previousModelUrlRef = useRef<string | null>(null);

  // 动作绑定缓存（角色级别）
  const motionBindingsRef = useRef<CharacterMotionBindings | null>(null);

  // 音频元素引用
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 模型加载状态标记
  const isWaitingForModelLoadRef = useRef(false);

  // 动作完成等待标记
  const isWaitingForMotionRef = useRef(false);
  const motionFinishedCallbackRef = useRef<(() => void) | null>(null);

  // 闲置计时器
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMotionChangeTimeRef = useRef<number>(Date.now());
  const currentMotionCategoryRef = useRef<'initial' | 'idle' | 'thinking' | 'reply' | null>(null);

  /**
   * 启动闲置计时器
   * 基础时间 12秒，随机波动 ±3秒
   */
  const startIdleTimer = useCallback(() => {
    // 清除旧计时器
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // 计算随机延迟：9-15秒
    const baseDelay = 12000; // 12秒
    const randomOffset = (Math.random() * 6000) - 3000; // ±3秒
    const delay = baseDelay + randomOffset;

    idleTimerRef.current = setTimeout(async () => {
      // 检查触发条件
      // 1. 当前是 initial 动作
      // 2. 距离上次动作切换已超过计时器时间
      if (
        currentMotionCategoryRef.current === 'initial' &&
        Date.now() - lastMotionChangeTimeRef.current >= delay
      ) {
        // 播放闲置动作
        if (character?.id) {
          const idleMotionUrl = await getCharacterMotionUrl(motionBindingsRef, character.id, 'idle', true);
          if (idleMotionUrl) {
            setMotion(idleMotionUrl);
            currentMotionCategoryRef.current = 'idle';
            lastMotionChangeTimeRef.current = Date.now();

            // 闲置状态下的表情切换：50% neutral，其他表情均分
            const random = Math.random();
            if (random < 0.5) {
              // 50% 概率保持 neutral
              setExpression('neutral');
            } else {
              // 50% 概率随机选择其他表情
              const otherExpressions = ['happy', 'sad', 'angry', 'surprised', 'relaxed'] as const;
              const randomIndex = Math.floor(Math.random() * otherExpressions.length);
              setExpression(otherExpressions[randomIndex]!);
            }
          }
        }
      }
    }, delay);
  }, [character, setMotion, setExpression]);

  /**
   * 停止闲置计时器
   */
  const stopIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  /**
   * 加载 VRM 模型
   */
  const loadModel = useCallback(async (avatarId: string, characterId?: string) => {
    if (!isVRMMode) {return;}

    try {
      setRuntime({ isLoading: true, error: null });

      // 停止当前播放和闲置计时器
      stopIdleTimer();

      // 如果是路径格式，直接使用
      let url: string;
      if (avatarId.startsWith('/') || avatarId.startsWith('http')) {
        url = buildResourceUrl(avatarId);
      } else {
        // 如果是 ID，构建后端新架构下的标准路径
        url = buildResourceUrl(`/static/vrm/models/${avatarId}.vrm`);
      }

      // 重置状态
      setRuntime({
        expression: 'neutral',
        subtitle: '',
      });
      currentMotionCategoryRef.current = null;

      // 预加载动作绑定（如果有 characterId）
      if (characterId) {
        try {
          const response = await motionBindingsApi.getCharacterBindings(characterId);
          if (response.code === 200 && response.data) {
            motionBindingsRef.current = response.data.bindings_by_category;

            // 设置模型URL，标记等待模型加载完成后再加载初始动作
            setRuntime({ modelUrl: url });
            isWaitingForModelLoadRef.current = true;
          } else {
            // 没有动作绑定，直接设置模型，但仍然标记等待（会在 handleModelLoaded 中设置 null）
            motionBindingsRef.current = null;
            setRuntime({ modelUrl: url });
            isWaitingForModelLoadRef.current = true;
          }
        } catch (bindingError) {
          console.error('[useVRM] Failed to load motion bindings:', bindingError);
          // 即使动作绑定加载失败，也要设置模型
          motionBindingsRef.current = null;
          setRuntime({ modelUrl: url });
          isWaitingForModelLoadRef.current = true;
        }
      } else {
        // 没有 characterId，直接设置模型
        motionBindingsRef.current = null;
        setRuntime({ modelUrl: url });
        isWaitingForModelLoadRef.current = true;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load VRM model';
      setRuntime({ error: errorMessage });
      console.error('[useVRM] Load model error:', err);
    } finally {
      setRuntime({ isLoading: false });
    }
  }, [isVRMMode, stopIdleTimer, setRuntime]);

  /**
   * 开始思考状态
   */
  const startThinking = useCallback(async () => {
    if (!isVRMMode) {return;}

    // 停止闲置计时器
    stopIdleTimer();

    // 停止音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // 清空字幕
    setSubtitle('');
    // 表情由 AI 控制，不自动设置

    // 设置思考动作（随机选择）
    if (character?.id) {
      const thinkingMotionUrl = await getCharacterMotionUrl(motionBindingsRef, character.id, 'thinking', true);
      if (thinkingMotionUrl) {
        setMotion(thinkingMotionUrl);
        currentMotionCategoryRef.current = 'thinking';
        lastMotionChangeTimeRef.current = Date.now();
      }
      // 如果没有思考动作，保持当前动作不变
    }
  }, [isVRMMode, character, stopIdleTimer, setSubtitle, setMotion]);

  /**
   * 停止 VRM 播放
   */
  const stop = useCallback(() => {
    // 停止音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // 重置状态
    setRuntime({
      subtitle: '',
      expression: 'neutral',
      motionUrl: null,
    });
  }, [setRuntime]);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setRuntime({ error: null });
  }, [setRuntime]);

  const executeCommands = useCallback(async (commands: string[]) => {
    if (!isVRMMode) {
      return { ok: false, error: 'vrm mode disabled' };
    }

    stopIdleTimer();
    const { commands: parsed, rejected } = adaptActionCommands(commands);
    let currentExpression = expression;
    let currentSubtitle = subtitle;
    let currentMotion = motionUrl;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const command of parsed) {
      if (command.type === 'emotion') {
        currentExpression = command.value;
        setExpression(command.value);
        continue;
      }

      if (command.type === 'motion') {
        if (character?.id) {
          const motion = await findMotionByName(motionBindingsRef, command.value);
          if (motion) {
            currentMotion = motion;
            setMotion(motion);
            currentMotionCategoryRef.current = 'reply';
            lastMotionChangeTimeRef.current = Date.now();
          }
        }
        continue;
      }

      if (command.type === 'say') {
        currentExpression = command.emotion;
        currentSubtitle = command.text;
        setExpression(command.emotion);
        setSubtitle(command.text);
        await sleep(Math.min(Math.max(command.text.length * 120, 1200), 4000));
        continue;
      }

      if (command.type === 'wait') {
        await sleep(command.ms);
      }
    }

    startIdleTimer();
    return {
      ok: rejected.length === 0,
      error: rejected.length > 0 ? `rejected: ${rejected.join(', ')}` : undefined,
      state: {
        expression: currentExpression,
        subtitle: currentSubtitle,
        motionUrl: currentMotion,
      },
    };
  }, [character, expression, isVRMMode, motionUrl, setExpression, setMotion, setSubtitle, startIdleTimer, stopIdleTimer, subtitle]);

  const executeCameraCommand = useCallback(async (command: { action?: string; preset?: string; durationMs?: number }) => {
    setRuntime({
      cameraAction: command.action ?? null,
      cameraPreset: command.preset ?? null,
      cameraDurationMs: command.durationMs ?? null,
    });
    return {
      ok: true,
      error: undefined,
      state: {
        cameraAction: command.action ?? null,
        cameraPreset: command.preset ?? null,
        durationMs: command.durationMs ?? null,
      },
    };
  }, [setRuntime]);

  // 当角色改变时，自动加载模型
  useEffect(() => {
    if (character && isVRMMode) {
      // 优先使用 avatar.file_url，其次使用 avatar_id
      const vrmUrl = character.avatar?.file_url || character.avatar_id;

      if (vrmUrl) {
        // 有 VRM 模型：加载模型
        // 清理旧模型（如果 URL 改变）
        if (previousModelUrlRef.current && previousModelUrlRef.current !== vrmUrl) {
          // 动态导入
          import('../hooks/useVRMLoader').then(({ useVRMLoader }) => {
            useVRMLoader.clear(previousModelUrlRef.current!);
          });
        }

        previousModelUrlRef.current = vrmUrl;
        loadModel(vrmUrl, character.id);
      } else {
        // 无 VRM 模型：清空资源

        // 清理旧模型
        if (previousModelUrlRef.current) {
          import('../hooks/useVRMLoader').then(({ useVRMLoader }) => {
            useVRMLoader.clear(previousModelUrlRef.current!);
          });
        }

        // 清空状态
        previousModelUrlRef.current = null;
        motionBindingsRef.current = null;
        setRuntime({
          modelUrl: null,
          motionUrl: null,
          expression: 'neutral',
          subtitle: '',
        });
      }
    }
  }, [character?.avatar?.file_url, character?.avatar_id, character?.id, isVRMMode, loadModel, setRuntime]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 停止闲置计时器
      stopIdleTimer();

      // 停止播放
      stop();

      // 清理当前模型
      if (previousModelUrlRef.current) {
        import('../hooks/useVRMLoader').then(({ useVRMLoader }) => {
          useVRMLoader.clear(previousModelUrlRef.current!);
        });
      }
    };
  }, [stopIdleTimer, stop]);

  // 创建音频元素
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * 模型加载完成回调
   */
  const handleModelLoaded = useCallback(async () => {
    if (isWaitingForModelLoadRef.current && character?.id) {
      isWaitingForModelLoadRef.current = false;

      // 加载初始动作
      const initialMotionUrl = await getCharacterMotionUrl(motionBindingsRef, character.id, 'initial', true);
      if (initialMotionUrl) {
        setMotion(initialMotionUrl);
        currentMotionCategoryRef.current = 'initial';
        lastMotionChangeTimeRef.current = Date.now();

        // 启动闲置计时器
        startIdleTimer();
      } else {
        // 如果没有初始动作，重置为 null（会显示 T-pose）
        setMotion(null);
      }
    }
  }, [character, startIdleTimer, setMotion]);

  /**
   * 动作播放完成回调
   */
  const handleMotionComplete = useCallback(() => {
    // 如果正在等待动作完成，触发回调
    if (isWaitingForMotionRef.current && motionFinishedCallbackRef.current) {
      isWaitingForMotionRef.current = false;
      const callback = motionFinishedCallbackRef.current;
      motionFinishedCallbackRef.current = null;
      callback();
    }
  }, []);

  return {
    // R3F 架构使用的状态
    modelUrl,
    expression,
    motionUrl,
    audioElement: audioRef.current,
    subtitle,
    isLoading,
    error,

    // 方法
    loadModel,
    startThinking,
    stop,
    clearError,
    executeCommands,
    executeCameraCommand,
    onModelLoaded: handleModelLoaded,
    onMotionComplete: handleMotionComplete,
  };
};
