import { useCallback, useEffect, useState } from 'react';
import { RuntimeStatusResponse } from '../types';
import { runtimeApi } from '../services/api/runtime';
import { Logger } from '../utils/logger';

export const useRuntimeStatus = (enabled = true, pollIntervalMs = 15000) => {
  const [status, setStatus] = useState<RuntimeStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await runtimeApi.getStatus();
      if (response.code === 200) {
        setStatus(response.data);
        setError(null);
      } else {
        setError(response.message || '加载运行时状态失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载运行时状态失败';
      Logger.error('加载运行时状态失败', err instanceof Error ? err : undefined);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, pollIntervalMs, refresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
};
