import React from 'react';
import { initApiConfig } from './utils/constants';

interface BootstrapGateProps {
  children: React.ReactNode;
}

const HEALTH_ENDPOINT = '/health';
const MAX_HEALTH_CHECK_ATTEMPTS = 80;
const HEALTH_CHECK_INTERVAL_MS = 250;

type BootstrapState =
  | { phase: 'booting'; message: string }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; message: string };

async function waitForBackendReady(): Promise<void> {
  const { BASE_URL } = await initApiConfig();
  const healthUrl = `${BASE_URL}${HEALTH_ENDPOINT}`;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_HEALTH_CHECK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      if (response.ok) {
        return;
      }
      lastError = new Error(`健康检查返回状态码 ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => window.setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
  }

  const reason = lastError instanceof Error ? lastError.message : '未知错误';
  throw new Error(`后端启动超时：${reason}`);
}

export function BootstrapGate({ children }: BootstrapGateProps) {
  const [state, setState] = React.useState<BootstrapState>({
    phase: 'booting',
    message: '正在初始化桌面环境...'
  });

  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setState({ phase: 'booting', message: '正在连接本地服务...' });
        await waitForBackendReady();

        if (!cancelled) {
          setState({ phase: 'ready', message: '启动完成' });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '桌面环境初始化失败';
          setState({ phase: 'error', message });
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === 'ready') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
          <span className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">ATRI Chat</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {state.phase === 'error' ? '启动失败' : '正在启动'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {state.message}
        </p>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${
              state.phase === 'error'
                ? 'w-full bg-rose-400'
                : 'w-2/3 animate-pulse bg-cyan-400'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
